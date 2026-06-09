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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-pole-plant-steering-check-"));
const compiledPath = path.join(tempDir, "motionMapper.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { MotionMapper } = await import(pathToFileURL(compiledPath).href);

function joint(x, y, z, visible = true) {
  return { x, y, z, visible };
}

function sample(timestampMs, pose = {}) {
  const neutral = {
    timestampMs,
    dt: 1 / 30,
    hipCenterX: 0.5,
    shoulderCenterX: 0.5,
    kneeRatio: 1,
    confidence: 1,
    legConfidence: 1,
    armConfidence: 1,
    leftShoulder: joint(0.42, 0.38, -0.15),
    rightShoulder: joint(0.58, 0.38, -0.15),
    leftElbow: joint(0.4, 0.49, -0.08),
    rightElbow: joint(0.6, 0.49, -0.08),
    leftWrist: joint(0.37, 0.57, -0.02),
    rightWrist: joint(0.63, 0.57, -0.02)
  };

  return { ...neutral, ...pose };
}

function leftPolePlant(timestampMs, overrides = {}) {
  return sample(timestampMs, {
    leftElbow: joint(0.37, 0.54, -0.04),
    leftWrist: joint(0.31, 0.74, 0.04),
    ...overrides
  });
}

function rightPolePlant(timestampMs, overrides = {}) {
  return sample(timestampMs, {
    rightElbow: joint(0.63, 0.54, -0.04),
    rightWrist: joint(0.69, 0.74, 0.04),
    ...overrides
  });
}

function doublePolePlant(timestampMs, overrides = {}) {
  return sample(timestampMs, {
    leftElbow: joint(0.37, 0.54, -0.04),
    rightElbow: joint(0.63, 0.54, -0.04),
    leftWrist: joint(0.31, 0.74, 0.04),
    rightWrist: joint(0.69, 0.74, 0.04),
    ...overrides
  });
}

function leftHandUp(timestampMs) {
  return sample(timestampMs, {
    leftElbow: joint(0.37, 0.3, -0.02),
    leftWrist: joint(0.31, 0.16, 0.08)
  });
}

function rightHandUp(timestampMs) {
  return sample(timestampMs, {
    rightElbow: joint(0.63, 0.3, -0.02),
    rightWrist: joint(0.69, 0.16, 0.08)
  });
}

const leftMapper = new MotionMapper();
let leftMotion = leftMapper.mapSample(sample(0));
for (let index = 1; index <= 4; index += 1) {
  leftMotion = leftMapper.mapSample(leftPolePlant(index * 33));
}

assert.ok(
  Math.abs(leftMotion.steer) < 0.08,
  `expected left single-hand pole plant alone to avoid steering, got ${leftMotion.steer.toFixed(3)}`
);

assert.ok(
  Math.abs(leftMotion.snowplow) < 0.08,
  `expected left single-hand pole plant alone to avoid snowplow, got ${leftMotion.snowplow.toFixed(3)}`
);

const rightMapper = new MotionMapper();
let rightMotion = rightMapper.mapSample(sample(0));
for (let index = 1; index <= 4; index += 1) {
  rightMotion = rightMapper.mapSample(rightPolePlant(index * 33));
}

assert.ok(
  Math.abs(rightMotion.steer) < 0.08,
  `expected right single-hand pole plant alone to avoid steering, got ${rightMotion.steer.toFixed(3)}`
);

assert.ok(
  Math.abs(rightMotion.snowplow) < 0.08,
  `expected right single-hand pole plant alone to avoid snowplow, got ${rightMotion.snowplow.toFixed(3)}`
);

const doubleMapper = new MotionMapper();
let doubleMotion = doubleMapper.mapSample(sample(0));
for (let index = 1; index <= 4; index += 1) {
  doubleMotion = doubleMapper.mapSample(doublePolePlant(index * 33));
}

assert.ok(
  Math.abs(doubleMotion.steer) < 0.08,
  `expected symmetric double pole plant to stay directionally neutral, got ${doubleMotion.steer.toFixed(3)}`
);

assert.ok(
  Math.abs(doubleMotion.snowplow) < 0.08,
  `expected symmetric double pole plant to avoid directional snowplow, got ${doubleMotion.snowplow.toFixed(3)}`
);

const leftUpMapper = new MotionMapper();
let leftUpMotion = leftUpMapper.mapSample(sample(0));
for (let index = 1; index <= 4; index += 1) {
  leftUpMotion = leftUpMapper.mapSample(leftHandUp(index * 33));
}

assert.ok(
  Math.abs(leftUpMotion.steer) < 0.08,
  `expected raised left hand to avoid pole-plant steer, got ${leftUpMotion.steer.toFixed(3)}`
);

const rightUpMapper = new MotionMapper();
let rightUpMotion = rightUpMapper.mapSample(sample(0));
for (let index = 1; index <= 4; index += 1) {
  rightUpMotion = rightUpMapper.mapSample(rightHandUp(index * 33));
}

assert.ok(
  Math.abs(rightUpMotion.steer) < 0.08,
  `expected raised right hand to avoid pole-plant steer, got ${rightUpMotion.steer.toFixed(3)}`
);

console.log("Pole plant directional gating OK");
