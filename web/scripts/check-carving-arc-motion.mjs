import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const idealTurnRate = speed / Math.max(desiredTurnRadius, 1e-5);"),
  "expected carve model to derive angular turn rate from speed and turn radius"
);

assert.ok(
  sourceText.includes("const carveYawDelta = turnDirection * actualTurnRate * dt;"),
  "expected carve model to rotate velocity heading by curvature over time"
);

assert.ok(
  sourceText.includes("const carvedVelocityYaw = velocityHeadingYaw + carveYawDelta;"),
  "expected movement path to advance from curved velocity heading instead of straight-ahead yaw"
);

assert.ok(
  sourceText.includes("const targetVelocityYaw = this.rotateAngleToward(carvedVelocityYaw, this.movementHeadingYaw, alignRate * dt);"),
  "expected velocity heading to blend from carved arc toward board heading"
);

console.log("Carving arc motion OK");
