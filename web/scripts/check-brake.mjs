import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function compileModule(relativePath) {
  const sourcePath = path.resolve(relativePath);
  const sourceText = await fs.readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-brake-check-"));
  const compiledPath = path.join(tempDir, path.basename(relativePath).replace(/\.ts$/, ".mjs"));
  await fs.writeFile(compiledPath, transpiled.outputText, "utf8");
  return import(pathToFileURL(compiledPath).href);
}

const { MotionMapper } = await compileModule("src/pose/motionMapper.ts");

function joint(x, y, z = 0) {
  return { x, y, z, visible: true };
}

function sample(overrides = {}) {
  return {
    timestampMs: 0,
    dt: 1 / 60,
    hipCenterX: 0.5,
    shoulderCenterX: 0.5,
    kneeRatio: 1,
    confidence: 1,
    legConfidence: 1,
    armConfidence: 1,
    leftShoulder: joint(0.44, 0.34),
    rightShoulder: joint(0.56, 0.34),
    leftElbow: joint(0.39, 0.48),
    rightElbow: joint(0.61, 0.48),
    leftWrist: joint(0.36, 0.62),
    rightWrist: joint(0.64, 0.62),
    ...overrides
  };
}

const mapper = new MotionMapper();

mapper.mapSample(sample({ timestampMs: 0, kneeRatio: 1.0 }));
mapper.mapSample(sample({ timestampMs: 16, kneeRatio: 1.0 }));

const brakingFrames = [
  sample({
    timestampMs: 32,
    shoulderCenterX: 0.42,
    hipCenterX: 0.52,
    kneeRatio: 0.88,
    leftShoulder: joint(0.45, 0.35),
    rightShoulder: joint(0.57, 0.35),
    leftElbow: joint(0.35, 0.52),
    rightElbow: joint(0.69, 0.52),
    leftWrist: joint(0.24, 0.76),
    rightWrist: joint(0.8, 0.76)
  }),
  sample({
    timestampMs: 48,
    shoulderCenterX: 0.41,
    hipCenterX: 0.53,
    kneeRatio: 0.86,
    leftShoulder: joint(0.45, 0.35),
    rightShoulder: joint(0.57, 0.35),
    leftElbow: joint(0.34, 0.54),
    rightElbow: joint(0.7, 0.54),
    leftWrist: joint(0.23, 0.79),
    rightWrist: joint(0.81, 0.79)
  }),
  sample({
    timestampMs: 64,
    shoulderCenterX: 0.41,
    hipCenterX: 0.54,
    kneeRatio: 0.85,
    leftShoulder: joint(0.45, 0.35),
    rightShoulder: joint(0.57, 0.35),
    leftElbow: joint(0.34, 0.55),
    rightElbow: joint(0.7, 0.55),
    leftWrist: joint(0.22, 0.81),
    rightWrist: joint(0.82, 0.81)
  })
];

let brakingState = null;
for (const frame of brakingFrames) {
  brakingState = mapper.mapSample(frame);
}

assert.ok(brakingState !== null);
assert.ok(Math.abs(brakingState.steer) > 0.4, `expected braking gesture to include strong steer, got ${brakingState.steer}`);
assert.ok(brakingState.tuck > 0.15, `expected braking gesture to include half squat, got ${brakingState.tuck}`);
assert.ok(brakingState.brake > 0.55, `expected braking gesture to produce high brake value, got ${brakingState.brake}`);

const relaxedState = mapper.mapSample(
  sample({
    timestampMs: 96,
    shoulderCenterX: 0.49,
    hipCenterX: 0.5,
    kneeRatio: 0.97,
    leftElbow: joint(0.42, 0.44),
    rightElbow: joint(0.58, 0.44),
    leftWrist: joint(0.44, 0.48),
    rightWrist: joint(0.56, 0.48)
  })
);

assert.ok(relaxedState.brake < 0.3, `expected relaxed stance to release brake, got ${relaxedState.brake}`);

console.log("Brake gesture mapping OK");
