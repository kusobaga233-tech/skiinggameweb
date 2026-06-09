import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const motionMapperSource = await fs.readFile(path.resolve("src/pose/motionMapper.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(
  motionMapperSource.includes("steerDeadzone: 0.035"),
  "expected motion mapper to define a neutral steer deadzone"
);

assert.ok(
  motionMapperSource.includes("private baselineLeanOffset = 0;"),
  "expected motion mapper to keep a baseline lean offset"
);

assert.ok(
  motionMapperSource.includes("const leanDelta = lean - this.baselineLeanOffset;"),
  "expected steering to be computed from lean relative to baseline"
);

assert.ok(
  motionMapperSource.includes("const deadzonedLean = Math.abs(leanDelta) <= this.config.steerDeadzone"),
  "expected steering to apply a deadzone around the neutral stance"
);

assert.ok(
  skierControllerSource.includes("const steerTarget = movementEnabled && motion.tracking ? this.clamp(motion.steer * 2.15, -1, 1) : 0;"),
  "expected skier controller to ignore steering input before the run actually starts"
);

console.log("Start steer neutral check OK");
