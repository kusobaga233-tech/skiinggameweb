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

assert.equal(readNumber("maxForwardSpeed"), 120, "expected forward speed cap to be 120");
assert.ok(readNumber("downhillSpeedBoost") >= 220, "expected downhill push to be scaled up for a 120 cap");
assert.ok(readNumber("driveSpeedBoost") >= 20, "expected pole-plant drive to be scaled up for a 120 cap");
assert.ok(readNumber("startSpeedLimit") >= 22, "expected start speed limit to be scaled up for a 120 cap");
assert.ok(readNumber("pumpImpulseBoost") >= 7, "expected pump impulse to be scaled up for a 120 cap");
assert.ok(speedMeterText.includes("private maxSpeed = 120"), "expected speed meter to default to 120");
assert.ok(speedMeterText.includes("clampedSpeed / this.maxSpeed"), "expected speed meter to use configured max speed");
assert.ok(speedMeterText.includes("this.maxSpeed * 0.5"), "expected fast speed threshold to scale with configured max speed");

console.log("120 speed cap tuning OK");
