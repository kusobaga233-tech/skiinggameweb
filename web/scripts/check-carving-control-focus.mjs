import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");
const motionMapperSource = await fs.readFile(path.resolve("src/pose/motionMapper.ts"), "utf8");

assert.ok(
  !skierControllerSource.includes("const autoBrakeBlend ="),
  "expected generic auto brake logic to be removed from skier controller"
);

assert.ok(
  !skierControllerSource.includes("const manualBrakeBlend ="),
  "expected generic manual brake logic to be removed from skier controller"
);

assert.ok(
  !skierControllerSource.includes("const autoBrakeBlend ="),
  "expected route auto brake logic to stay disabled"
);

assert.ok(
  skierControllerSource.includes("const turnSnowplowBrakeBlend = this.evaluateTurnSnowplowBrakeBlend(motion.snowplow, dt);"),
  "expected turn plus pole-plant snowplow braking to be restored"
);

assert.ok(
  !skierControllerSource.includes("motion.jumpTriggered"),
  "expected generic jump trigger handling to be removed from skier controller"
);

assert.ok(
  skierControllerSource.includes("const effectiveBrakeBlend = turnSnowplowBrakeBlend;"),
  "expected carving controller to use only turn snowplow brake blend"
);

assert.ok(
  skierControllerSource.includes("this.skier.position.y = courseGroundY + this.groundOffsetY;"),
  "expected skier to stay grounded instead of using free jump arc integration"
);

assert.ok(
  skierControllerSource.includes("const carveInput = this.clamp(steerMagnitude * 0.72 + bodyLeanMagnitude * 1.35 + snowplowTurnAssist * 0.45, 0, 1);"),
  "expected body lean to contribute strongly to carve input"
);

assert.ok(
  skierControllerSource.includes("const steerTarget = motion.tracking ? this.clamp(motion.steer * 2.15, -1, 1) : 0;"),
  "expected pose steer input to be amplified for clearer turning response"
);

assert.ok(
  skierControllerSource.includes("private readonly downhillSpeedBoost = 195;"),
  "expected downhill base speed to be reduced from the over-fast tuning"
);

assert.ok(
  skierControllerSource.includes("private readonly headingTurnRate = 1.62;"),
  "expected heading turn rate to be increased for faster turning"
);

assert.ok(
  motionMapperSource.includes("jumpTriggered: false"),
  "expected motion mapper to keep jump trigger permanently disabled"
);

assert.ok(
  motionMapperSource.includes("const brakeRaw = 0;"),
  "expected motion mapper to keep generic brake detection disabled"
);

console.log("Carving control focus check OK");
