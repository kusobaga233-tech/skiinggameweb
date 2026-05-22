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

function readLateralSpeedBlend() {
  const match = sourceText.match(
    /const speedBlend = this\.clamp\(\(this\.currentForwardSpeed - ([0-9.]+)\) \/ ([0-9.]+), 0, 1\);/
  );
  assert.ok(match, "expected lateral speed blend formula");
  return {
    start: Number(match[1]),
    span: Number(match[2])
  };
}

assert.equal(readNumber("maxForwardSpeed"), 150, "expected forward speed cap to be 150");
assert.ok(readNumber("downhillSpeedBoost") >= 340, "expected downhill push to scale with the new cap");
assert.ok(readNumber("driveSpeedBoost") >= 32, "expected pump drive to keep authority at the new cap");
assert.ok(readNumber("manualBrakeSpeedReduction") >= 44, "expected manual brake to remain meaningful at 150");
assert.ok(readNumber("autoBrakeSpeedReduction") >= 24, "expected bend safety brake to scale at 150");
assert.ok(readNumber("speedLateralAuthorityBoost") >= 2, "expected high-speed lateral authority to scale at 150");

const lateralBlend = readLateralSpeedBlend();
assert.equal(lateralBlend.start, 18, "expected existing low-speed lateral blend start");
assert.ok(lateralBlend.span >= 100, "expected lateral authority growth to extend into the new high-speed range");

console.log("150 speed cap tuning OK");
