import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const trackCoursePath = path.resolve("src/game/trackCourse.ts");
const sourceText = await fs.readFile(trackCoursePath, "utf8");
const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: trackCoursePath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-course-softening-"));
const compiledPath = path.join(tempDir, "trackCourse.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { createTrackCourse, evaluateCourseTangent } = await import(pathToFileURL(compiledPath).href);

const track1 = createTrackCourse("track1");
const track2 = createTrackCourse("track2");

assert.equal(track1.length, 5200, `expected track1 length to double to 5200, got ${track1.length}`);
assert.equal(track2.length, track1.length, "expected track2 length to match softened track1 length");

for (const course of [track1, track2]) {
  assert.ok(course.gates.length >= 36, `expected ${course.trackId} to add gates across the longer course`);
  assert.ok(
    course.gates.every((gate) => gate.halfWidth === 5.8),
    `expected every ${course.trackId} gate halfWidth to double from 2.9 to 5.8`
  );
}

assert.ok(track1.turnMarkers.length >= 9, `expected track1 turn markers to remain, got ${track1.turnMarkers.length}`);
for (const turn of track1.turnMarkers) {
  const turnLength = turn.end - turn.start;
  assert.ok(turnLength >= 500, `expected softened turn ${turn.label} length >= 500, got ${turnLength}`);
}

let maxAbsLateralTangent = 0;
for (let z = 0; z <= track1.length; z += 40) {
  maxAbsLateralTangent = Math.max(maxAbsLateralTangent, Math.abs(evaluateCourseTangent(z).x));
}

assert.ok(
  maxAbsLateralTangent <= 0.16,
  `expected softened spiral lateral tangent <= 0.16, got ${maxAbsLateralTangent.toFixed(3)}`
);

console.log("Course softening and gate width OK");
