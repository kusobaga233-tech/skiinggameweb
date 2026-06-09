import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("private readonly wallCollisionSpeedRetention = 0.5;"),
  "expected a wall collision speed retention constant of 50%"
);

assert.ok(
  sourceText.includes("private wallCollisionLatched = false;"),
  "expected wall collision halving to use a latch so scraping does not retrigger every frame"
);

assert.ok(
  sourceText.includes("const unclampedProposedX = this.skier.position.x + this.velocity.x * dt;"),
  "expected wall collision detection to retain the raw pre-clamp lateral target"
);

assert.ok(
  sourceText.includes("const wallCollisionDetected = Math.abs(finalX - unclampedProposedX) > 1e-4;"),
  "expected wall collision detection to compare final corrected X against the raw unclamped target so lane-edge hits count"
);

assert.ok(
  sourceText.includes("if (wallCollisionDetected && !this.wallCollisionLatched) {"),
  "expected first wall contact to trigger a one-shot speed reduction"
);

assert.ok(
  sourceText.includes("this.currentForwardSpeed *= this.wallCollisionSpeedRetention;"),
  "expected wall contact to halve current forward speed"
);

assert.ok(
  sourceText.includes("this.velocity.scaleInPlace(this.wallCollisionSpeedRetention);"),
  "expected wall contact to halve the active velocity vector as well"
);

console.log("Wall collision speed halving OK");
