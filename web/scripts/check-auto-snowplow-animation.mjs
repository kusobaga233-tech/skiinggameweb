import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/sceneBuilder.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const brakePoseBlend = clamp01(brakeBlend * 1.35);"),
  "expected auto snowplow brake blend to be amplified into a clearly visible animation layer"
);

assert.ok(
  sourceText.includes("rotation.z += side * 0.58 * brakeBlend;"),
  "expected upper arms to flare more strongly during snowplow"
);

assert.ok(
  sourceText.includes("rotation.y += side * 0.34 * brakeBlend;"),
  "expected skis to yaw outward more clearly during snowplow"
);

console.log("Auto snowplow animation OK");
