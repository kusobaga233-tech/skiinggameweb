import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const motionMapperSource = await fs.readFile(path.resolve("src/pose/motionMapper.ts"), "utf8");

assert.ok(
  motionMapperSource.includes("const shoulderSpan = Math.max(Math.abs(sample.rightShoulder.x - sample.leftShoulder.x), 1e-4);"),
  "expected steer lean to normalize against shoulder span for left/right symmetry"
);

assert.ok(
  motionMapperSource.includes("const lean = (sample.shoulderCenterX - sample.hipCenterX) / shoulderSpan;"),
  "expected steering lean to be based on shoulder-vs-hip offset normalized by body width"
);

assert.ok(
  motionMapperSource.includes("steerBaselineAlpha: 0.06,"),
  "expected baseline lean calibration to adapt faster to the user's neutral stance"
);

console.log("Steer symmetry normalization OK");
