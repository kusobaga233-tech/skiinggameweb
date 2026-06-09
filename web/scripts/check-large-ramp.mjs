import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/game/trackCourse.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-large-ramp-check-"));
const compiledPath = path.join(tempDir, "trackCourse.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { createTrackCourse } = await import(pathToFileURL(compiledPath).href);

const course = createTrackCourse();
const smallRamps = course.ramps.filter((ramp) => ramp.kind === "small");
const largeRamps = course.ramps.filter((ramp) => ramp.kind === "large");
const trackWideRamps = largeRamps.filter((ramp) => ramp.halfWidth >= course.courseHalfWidth - 0.6);
const focusedLargeRamp = largeRamps.find((ramp) => ramp.centerZ === 2060);

assert.ok(smallRamps.length > 0, "expected existing small ramps to remain in the course");
assert.ok(largeRamps.length >= 1, "expected at least one large jump ramp in the course");
assert.equal(trackWideRamps.length, 2, `expected 2 track-wide large ramps, got ${trackWideRamps.length}`);
assert.ok(focusedLargeRamp, "expected focused large ramp at z=2060");

const smallReference = smallRamps[0];
const largeReference = focusedLargeRamp;

assert.equal(
  Number((largeReference.halfWidth / smallReference.halfWidth).toFixed(2)),
  3,
  `expected large ramp half-width to be 3x small ramp half-width, got ${largeReference.halfWidth} vs ${smallReference.halfWidth}`
);
assert.ok(
  largeReference.length > smallReference.length,
  `expected large ramp to also be longer than a small ramp, got ${largeReference.length} vs ${smallReference.length}`
);
assert.ok(
  largeReference.surfaceRise > smallReference.surfaceRise,
  `expected large ramp to have a taller surface rise than a small ramp, got ${largeReference.surfaceRise} vs ${smallReference.surfaceRise}`
);

for (const ramp of trackWideRamps) {
  assert.equal(
    ramp.halfWidth,
    course.courseHalfWidth,
    `expected track-wide ramp at z=${ramp.centerZ} to span the course half width`
  );
}

console.log("Large ramp course setup OK");
