import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const gameAppSource = await fs.readFile(path.resolve("src/game/gameApp.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(
  gameAppSource.includes("poseSteerScale?: number"),
  "expected GameApp to accept poseSteerScale runtime tuning"
);

assert.ok(
  skierControllerSource.includes("motion.source === \"pose\" ? this.poseSteerScale : 1"),
  "expected SkierController to scale pose steering separately from keyboard steering"
);

assert.ok(
  !skierControllerSource.includes("motion.steer * 1.75"),
  "expected hard-coded pose steer amplification to be removed"
);

console.log("Body steer gameplay scale wiring OK");
