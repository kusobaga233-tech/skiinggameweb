import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");
const speedMeterText = await fs.readFile(path.resolve("src/ui/speedMeter.ts"), "utf8");

function readNumber(name) {
  const match = sourceText.match(new RegExp(`this\\.${name} = config\\.${name} \\?\\? ([0-9.]+);`));
  assert.ok(match, `expected to find numeric constant ${name}`);
  return Number(match[1]);
}

assert.equal(readNumber("maxForwardSpeed"), 90, "expected forward speed cap to be reduced to 90");
assert.ok(readNumber("downhillSpeedBoost") <= 180, "expected downhill push to be scaled for the 90-cap tuning range");
assert.ok(readNumber("driveSpeedBoost") <= 18, "expected pole-plant drive to be scaled for the 90-cap tuning range");
assert.ok(readNumber("accelerationResponse") >= 6, "expected speed-up response to remain snappy after lowering the cap");
assert.ok(readNumber("startSpeedLimit") <= 18, "expected start speed limit to be scaled below the 120-cap tuning");
assert.ok(readNumber("pumpImpulseBoost") <= 6, "expected pole-plant impulse to be scaled for the 90-cap tuning");
assert.ok(speedMeterText.includes("private maxSpeed = 90"), "expected speed meter to default to the 90 speed cap");
assert.ok(speedMeterText.includes("clampedSpeed / this.maxSpeed"), "expected speed meter fill ratio to use the configured speed cap");
assert.ok(speedMeterText.includes("this.maxSpeed * 0.5"), "expected fast speed threshold to scale with the configured speed cap");

console.log("90 speed cap tuning OK");
