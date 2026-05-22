import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/pose/motionMapper.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-pump-drive-check-"));
const compiledPath = path.join(tempDir, "motionMapper.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { MotionMapper } = await import(pathToFileURL(compiledPath).href);

function joint(x, y, z, visible = true) {
  return { x, y, z, visible };
}

function createSample(timestampMs, leftSignal, rightSignal, confidence = 1) {
  const shoulderY = 0.38;
  const shoulderZ = -0.15;
  const leftLoaded = leftSignal > 0;
  const rightLoaded = rightSignal > 0;

  return {
    timestampMs,
    dt: 1 / 30,
    hipCenterX: 0.5,
    shoulderCenterX: 0.5,
    kneeRatio: 1,
    confidence,
    armConfidence: confidence,
    leftShoulder: joint(0.42, shoulderY, shoulderZ),
    rightShoulder: joint(0.58, shoulderY, shoulderZ),
    leftElbow: joint(0.39, leftLoaded ? 0.43 : 0.5, leftLoaded ? -0.2 : -0.08),
    rightElbow: joint(0.61, rightLoaded ? 0.43 : 0.5, rightLoaded ? -0.2 : -0.08),
    leftWrist: joint(0.36, leftLoaded ? 0.34 : 0.58, leftLoaded ? -0.3 : -0.02),
    rightWrist: joint(0.64, rightLoaded ? 0.34 : 0.58, rightLoaded ? -0.3 : -0.02)
  };
}

const mapper = new MotionMapper();

const warmup = mapper.mapSample(createSample(0, 0, 0));
assert.equal(warmup.drive ?? 0, 0, "expected idle drive at startup");
assert.equal(warmup.pumpTriggered, false, "expected no pump trigger at startup");

const firstSwing = [
  createSample(33, 1, 1),
  createSample(66, -1, -1)
];

let lastMotion = warmup;
for (const sample of firstSwing) {
  lastMotion = mapper.mapSample(sample);
}

assert.equal(lastMotion.pumpHits, 1, `expected first full swing to count once, got ${lastMotion.pumpHits}`);
assert.equal(lastMotion.pumpActive, true, "expected first swing to grant immediate propulsion");
assert.equal(lastMotion.boostLocked, false, "expected first swing to stay unlocked");
assert.equal(lastMotion.pumpTriggered, true, "expected first completed swing to emit a one-frame pump trigger");
assert.ok(lastMotion.drive >= 0.6, `expected strong first-swing propulsion, got ${lastMotion.drive}`);

const secondSwing = [
  createSample(230, 1, 1),
  createSample(263, -1, -1)
];

for (const sample of secondSwing) {
  lastMotion = mapper.mapSample(sample);
}

assert.equal(lastMotion.pumpHits, 2, `expected second full swing to reach lock threshold, got ${lastMotion.pumpHits}`);
assert.equal(lastMotion.pumpActive, true, "expected max propulsion lock after second swing");
assert.equal(lastMotion.boostLocked, true, "expected second swing to enable boost lock");
assert.equal(lastMotion.pumpTriggered, true, "expected second completed swing to emit a one-frame pump trigger");
assert.equal(lastMotion.drive, 1, `expected second swing to snap to max propulsion, got ${lastMotion.drive}`);
assert.ok(lastMotion.boostRemainingMs > 9000, `expected near-full lock duration after second swing, got ${lastMotion.boostRemainingMs}`);

let lockedMotion = lastMotion;
for (let index = 1; index <= 260; index += 1) {
  lockedMotion = mapper.mapSample(createSample(263 + index * 33, 0, 0));
}

assert.equal(lockedMotion.pumpActive, true, "expected propulsion lock to remain active during 10-second window");
assert.equal(lockedMotion.boostLocked, true, "expected boost lock to remain active during 10-second window");
assert.equal(lockedMotion.pumpTriggered, false, "expected no repeated pump trigger while no new swing is made");
assert.equal(lockedMotion.drive, 1, `expected full propulsion during lock window, got ${lockedMotion.drive}`);

const boostRemainingBeforeLockedSwing = lockedMotion.boostRemainingMs;
const lockedSwing = [
  createSample(263 + 261 * 33, 1, 1),
  createSample(263 + 262 * 33, -1, -1)
];

for (const sample of lockedSwing) {
  lockedMotion = mapper.mapSample(sample);
}

assert.equal(lockedMotion.boostLocked, true, "expected boost lock to stay active while replaying pole-plant animation");
assert.equal(lockedMotion.pumpTriggered, true, "expected locked-period swing to still emit a one-frame pump trigger for the avatar animation");
assert.equal(lockedMotion.drive, 1, `expected locked-period swing to avoid extra propulsion beyond max drive, got ${lockedMotion.drive}`);
assert.ok(
  lockedMotion.boostRemainingMs < boostRemainingBeforeLockedSwing,
  `expected locked-period swing to keep counting down instead of resetting the 10-second lock, got ${lockedMotion.boostRemainingMs} vs ${boostRemainingBeforeLockedSwing}`
);

let expiredMotion = lockedMotion;
for (let index = 263; index <= 320; index += 1) {
  expiredMotion = mapper.mapSample(createSample(263 + index * 33, 0, 0));
}

assert.equal(expiredMotion.pumpActive, false, "expected propulsion lock to end after 10 seconds");
assert.equal(expiredMotion.boostLocked, false, "expected boost lock to clear after 10 seconds");
assert.equal(expiredMotion.pumpTriggered, false, "expected no stale pump trigger after lock expiry");
assert.ok(expiredMotion.drive <= 0.15, `expected propulsion to decay after lock expiry, got ${expiredMotion.drive}`);

console.log("Pump drive mapping OK");
