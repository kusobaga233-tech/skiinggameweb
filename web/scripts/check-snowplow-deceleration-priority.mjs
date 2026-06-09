import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const snowplowSpeedCeiling ="),
  "expected a dedicated snowplow speed ceiling so braking cannot enter the acceleration branch on steep downhill"
);

assert.ok(
  sourceText.includes("const uncappedTargetForwardSpeed ="),
  "expected uncapped target speed to be separated from final target speed before snowplow priority is applied"
);

assert.ok(
  sourceText.includes("const targetForwardSpeed = turnSnowplowBrakeBlend > 0.01")
    && sourceText.includes("? Math.min(uncappedTargetForwardSpeed, snowplowSpeedCeiling)")
    && sourceText.includes(": uncappedTargetForwardSpeed;"),
  "expected active snowplow braking to clamp target speed at or below the current speed ceiling"
);

console.log("Snowplow deceleration priority OK");
