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

assert.ok(sourceText.includes("turnSnowplowHoldSeconds"), "expected sustained snowplow state");
assert.ok(sourceText.includes("evaluateTurnSnowplowBrakeBlend"), "expected snowplow brake evaluator");
assert.ok(sourceText.includes("turnSnowplowSpeedReduction"), "expected dedicated speed reduction");
assert.ok(
  sourceText.includes("- turnSnowplowBrakeBlend * this.turnSnowplowSpeedReduction"),
  "expected snowplow brake to reduce target speed directly"
);
assert.ok(
  sourceText.includes("const intent = steerFactor;"),
  "expected snowplow braking to work from steer/snowplow input without turn-zone gating"
);
assert.ok(
  !sourceText.includes("const intent = Math.min(turnZoneFactor, steerFactor);"),
  "expected snowplow braking to no longer require marked turn regions"
);
assert.ok(sourceText.includes("turnSnowplowSteerFull"), "expected snowplow to scale with larger steer angle");
assert.ok(sourceText.includes("turnSnowplowReleaseDuration"), "expected snowplow to decay after intent is lost");

assert.ok(readDefaultNumber("turnSnowplowSteerStart") <= 0.5, "expected easier snowplow trigger");
assert.ok(readDefaultNumber("turnSnowplowHoldDuration") <= 0.2, "expected snowplow to ramp in quickly");
assert.ok(readDefaultNumber("turnSnowplowSpeedReduction") >= 120, "expected stronger snowplow speed reduction");
assert.ok(readDefaultNumber("turnSnowplowMaxBlend") >= 1, "expected snowplow to support full brake blend");

console.log("Turn snowplow brake logic OK");
