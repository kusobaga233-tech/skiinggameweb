import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve("..");
const configSource = await fs.readFile(path.resolve(repoRoot, "config.txt"), "utf8");
const runtimeConfigSource = await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

for (const key of [
  "low_speed_turn_scale",
  "carve_radius_input_bias",
  "carve_radius_input_floor"
]) {
  assert.match(configSource, new RegExp(`${key}\\s*=`), `expected ${key} in config.txt`);
}

for (const field of [
  "lowSpeedTurnScale?: number;",
  "carveRadiusInputBias?: number;",
  "carveRadiusInputFloor?: number;"
]) {
  assert.ok(runtimeConfigSource.includes(field), `expected RuntimeConfig.${field}`);
  assert.ok(skierControllerSource.includes(field), `expected SkierControllerConfig.${field}`);
}

assert.ok(runtimeConfigSource.includes('"low_speed_turn_scale"'), "expected parser to read low_speed_turn_scale");
assert.ok(runtimeConfigSource.includes('"carve_radius_input_bias"'), "expected parser to read carve_radius_input_bias");
assert.ok(runtimeConfigSource.includes('"carve_radius_input_floor"'), "expected parser to read carve_radius_input_floor");
assert.ok(mainSource.includes("lowSpeedTurnScale: runtimeConfig.lowSpeedTurnScale"), "expected main.ts to pass low speed turn scale");
assert.ok(skierControllerSource.includes("this.lowSpeedTurnScale = config.lowSpeedTurnScale ?? 0.55;"), "expected configurable low speed turn scale default");
assert.ok(skierControllerSource.includes("this.carveRadiusInputBias = config.carveRadiusInputBias ?? 0.08;"), "expected configurable carve input bias default");
assert.ok(skierControllerSource.includes("this.carveRadiusInputFloor = config.carveRadiusInputFloor ?? 0.1;"), "expected configurable carve input floor default");
assert.ok(
  skierControllerSource.includes("this.lerp(this.lowSpeedTurnScale, this.highSpeedTurnScale, speedBlend)"),
  "expected low speed turn scale to replace the old hard-coded 1.26 low-speed multiplier"
);

console.log("Low speed turn runtime config wiring OK");
