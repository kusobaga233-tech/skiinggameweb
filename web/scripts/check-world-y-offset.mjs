import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const trackCourse = await fs.readFile(path.resolve("src/game/trackCourse.ts"), "utf8");
const sceneBuilder = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
const skierController = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(
  trackCourse.includes("export const COURSE_Y_OFFSET = 100;"),
  "expected a single exported world Y offset of 100 units"
);
assert.ok(
  trackCourse.includes("return rawElevation + COURSE_Y_OFFSET;"),
  "expected course elevation to apply the world Y offset at the source"
);
assert.ok(
  sceneBuilder.includes("new Vector3(0, evaluateCourseElevation(0) + 1.4, 6)"),
  "expected initial camera target to follow the lifted course start height"
);
assert.ok(
  skierController.includes("evaluateCourseElevation(0) + this.groundOffsetY"),
  "expected skier reset to continue using the lifted course elevation"
);

console.log("World Y offset OK");
