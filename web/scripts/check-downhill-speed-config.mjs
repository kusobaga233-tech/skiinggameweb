import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve("..");
const configSource = await fs.readFile(path.resolve(repoRoot, "config.txt"), "utf8");
const runtimeConfigSource = await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8");
const gameAppSource = await fs.readFile(path.resolve("src/game/gameApp.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");

for (const key of [
  "max_forward_speed",
  "downhill_speed_boost",
  "acceleration_response",
  "drive_speed_boost",
  "drive_downhill_synergy",
  "tuck_speed_bonus_ratio",
  "start_speed_limit",
  "pump_impulse_boost"
]) {
  assert.match(configSource, new RegExp(`#.*${key}|${key}\\s*=`), `expected ${key} to be documented in config.txt`);
}

for (const field of [
  "maxForwardSpeed?: number;",
  "downhillSpeedBoost?: number;",
  "accelerationResponse?: number;",
  "driveSpeedBoost?: number;",
  "driveDownhillSynergy?: number;",
  "maxTuckSpeedBonusRatio?: number;",
  "startSpeedLimit?: number;",
  "pumpImpulseBoost?: number;"
]) {
  assert.ok(runtimeConfigSource.includes(field), `expected RuntimeConfig.${field}`);
  assert.ok(skierControllerSource.includes(field), `expected SkierControllerConfig.${field}`);
}

assert.ok(runtimeConfigSource.includes('"max_forward_speed"'), "expected runtime config parser to read max_forward_speed");
assert.ok(runtimeConfigSource.includes('"downhill_speed_boost"'), "expected runtime config parser to read downhill_speed_boost");
assert.ok(gameAppSource.includes("config: GameAppConfig = {}"), "expected GameApp to accept runtime config");
assert.ok(gameAppSource.includes("config"), "expected GameApp to pass config into SkierController");
assert.ok(mainSource.includes("maxForwardSpeed: runtimeConfig.maxForwardSpeed"), "expected main.ts to pass max speed config into GameApp");
assert.ok(mainSource.includes("downhillSpeedBoost: runtimeConfig.downhillSpeedBoost"), "expected main.ts to pass downhill boost config into GameApp");

console.log("Downhill speed runtime config wiring OK");
