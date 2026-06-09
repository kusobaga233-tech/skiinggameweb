import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");

assert.ok(
  sceneBuilderSource.includes("const edgeTilt = inside ? 0.42 : 0.34;"),
  "expected ski carve pose to use a much stronger edge tilt for inside and outside skis"
);

assert.ok(
  sceneBuilderSource.includes("rotation.z += carve * (inside ? 0.32 : 0.24) * stableEdgeBlend;"),
  "expected ankle and boot to follow the stronger edging roll"
);

assert.ok(
  sceneBuilderSource.includes("rotation.z += carve * (inside ? 0.52 : 0.42) * stableEdgeBlend;"),
  "expected lower leg to drive a stronger carve knee/ankle stack"
);

assert.ok(
  sceneBuilderSource.includes("position.y += inside ? -0.045 * stableEdgeBlend : -0.03 * stableEdgeBlend;"),
  "expected skis to sink slightly into the snow while edged"
);

console.log("Ski edge carve pose OK");
