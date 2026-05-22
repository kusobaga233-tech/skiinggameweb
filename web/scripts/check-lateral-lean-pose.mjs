import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(
  sceneBuilderSource.includes("applyPose(tuck: number, glide = 0, carve = 0, turnBlend = 0, lateralLean = 0, pumpBlend = 0): void"),
  "expected avatar rig pose API to accept a dedicated lateral-lean blend"
);

assert.ok(
  sceneBuilderSource.includes("applyLateralLeanAdjustments(part.mesh, position, rotation, lateralLeanClamped, lateralLeanBlend);"),
  "expected avatar pose pipeline to apply a lateral-lean adjustment pass"
);

assert.ok(
  sceneBuilderSource.includes("rotation.z += lateralLean * 0.3490658503988659 * lateralLeanBlend;"),
  "expected torso/head lean to reach about 20 degrees at full lateral-lean input"
);

assert.ok(
  skierControllerSource.includes("const lateralLean = this.evaluateLateralLean();"),
  "expected skier controller to compute a dedicated lateral lean signal from side movement"
);

assert.ok(
  skierControllerSource.includes("this.skierAvatarRig.applyPose(this.currentTuck, glidePoseBlend, carveIntent, animationTurnBlend, lateralLean, pumpPoseBlend);"),
  "expected active gameplay pose application to include lateral lean"
);

console.log("Lateral lean pose check OK");
