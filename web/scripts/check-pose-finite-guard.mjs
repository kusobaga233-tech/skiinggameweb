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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-pose-finite-check-"));
const compiledPath = path.join(tempDir, "motionMapper.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { MotionMapper } = await import(pathToFileURL(compiledPath).href);

function joint(x, y, z, visible = true) {
  return { x, y, z, visible };
}

function createSample(timestampMs, overrides = {}) {
  return {
    timestampMs,
    dt: 1 / 30,
    hipCenterX: 0.5,
    hipCenterY: 0.62,
    shoulderCenterX: 0.5,
    shoulderCenterY: 0.38,
    kneeRatio: 1,
    confidence: 1,
    legConfidence: 1,
    armConfidence: 1,
    leftShoulder: joint(0.42, 0.38, -0.15),
    rightShoulder: joint(0.58, 0.38, -0.15),
    leftElbow: joint(0.4, 0.49, -0.08),
    rightElbow: joint(0.6, 0.49, -0.08),
    leftWrist: joint(0.37, 0.57, -0.02),
    rightWrist: joint(0.63, 0.57, -0.02),
    ...overrides
  };
}

function assertFiniteMotion(motion, label) {
  for (const key of ["steer", "snowplow", "tuck", "brake", "drive", "confidence", "boostRemainingMs"]) {
    assert.ok(Number.isFinite(motion[key]), `${label}: expected finite ${key}, got ${motion[key]}`);
  }
}

const mapper = new MotionMapper();
for (let frame = 0; frame < 8; frame += 1) {
  assertFiniteMotion(mapper.mapSample(createSample(frame * 33)), "warmup");
}

const dirtyMotion = mapper.mapSample(createSample(300, {
  hipCenterX: Number.NaN,
  shoulderCenterX: Number.POSITIVE_INFINITY,
  shoulderCenterY: undefined,
  kneeRatio: Number.NaN,
  leftShoulder: joint(Number.NaN, 0.38, -0.15),
  rightShoulder: joint(0.58, Number.POSITIVE_INFINITY, -0.15),
  leftElbow: joint(0.4, 0.49, Number.NaN),
  rightElbow: joint(0.6, 0.49, -0.08),
  leftWrist: joint(undefined, 0.57, -0.02),
  rightWrist: joint(0.63, 0.57, Number.NEGATIVE_INFINITY)
}));

assertFiniteMotion(dirtyMotion, "dirty pose sample");
assert.equal(dirtyMotion.tracking, false, "dirty pose sample should be treated as tracking lost");

const recoveredMotion = mapper.mapSample(createSample(333));
assertFiniteMotion(recoveredMotion, "recovered pose sample");

console.log("Pose finite guard OK");
