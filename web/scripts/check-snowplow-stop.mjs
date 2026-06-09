import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

function readDefaultNumber(name) {
  const match = sourceText.match(new RegExp(`this\\.${name} = config\\.${name} \\?\\? ([0-9.]+);`));
  assert.ok(match, `expected configurable tuning default ${name}`);
  return Number(match[1]);
}

assert.ok(
  sourceText.includes("const minTargetSpeed = turnSnowplowBrakeBlend > 0.01 ? 0 : this.minForwardSpeed;"),
  "expected snowplow braking to allow target speed to reach 0"
);
assert.ok(
  sourceText.includes("const snowplowStopResponse = this.lerp(this.snowplowStopResponseMin, this.snowplowStopResponseMax, turnSnowplowBrakeBlend);"),
  "expected dedicated snowplow stop response instead of terrain glide response"
);
assert.ok(
  sourceText.includes("const adjustedSpeedFloor = effectiveBrakeBlend > 0.01 ? 0 : this.minForwardSpeed * 0.5;"),
  "expected carving velocity floor to drop to 0 during snowplow braking"
);

assert.ok(readDefaultNumber("turnSnowplowSpeedReduction") >= 120, "expected strong snowplow speed reduction");
assert.ok(readDefaultNumber("snowplowStopResponseMin") >= 4, "expected noticeable snowplow decel response");
assert.ok(readDefaultNumber("snowplowStopResponseMax") >= 12, "expected hard full-stop response when snowplow is maxed");

console.log("Snowplow full stop logic OK");
