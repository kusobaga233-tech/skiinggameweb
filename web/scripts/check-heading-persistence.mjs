import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("movementHeadingYaw"),
  "expected persistent movement heading state"
);

assert.ok(
  sourceText.includes("this.updateMovementHeading(dt, groundedForCarve);"),
  "expected steering to update heading before movement integration"
);

assert.ok(
  sourceText.includes("this.updateCarvingVelocity(")
    && sourceText.includes("this.velocity.x * dt")
    && sourceText.includes("this.velocity.z * dt"),
  "expected movement to integrate along carving velocity driven by persistent heading"
);

assert.ok(
  !sourceText.includes("this.skier.position.z += this.currentForwardSpeed * dt;"),
  "expected old fixed-z forward integration to be replaced"
);

assert.ok(
  !sourceText.includes("this.skier.position.x + -this.currentSteer * lateralSpeed * dt"),
  "expected old direct lateral strafe integration to be replaced"
);

assert.ok(
  sourceText.includes("this.skier.rotation.y,")
    && sourceText.includes("this.movementHeadingYaw"),
  "expected avatar visual yaw to follow persistent movement heading"
);

console.log("Heading persistence movement check OK");
