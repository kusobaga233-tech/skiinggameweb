import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  !sourceText.includes("const proposedX = courseCenterX + this.lateralOffset;"),
  "skier x position still auto-follows course centerline"
);

assert.ok(
  !sourceText.includes("const courseYaw = Math.atan2(tangent.x, tangent.z);"),
  "skier visual heading still auto-follows course tangent"
);

assert.ok(
  !sourceText.includes("const azimuth = -Math.atan2(tangent.z, tangent.x) + Math.PI * 0.5;"),
  "camera alpha still auto-follows course tangent"
);

assert.ok(
  sourceText.includes("private evaluateRoutePreviewBias"),
  "expected route preview bias helper for route-based yaw"
);

assert.ok(
  sourceText.includes("routePreviewBias"),
  "expected route preview bias to drive skier/camera turning"
);

assert.ok(
  sourceText.includes("private evaluateCameraHeadingBias"),
  "expected camera heading bias helper for player-centric camera steering"
);

assert.ok(
  sourceText.includes("cameraHeadingBias"),
  "expected camera heading bias to affect camera yaw/target"
);

assert.ok(
  sourceText.includes("playerTarget"),
  "expected playerTarget camera anchor for keeping player centered"
);

console.log("Steering behavior check OK");
