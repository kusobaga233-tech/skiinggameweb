import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(
  sceneBuilderSource.includes("applyPose(tuck: number, glide = 0, carve = 0, turnBlend = 0, lateralLean = 0, pumpBlend = 0, brakeBlend = 0, edgeHold = 0, driftSlip = 0): void"),
  "expected avatar rig pose API to accept a dedicated glide-pose blend"
);

assert.ok(
  sceneBuilderSource.includes("const poseBlend = Math.max(blend, clamp01(glide) * 0.34);"),
  "expected glide blend to add a lighter moving stance than full tuck"
);

assert.ok(
  skierControllerSource.includes("private readonly glidePoseSpeedStart = 4;"),
  "expected skier controller to define the minimum speed for glide pose activation"
);

assert.ok(
  skierControllerSource.includes("private readonly glidePoseSpeedFull = 22;"),
  "expected skier controller to define the speed where glide pose reaches full visual weight"
);

assert.ok(
  skierControllerSource.includes("const glidePoseBlend = this.evaluateGlidePoseBlend(movementEnabled);"),
  "expected skier controller to compute a speed-driven glide pose blend"
);

assert.ok(
  skierControllerSource.includes("this.skierAvatarRig.applyPose("),
  "expected active gameplay pose application to include glide pose blend"
);

console.log("Glide pose check OK");
