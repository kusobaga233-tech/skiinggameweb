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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-tuck-relaxed-check-"));
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
    shoulderCenterX: 0.5,
    hipCenterY: 0.62,
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

function warmNeutral(mapper, startFrame = 0) {
  let motion = mapper.mapSample(createSample(startFrame * 33));
  for (let index = startFrame + 1; index <= startFrame + 8; index += 1) {
    motion = mapper.mapSample(createSample(index * 33));
  }
  return motion;
}

function runFrames(mapper, startFrame, frameCount, overrides) {
  let motion;
  for (let index = startFrame; index < startFrame + frameCount; index += 1) {
    motion = mapper.mapSample(createSample(index * 33, overrides));
  }
  return motion;
}

{
  const mapper = new MotionMapper();
  warmNeutral(mapper);
  const motion = runFrames(mapper, 9, 8, { kneeRatio: 0.955 });
  assert.ok(
    motion.tuck >= 0.2,
    `expected relaxed knee bend to trigger usable tuck, got ${motion.tuck.toFixed(2)}`
  );
}

{
  const mapper = new MotionMapper();
  warmNeutral(mapper);
  const motion = runFrames(mapper, 9, 8, {
    leftElbow: joint(0.4, 0.34, -0.35),
    rightElbow: joint(0.6, 0.34, -0.35),
    leftWrist: joint(0.37, 0.3, -0.42),
    rightWrist: joint(0.63, 0.3, -0.42)
  });
  assert.ok(
    motion.tuck <= 0.03,
    `expected pole/pump arm motion without knee bend not to trigger tuck, got ${motion.tuck.toFixed(2)}`
  );
}

{
  const mapper = new MotionMapper();
  warmNeutral(mapper);
  const motion = runFrames(mapper, 9, 8, {
    hipCenterX: 0.5,
    shoulderCenterX: 0.6
  });
  assert.ok(
    motion.tuck <= 0.03,
    `expected body lean steering without knee bend not to trigger tuck, got ${motion.tuck.toFixed(2)}`
  );
}

console.log("Relaxed tuck detection OK");
