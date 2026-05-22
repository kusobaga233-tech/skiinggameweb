import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

function readNumber(name) {
  const match = sourceText.match(new RegExp(`private readonly ${name} = ([0-9.]+);`));
  assert.ok(match, `expected to find numeric constant ${name}`);
  return Number(match[1]);
}

function readSpeedBlendRange() {
  const match = sourceText.match(
    /const speedBlend = this\.clamp\(\(this\.currentForwardSpeed - ([0-9.]+)\) \/ ([0-9.]+), 0, 1\);/
  );
  assert.ok(match, "expected speedBlend formula in lateral control speed");
  return {
    start: Number(match[1]),
    span: Number(match[2])
  };
}

function readSteerBoostScale() {
  const match = sourceText.match(/const steerBoost = steerBlend \* ([0-9.]+);/);
  assert.ok(match, "expected steerBoost formula in lateral control speed");
  return Number(match[1]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const lateralSpeed = readNumber("lateralSpeed");
const turnLateralSpeedBoost = readNumber("turnLateralSpeedBoost");
const speedLateralAuthorityBoost = readNumber("speedLateralAuthorityBoost");
const { start, span } = readSpeedBlendRange();
const steerBoostScale = readSteerBoostScale();

function evaluate(speed, steer, turnPreviewBlend) {
  const speedBlend = clamp((speed - start) / span, 0, 1);
  const steerBlend = Math.abs(steer);
  const turnBoost = turnPreviewBlend * turnLateralSpeedBoost;
  const speedBoost = speedBlend * speedLateralAuthorityBoost * lateralSpeed;
  const steerBoost = steerBlend * steerBoostScale;
  return lateralSpeed + turnBoost + speedBoost + steerBoost;
}

const lowSpeed = evaluate(18, 0.35, 0);
const fastStraight = evaluate(55, 0.35, 0);
const fastTurn = evaluate(55, 0.7, 0.8);

assert.ok(lowSpeed <= 18.5, `expected low-speed lateral control to stay restrained, got ${lowSpeed.toFixed(2)}`);
assert.ok(fastStraight >= 24, `expected fast straight-line lateral authority to stay usable at downhill speed, got ${fastStraight.toFixed(2)}`);
assert.ok(fastTurn >= 31, `expected fast turn lateral authority to remain strong in major bends, got ${fastTurn.toFixed(2)}`);

console.log("Lateral authority tuning OK");
