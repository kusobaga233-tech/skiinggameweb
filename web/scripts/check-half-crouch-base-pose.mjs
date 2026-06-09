import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/sceneBuilder.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const glideBaseBlend = clamp01(glide) * 0.5;"),
  "expected movement glide to provide a half-crouch base pose"
);

assert.ok(
  sourceText.includes("const brakeCrouchBlend = clamp01(brakeBlend) * 0.24;"),
  "expected snowplow to deepen the crouch on top of the moving base pose"
);

assert.ok(
  sourceText.includes("const poseBlend = clamp01(Math.max(glideBaseBlend, blend, glideBaseBlend + brakeCrouchBlend));"),
  "expected tuck and snowplow to transition from the half-crouch movement pose instead of standing upright"
);

console.log("Half crouch base pose OK");
