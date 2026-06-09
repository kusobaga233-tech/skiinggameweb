import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourceText = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");
const speedMeterText = await fs.readFile(path.resolve("src/ui/speedMeter.ts"), "utf8");

function readNumber(name) {
  const match = sourceText.match(new RegExp(`this\\.${name} = config\\.${name} \\?\\? ([0-9.]+);`));
  assert.ok(match, `expected to find numeric constant ${name}`);
  return Number(match[1]);
}

assert.equal(readNumber("maxForwardSpeed"), 90, "expected forward speed cap to be 90");
assert.ok(readNumber("downhillSpeedBoost") <= 180, "expected downhill push to be scaled for a 90 cap");
assert.ok(readNumber("driveSpeedBoost") <= 18, "expected pole-plant drive to be scaled for a 90 cap");
assert.ok(readNumber("startSpeedLimit") <= 18, "expected start speed limit to be scaled for a 90 cap");
assert.ok(readNumber("pumpImpulseBoost") <= 6, "expected pump impulse to be scaled for a 90 cap");
assert.ok(speedMeterText.includes("private maxSpeed = 90"), "expected speed meter to default to 90");
assert.ok(speedMeterText.includes("clampedSpeed / this.maxSpeed"), "expected speed meter to use configured max speed");
assert.ok(speedMeterText.includes("this.maxSpeed * 0.5"), "expected fast speed threshold to scale with configured max speed");

console.log("90 speed cap tuning OK");
