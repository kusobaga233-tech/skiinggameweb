import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const neutralReturnBlend = this.evaluateNeutralReturnBlend();"),
  "expected heading update to compute neutral recenter blend"
);

assert.ok(
  sourceText.includes("this.movementHeadingYaw = this.lerp(this.movementHeadingYaw, 0, neutralReturnRate * dt);"),
  "expected heading to ease back toward center when steer input is released"
);

assert.ok(
  sourceText.includes("const steerTurnDirection = Math.sign(this.currentSteer);"),
  "expected carve turn direction to derive only from active steer input"
);

assert.ok(
  sourceText.includes("const turnDirection = steerTurnDirection === 0 ? 0 : -steerTurnDirection;"),
  "expected carved yaw to stop inheriting the old turn sign once steer input drops to neutral"
);

console.log("Turn recovery neutral behavior OK");
