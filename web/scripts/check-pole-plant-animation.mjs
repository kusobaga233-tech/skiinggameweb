import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");
const gameAppSource = await fs.readFile(path.resolve("src/game/gameApp.ts"), "utf8");

assert.ok(
  sceneBuilderSource.includes("applyPose(tuck: number, glide = 0, carve = 0, turnBlend = 0, lateralLean = 0, pumpBlend = 0, brakeBlend = 0, edgeHold = 0, driftSlip = 0)"),
  "expected avatar rig pose API to accept a pump-blend input"
);

assert.ok(
  sceneBuilderSource.includes("applyPumpAdjustments("),
  "expected skier avatar to have explicit pole-plant pose adjustments"
);

assert.ok(
  skierControllerSource.includes("pumpPoseTimer"),
  "expected skier controller to track a short-lived pump pose timer"
);

assert.ok(
  skierControllerSource.includes("motion.pumpTriggered"),
  "expected skier controller to react to one-frame pump triggers instead of only sustained pump state"
);

assert.ok(
  skierControllerSource.includes("playPolePlantAnimation(): void"),
  "expected skier controller to expose an explicit one-shot pole-plant animation trigger"
);

assert.ok(
  gameAppSource.includes("this.skierController.playPolePlantAnimation();"),
  "expected start pole-plant success to play one full avatar pole-plant animation"
);

console.log("Pole plant animation hook OK");
