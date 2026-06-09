import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve("..");
const configSource = await fs.readFile(path.resolve(repoRoot, "config.txt"), "utf8");
const runtimeConfigSource = await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

for (const key of [
  "turn_snowplow_steer_start",
  "turn_snowplow_steer_release",
  "turn_snowplow_steer_full",
  "turn_snowplow_hold_duration",
  "turn_snowplow_release_duration",
  "turn_snowplow_min_speed",
  "turn_snowplow_max_blend",
  "turn_snowplow_speed_reduction",
  "snowplow_stop_response_min",
  "snowplow_stop_response_max"
]) {
  assert.match(configSource, new RegExp(`${key}\\s*=`), `expected ${key} in config.txt`);
  assert.ok(runtimeConfigSource.includes(`"${key}"`), `expected parser to read ${key}`);
}

for (const field of [
  "turnSnowplowSteerStart?: number;",
  "turnSnowplowSteerRelease?: number;",
  "turnSnowplowSteerFull?: number;",
  "turnSnowplowHoldDuration?: number;",
  "turnSnowplowReleaseDuration?: number;",
  "turnSnowplowMinSpeed?: number;",
  "turnSnowplowMaxBlend?: number;",
  "turnSnowplowSpeedReduction?: number;",
  "snowplowStopResponseMin?: number;",
  "snowplowStopResponseMax?: number;"
]) {
  assert.ok(runtimeConfigSource.includes(field), `expected RuntimeConfig.${field}`);
  assert.ok(skierControllerSource.includes(field), `expected SkierControllerConfig.${field}`);
}

assert.ok(mainSource.includes("turnSnowplowMaxBlend: runtimeConfig.turnSnowplowMaxBlend"), "expected main.ts to pass snowplow max blend");
assert.ok(mainSource.includes("turnSnowplowMinSpeed: runtimeConfig.turnSnowplowMinSpeed"), "expected main.ts to pass snowplow min speed");
assert.ok(
  skierControllerSource.includes("const intent = steerFactor;"),
  "expected snowplow braking intent to depend on snowplow/steer input instead of turn-zone gating"
);
assert.ok(
  skierControllerSource.includes("currentSpeed < this.turnSnowplowMinSpeed"),
  "expected snowplow braking to require the configured minimum speed"
);
assert.ok(
  !skierControllerSource.includes("const intent = Math.min(turnZoneFactor, steerFactor);"),
  "expected snowplow braking to no longer require being inside a marked turn region"
);
assert.ok(
  skierControllerSource.includes("this.turnSnowplowSpeedReduction = config.turnSnowplowSpeedReduction ?? 120;"),
  "expected stronger configurable snowplow speed reduction default"
);

console.log("Snowplow runtime config and global brake logic OK");
