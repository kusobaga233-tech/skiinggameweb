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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-tuck-detection-check-"));
const compiledPath = path.join(tempDir, "motionMapper.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { MotionMapper } = await import(pathToFileURL(compiledPath).href);

function joint(x, y, z, visible = true) {
  return { x, y, z, visible };
}

function createSample(timestampMs, kneeRatio, confidence = 1, legConfidence = confidence, overrides = {}) {
  return {
    timestampMs,
    dt: 1 / 30,
    hipCenterX: 0.5,
    shoulderCenterX: 0.5,
    hipCenterY: 0.62,
    shoulderCenterY: 0.38,
    kneeRatio,
    confidence,
    legConfidence,
    armConfidence: confidence,
    leftShoulder: joint(0.42, 0.38, -0.15),
    rightShoulder: joint(0.58, 0.38, -0.15),
    leftElbow: joint(0.4, 0.49, -0.08),
    rightElbow: joint(0.6, 0.49, -0.08),
    leftWrist: joint(0.37, 0.57, -0.02),
    rightWrist: joint(0.63, 0.57, -0.02),
    ...overrides
  };
}

const mapper = new MotionMapper();

let motion = mapper.mapSample(createSample(0, 1));
for (let index = 1; index <= 6; index += 1) {
  motion = mapper.mapSample(createSample(index * 33, 1));
}

assert.ok(motion.tuck <= 0.01, `expected neutral stance to stay near zero tuck, got ${motion.tuck.toFixed(2)}`);

for (let index = 7; index <= 14; index += 1) {
  motion = mapper.mapSample(createSample(index * 33, 0.965));
}

assert.ok(
  motion.tuck <= 0.08,
  `expected slight knee compression without a real crouch to avoid tuck boost, got ${motion.tuck.toFixed(2)}`
);

for (let index = 15; index <= 22; index += 1) {
  motion = mapper.mapSample(createSample(index * 33, 0.78, 1, 0));
}

assert.ok(
  motion.tuck <= 0.05,
  `expected upper-body-only neutral stance to avoid tuck boost, got ${motion.tuck.toFixed(2)}`
);

for (let index = 23; index <= 32; index += 1) {
  motion = mapper.mapSample(createSample(index * 33, 0.98, 1, 0, {
    shoulderCenterY: 0.49,
    leftShoulder: joint(0.42, 0.49, -0.15),
    rightShoulder: joint(0.58, 0.49, -0.15),
    leftElbow: joint(0.4, 0.58, -0.08),
    rightElbow: joint(0.6, 0.58, -0.08),
    leftWrist: joint(0.37, 0.66, -0.02),
    rightWrist: joint(0.63, 0.66, -0.02)
  }));
}

assert.ok(
  motion.tuck >= 0.35,
  `expected upper-body fallback crouch to provide tuck boost when legs are unavailable, got ${motion.tuck.toFixed(2)}`
);

for (let index = 33; index <= 42; index += 1) {
  motion = mapper.mapSample(createSample(index * 33, 0.79));
}

assert.ok(motion.tuck >= 0.75, `expected clear crouch to still register strongly, got ${motion.tuck.toFixed(2)}`);

for (let index = 43; index <= 343; index += 1) {
  motion = mapper.mapSample(createSample(index * 33, 0.79));
}

assert.ok(
  motion.tuck >= 0.7,
  `expected sustained crouch to remain active instead of being absorbed into baseline, got ${motion.tuck.toFixed(2)}`
);

console.log("Tuck detection OK");
