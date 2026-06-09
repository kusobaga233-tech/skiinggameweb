import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const source = await fs.readFile(path.resolve("src/ui/poseOverlay.ts"), "utf8");

assert.ok(
  source.includes("mapLandmarkToCanvas"),
  "expected pose overlay to map landmarks through the rendered video rectangle"
);
assert.ok(
  source.includes("video.videoWidth") && source.includes("video.videoHeight"),
  "expected pose overlay to use intrinsic video dimensions for object-fit cover"
);
assert.ok(
  source.includes("drawnWidth") && source.includes("drawnHeight") && source.includes("offsetX") && source.includes("offsetY"),
  "expected pose overlay to account for cover scale and crop offsets"
);

console.log("Pose overlay cover mapping OK");
