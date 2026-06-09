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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-pose-snowplow-check-"));
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

function rightHandDown(timestampMs, overrides = {}) {
  return sample(timestampMs, {
    rightElbow: joint(0.63, 0.54, -0.04),
    rightWrist: joint(0.69, 0.74, 0.04),
    ...overrides
  });
}

function leftHandDown(timestampMs, overrides = {}) {
  return sample(timestampMs, {
    leftElbow: joint(0.37, 0.54, -0.04),
    leftWrist: joint(0.31, 0.74, 0.04),
    ...overrides
  });
}

const leftTurnMapper = new MotionMapper();
let leftTurnMotion = leftTurnMapper.mapSample(sample(0));
for (let index = 1; index <= 6; index += 1) {
  leftTurnMotion = leftTurnMapper.mapSample(
    rightHandDown(index * 33, {
      shoulderCenterX: 0.58,
      hipCenterX: 0.5
    })
  );
}

assert.ok(leftTurnMotion.steer > 0.35, `expected body lean to produce left steer, got ${leftTurnMotion.steer}`);
assert.ok(Math.abs(leftTurnMotion.snowplow) < 0.08, `expected hand-down scrape input to stay disabled, got ${leftTurnMotion.snowplow}`);

const rightTurnMapper = new MotionMapper();
let rightTurnMotion = rightTurnMapper.mapSample(sample(0));
for (let index = 1; index <= 6; index += 1) {
  rightTurnMotion = rightTurnMapper.mapSample(
    leftHandDown(index * 33, {
      shoulderCenterX: 0.42,
      hipCenterX: 0.5
    })
  );
}

assert.ok(rightTurnMotion.steer < -0.35, `expected body lean to produce right steer, got ${rightTurnMotion.steer}`);
assert.ok(Math.abs(rightTurnMotion.snowplow) < 0.08, `expected hand-down scrape input to stay disabled, got ${rightTurnMotion.snowplow}`);

const oppositeMapper = new MotionMapper();
let oppositeMotion = oppositeMapper.mapSample(sample(0));
for (let index = 1; index <= 6; index += 1) {
  oppositeMotion = oppositeMapper.mapSample(
    leftHandDown(index * 33, {
      shoulderCenterX: 0.58,
      hipCenterX: 0.5
    })
  );
}

assert.ok(oppositeMotion.steer > 0.2, `expected body lean to still steer, got ${oppositeMotion.steer}`);
assert.ok(Math.abs(oppositeMotion.snowplow) < 0.08, `expected opposite hand down to keep snowplow disabled, got ${oppositeMotion.snowplow}`);

console.log("Pose snowplow input disabled OK");
