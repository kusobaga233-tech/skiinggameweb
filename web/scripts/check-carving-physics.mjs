import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("private velocity = new Vector3"),
  "expected skier controller to keep an explicit velocity vector for carving physics"
);

assert.ok(
  sourceText.includes("private driftSlip = 0;"),
  "expected drift slip state for oversteer and snowplow"
);

assert.ok(
  sourceText.includes("private edgeHold = 0;"),
  "expected edge hold state for ski grip"
);

assert.ok(
  sourceText.includes("this.updateCarvingVelocity("),
  "expected a dedicated carving velocity update step"
);

assert.ok(
  sourceText.includes("const availableLateralGrip")
    && sourceText.includes("const requiredLateralGrip"),
  "expected carve model to compare required vs available lateral grip"
);

assert.ok(
  sourceText.includes("velocityHeadingYaw")
    && sourceText.includes("headingError"),
  "expected carve model to track board heading vs velocity heading"
);

assert.ok(
  sourceText.includes("this.velocity.x * dt")
    && sourceText.includes("this.velocity.z * dt"),
  "expected position integration to come from velocity vector"
);

assert.ok(
  sourceText.includes("this.edgeHold") && sourceText.includes("this.driftSlip"),
  "expected carve presentation to react to edge hold and drift slip"
);

console.log("Carving physics structure OK");
