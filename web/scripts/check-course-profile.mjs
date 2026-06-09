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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-course-check-"));
const compiledPath = path.join(tempDir, "trackCourse.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const {
  createTrackCourse,
  evaluateCourseCenterX,
  evaluateCourseElevation,
  evaluateCourseTangent
} = await import(pathToFileURL(compiledPath).href);

const course = createTrackCourse();

assert.equal(course.length, 5200, `expected softened course length to be 5200, got ${course.length}`);
assert.equal(course.gates.length, 37, `expected 37 gates on softened spiral course, got ${course.gates.length}`);
assert.equal(course.ramps.length, 11, `expected existing 11 ramps to remain, got ${course.ramps.length}`);
assert.ok(course.turnMarkers.length >= 9, `expected spiral turn markers to be rebuilt, got ${course.turnMarkers.length}`);

for (let index = 1; index < course.gates.length; index += 1) {
  const spacing = course.gates[index].z - course.gates[index - 1].z;
  assert.equal(spacing, 140, `expected gate spacing 140 at pair ${index}, got ${spacing}`);
}

for (const gate of course.gates) {
  const centerX = evaluateCourseCenterX(gate.z);
  assert.ok(
    Math.abs(gate.centerX - centerX) <= course.courseHalfWidth - gate.halfWidth,
    `expected gate ${gate.index} to stay inside spiral lane`
  );
  assert.equal(gate.halfWidth, 5.8, `expected doubled spiral gate ${gate.index}, got ${gate.halfWidth}`);
}

const startY = evaluateCourseElevation(0);
const earlyY = evaluateCourseElevation(360);
const finishY = evaluateCourseElevation(course.length);
assert.ok(earlyY < startY - 45, `expected immediate downhill spiral, start=${startY.toFixed(1)} early=${earlyY.toFixed(1)}`);
assert.ok(finishY < startY - 430, `expected downhill spiral to keep descending, start=${startY.toFixed(1)} finish=${finishY.toFixed(1)}`);

const startSlope = evaluateCourseTangent(40).y;
const downhillSlope = evaluateCourseTangent(1500).y;
assert.ok(startSlope < -0.04, `expected start course to be downhill, got ${startSlope.toFixed(3)}`);
assert.ok(downhillSlope < -0.08, `expected late course to be downhill, got ${downhillSlope.toFixed(3)}`);

let signChanges = 0;
let previousSign = 0;
let maxAbsX = 0;
for (let z = 0; z <= course.length; z += 130) {
  const centerX = evaluateCourseCenterX(z);
  maxAbsX = Math.max(maxAbsX, Math.abs(centerX));
  const sign = Math.sign(centerX);
  if (sign !== 0 && previousSign !== 0 && sign !== previousSign) {
    signChanges += 1;
  }
  if (sign !== 0) {
    previousSign = sign;
  }
}

assert.ok(signChanges >= 5, `expected visible spiral oscillation, got ${signChanges} sign changes`);
assert.ok(maxAbsX >= 13, `expected visible spiral radius, got max center offset ${maxAbsX.toFixed(2)}`);

const trackWideRamps = course.ramps.filter((ramp) => ramp.kind === "large" && ramp.halfWidth >= course.courseHalfWidth - 0.6);
assert.equal(trackWideRamps.length, 2, `expected 2 track-wide large ramps, got ${trackWideRamps.length}`);
for (const ramp of course.ramps.filter((item) => item.kind === "large")) {
  assert.ok(
    Math.abs(ramp.centerX - evaluateCourseCenterX(ramp.centerZ)) <= 0.01,
    `expected large ramp ${ramp.index} to stay centered on spiral centerline`
  );
}

console.log("Spiral course profile OK");
console.table([
  { label: "start", z: 0, x: Number(evaluateCourseCenterX(0).toFixed(2)), y: Number(startY.toFixed(2)) },
  { label: "early-downhill", z: 360, x: Number(evaluateCourseCenterX(360).toFixed(2)), y: Number(earlyY.toFixed(2)) },
  { label: "finish", z: course.length, x: Number(evaluateCourseCenterX(course.length).toFixed(2)), y: Number(finishY.toFixed(2)) }
]);
