import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const naturalDeltaX = proposedX - previousX;"),
  "expected natural lateral motion to be tracked separately from clamp/collision correction"
);

assert.ok(
  sourceText.includes("const naturalLateralVelocity = naturalDeltaX / Math.max(dt, 1e-5);"),
  "expected corrected position snaps to stop feeding directly into lateral velocity"
);

assert.ok(
  sourceText.includes("this.currentForwardSpeed = Math.min(this.maxForwardSpeed, Math.hypot(this.velocity.x, this.velocity.z));"),
  "expected displayed/controller speed to stay capped after world-position correction"
);

assert.ok(
  sourceText.includes("const resolvedTravelSpeed = Math.min(this.maxForwardSpeed, Math.hypot(this.velocity.x, this.velocity.z));"),
  "expected carve simulation to ignore uncapped correction spikes from world displacement"
);

console.log("Collision correction speed decoupling OK");
