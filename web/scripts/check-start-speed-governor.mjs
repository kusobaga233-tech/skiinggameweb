import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const source = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(
  source.includes("this.startSpeedLimit = config.startSpeedLimit ?? 18;"),
  "expected a low 90-cap start speed limit to prevent launch acceleration"
);
assert.ok(
  source.includes("private readonly startSpeedReleaseZ = 180;"),
  "expected start speed limit to release over an early course distance"
);
assert.ok(
  source.includes("const startSpeedLimit = this.evaluateStartSpeedLimit(this.skier.position.z);"),
  "expected target speed to consider the start speed governor"
);
assert.ok(
  source.includes("Math.min(slopeAdjustedSpeed, startSpeedLimit)"),
  "expected slope/drive target speed to be capped by the start governor"
);
assert.ok(
  source.includes("private evaluateStartSpeedLimit(z: number): number"),
  "expected a dedicated start speed governor helper"
);

console.log("Start speed governor OK");
