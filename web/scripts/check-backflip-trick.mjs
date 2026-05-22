import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("private readonly stuntSpeedThreshold = 45;"),
  "expected a 45-speed threshold before auto-triggering jump-ramp stunt"
);

assert.ok(
  sourceText.includes("private startRampStunt("),
  "expected a dedicated ramp stunt start helper"
);

assert.ok(
  sourceText.includes("this.startRampStunt(this.currentForwardSpeed, this.verticalVelocity);"),
  "expected ramp launch branch to trigger the stunt helper when leaving a jump ramp"
);

assert.ok(
  sourceText.includes("private updateRampStunt("),
  "expected a dedicated airborne stunt update helper"
);

assert.ok(
  sourceText.includes("this.stuntRotationX = easedProgress * Math.PI * 2;"),
  "expected stunt rotation to cover a full 360-degree backflip"
);

assert.ok(
  sourceText.includes("this.skier.rotation.x = basePitch + this.stuntRotationX;"),
  "expected visual heading to apply the full-body stunt rotation while airborne"
);

console.log("Backflip stunt hook OK");
