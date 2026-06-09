import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const motionMapperSource = await fs.readFile(path.resolve("src/pose/motionMapper.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

function readNumber(source, name) {
  const match =
    source.match(new RegExp(`private readonly ${name} = ([0-9.]+);`))
    ?? source.match(new RegExp(`${name}: ([0-9.]+),`));
  assert.ok(match, `expected numeric tuning constant ${name}`);
  return Number(match[1]);
}

assert.ok(readNumber(motionMapperSource, "steerGain") <= 6.6, "expected body-lean steer gain to be reduced from the over-strong tuning");
assert.ok(readNumber(motionMapperSource, "steerDeadzone") >= 0.028, "expected a slightly larger neutral deadzone to calm body steering");
assert.ok(readNumber(motionMapperSource, "steerAlpha") <= 0.3, "expected slightly softer steer smoothing response");

assert.ok(readNumber(skierControllerSource, "downhillSpeedBoost") <= 240, "expected slower body-control downhill baseline");
assert.ok(readNumber(skierControllerSource, "driveSpeedBoost") <= 24, "expected lower sustained pole-drive baseline");
assert.ok(readNumber(skierControllerSource, "headingTurnRate") <= 1.72, "expected body-control turn rate to be reduced from the over-strong tuning");
assert.ok(readNumber(skierControllerSource, "pumpImpulseBoost") >= 7, "expected per-pole-plant speed impulse");

assert.ok(
  skierControllerSource.includes("if (movementEnabled && motion.pumpTriggered) {"),
  "expected one-frame pump trigger to add an immediate speed impulse"
);

assert.ok(
  skierControllerSource.includes("const carveInput = this.clamp(steerMagnitude * 0.76 + bodyLeanMagnitude * 1.36 + snowplowTurnAssist * 0.46, 0, 1);"),
  "expected slightly calmer carve input from body lean"
);

assert.ok(
  skierControllerSource.includes("const steerTarget = movementEnabled && motion.tracking ? this.clamp(motion.steer * 1.75, -1, 1) : 0;"),
  "expected pose steer amplification to be reduced from the over-strong tuning"
);

console.log("Body control tuning OK");
