import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const snowTrailSource = await fs.readFile(path.resolve("src/game/snowTrail.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(
  snowTrailSource.includes("brakeBlend: number;"),
  "expected snow trail input to receive current snowplow/brake blend"
);

assert.ok(
  snowTrailSource.includes("const snowplowRatio = clamp(input.brakeBlend ?? 0, 0, 1);"),
  "expected snow trail intensity to derive a dedicated snowplow ratio"
);

assert.ok(
  snowTrailSource.includes("const baseEmissionRate = Math.round(12 + intensity * 28 + carveRatio * 12);"),
  "expected snow trail to compute a normal baseline emission rate first"
);

assert.ok(
  snowTrailSource.includes("const emissionRate = Math.round(baseEmissionRate * (1 + snowplowRatio * 9));"),
  "expected active snowplow to scale particle count up to 10x the normal trail"
);

assert.ok(
  skierControllerSource.includes("brakeBlend: this.lastSnowplowBrakeBlend"),
  "expected skier controller to pass the current automatic snowplow state into the snow trail"
);

console.log("Snowplow particle boost OK");
