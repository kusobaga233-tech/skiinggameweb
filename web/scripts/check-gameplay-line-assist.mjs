import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve("..");
const configSource = await fs.readFile(path.resolve(repoRoot, "config.txt"), "utf8");
const runtimeConfigSource = await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

for (const key of [
  "gameplay_line_assist_strength",
  "gameplay_line_player_offset_scale",
  "gameplay_line_max_offset",
  "gameplay_line_lookahead",
  "gameplay_line_turn_reduce",
  "gameplay_line_max_yaw"
]) {
  assert.match(configSource, new RegExp(`${key}\\s*=`), `expected ${key} in config.txt`);
  assert.ok(runtimeConfigSource.includes(`"${key}"`), `expected runtime parser to read ${key}`);
}

for (const field of [
  "gameplayLineAssistStrength?: number;",
  "gameplayLinePlayerOffsetScale?: number;",
  "gameplayLineMaxOffset?: number;",
  "gameplayLineLookahead?: number;",
  "gameplayLineTurnReduce?: number;",
  "gameplayLineMaxYaw?: number;"
]) {
  assert.ok(runtimeConfigSource.includes(field), `expected RuntimeConfig.${field}`);
  assert.ok(skierControllerSource.includes(field), `expected SkierControllerConfig.${field}`);
}

assert.ok(
  mainSource.includes("gameplayLineAssistStrength: runtimeConfig.gameplayLineAssistStrength"),
  "expected main.ts to pass gameplay line config"
);
assert.ok(
  skierControllerSource.includes("private evaluateGameplayLineX"),
  "expected controller to evaluate a gate-based gameplay line"
);
assert.ok(
  skierControllerSource.includes("private evaluateGameplayLineAssistYaw"),
  "expected controller to convert line error into weak yaw assist"
);
assert.ok(
  skierControllerSource.includes("turnAssistScale"),
  "expected large turn preview to reduce line assist strength"
);
assert.ok(
  skierControllerSource.includes("this.currentSteer * this.gameplayLinePlayerOffsetScale"),
  "expected player input to become relative offset from gameplay line"
);

console.log("Gameplay line assist config and controller wiring OK");
