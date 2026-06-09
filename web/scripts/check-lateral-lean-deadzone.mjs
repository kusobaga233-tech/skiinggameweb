import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const movementLeanRaw = this.lastLateralVelocity / 8.2;"),
  "expected lateral lean to derive movement lean from lateral velocity before deadzoning"
);

assert.ok(
  sourceText.includes("const movementLean = Math.abs(movementLeanRaw) < 0.12 ? 0 : this.clamp(movementLeanRaw, -1, 1);"),
  "expected a deadzone on small lateral-velocity residue so the avatar stays centered"
);

assert.ok(
  sourceText.includes("const edgeLeanRaw = -this.currentSteer * (0.28 + this.edgeHold * 0.56);"),
  "expected steer-driven lean amplitude to be reduced from the overly sensitive tuning"
);

assert.ok(
  sourceText.includes("const edgeLean = Math.abs(edgeLeanRaw) < 0.08 ? 0 : this.clamp(edgeLeanRaw, -1, 1);"),
  "expected a deadzone on tiny steer bias so the avatar does not keep tipping to one side"
);

console.log("Lateral lean deadzone OK");
