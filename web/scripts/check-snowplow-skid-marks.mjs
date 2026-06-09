import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const snowTrailSource = await fs.readFile(path.resolve("src/game/snowTrail.ts"), "utf8");
const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");

assert.ok(
  snowTrailSource.includes("brakeBlend: snowplowRatio"),
  "expected snow trail state to expose the current snowplow intensity for skid marks"
);

assert.ok(
  sceneBuilderSource.includes("const leftSkidMark = MeshBuilder.CreateGround(\"skier-skid-mark-left\""),
  "expected a left ski skid-mark mesh under the skier"
);

assert.ok(
  sceneBuilderSource.includes("const rightSkidMark = MeshBuilder.CreateGround(\"skier-skid-mark-right\""),
  "expected a right ski skid-mark mesh under the skier"
);

assert.ok(
  sceneBuilderSource.includes("const skidAlpha = resolved.brakeBlend * 0.42;"),
  "expected skid marks to fade in only while automatic snowplow is active"
);

console.log("Snowplow skid marks OK");
