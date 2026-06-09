import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/sceneBuilder.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("applyForwardCrouchAdjustments(part.mesh, position, rotation, poseBlend, brakePoseBlend);"),
  "expected a dedicated forward-lean adjustment layer for glide/tuck/snowplow crouch poses"
);

assert.ok(
  sourceText.includes("rotation.x -= forwardLeanBlend * 0.12;"),
  "expected torso/chest to pitch forward during the half-crouch base pose"
);

assert.ok(
  sourceText.includes("position.z += forwardLeanBlend * 0.06;"),
  "expected the upper body center to shift forward during crouch"
);

console.log("Forward lean crouch OK");
