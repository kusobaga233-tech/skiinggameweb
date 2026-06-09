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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-body-steer-curve-check-"));
const compiledPath = path.join(tempDir, "motionMapper.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { MotionMapper } = await import(pathToFileURL(compiledPath).href);

function joint(x, y, z, visible = true) {
  return { x, y, z, visible };
}

function createSample(timestampMs, shoulderCenterX) {
  const shoulderHalfSpan = 0.1;
  return {
    timestampMs,
    dt: 1 / 30,
    hipCenterX: 0.5,
    hipCenterY: 0.62,
    shoulderCenterX,
    shoulderCenterY: 0.38,
    kneeRatio: 1,
    confidence: 1,
    legConfidence: 1,
    armConfidence: 1,
    leftShoulder: joint(shoulderCenterX - shoulderHalfSpan, 0.38, -0.15),
    rightShoulder: joint(shoulderCenterX + shoulderHalfSpan, 0.38, -0.15),
    leftElbow: joint(shoulderCenterX - 0.12, 0.49, -0.08),
    rightElbow: joint(shoulderCenterX + 0.12, 0.49, -0.08),
    leftWrist: joint(shoulderCenterX - 0.15, 0.57, -0.02),
    rightWrist: joint(shoulderCenterX + 0.15, 0.57, -0.02)
  };
}

const mapper = new MotionMapper({
  steerGain: 5.2,
  steerDeadzone: 0.04,
  steerAlpha: 1,
  steerBaselineAlpha: 0
});

for (let index = 0; index < 6; index += 1) {
  mapper.mapSample(createSample(index * 33, 0.5));
}

const smallLean = mapper.mapSample(createSample(200, 0.52));
const largeLean = mapper.mapSample(createSample(233, 0.56));

assert.ok(
  Math.abs(smallLean.steer) < 0.2,
  `expected small body lean to stay in a soft steering range, got ${smallLean.steer.toFixed(3)}`
);
assert.ok(
  Math.abs(largeLean.steer) > 0.9,
  `expected strong body lean to still reach near-max steering, got ${largeLean.steer.toFixed(3)}`
);

console.log("Body steer curve mapping OK");
