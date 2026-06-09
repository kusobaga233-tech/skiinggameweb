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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-spiral-course-check-"));
const compiledPath = path.join(tempDir, "trackCourse.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const {
  createTrackCourse,
  evaluateCourseCenterX,
  evaluateCourseElevation,
  evaluateCourseTangent
} = await import(pathToFileURL(compiledPath).href);

const course = createTrackCourse();

assert.equal(course.length, 2600, `expected course length to remain 2600, got ${course.length}`);
assert.equal(course.gates.length, 18, `expected spiral course gate count to be rebuilt, got ${course.gates.length}`);
assert.ok(course.turnMarkers.length >= 8, `expected spiral turn markers, got ${course.turnMarkers.length}`);

const startY = evaluateCourseElevation(0);
const earlyY = evaluateCourseElevation(360);
const finishY = evaluateCourseElevation(course.length);
assert.ok(earlyY < startY - 45, `expected spiral to descend immediately after start, start=${startY.toFixed(1)} early=${earlyY.toFixed(1)}`);
assert.ok(finishY < startY - 430, `expected downhill spiral to keep descending, start=${startY.toFixed(1)} finish=${finishY.toFixed(1)}`);

const startSlope = evaluateCourseTangent(40).y;
const downhillSlope = evaluateCourseTangent(1500).y;
assert.ok(startSlope < -0.04, `expected start spiral to be downhill, got tangent.y=${startSlope.toFixed(3)}`);
assert.ok(downhillSlope < -0.08, `expected late spiral to be downhill, got tangent.y=${downhillSlope.toFixed(3)}`);

const centerSamples = [];
for (let z = 0; z <= course.length; z += 130) {
  centerSamples.push(evaluateCourseCenterX(z));
}

let signChanges = 0;
let previousSign = Math.sign(centerSamples[0]);
for (const value of centerSamples.slice(1)) {
  const sign = Math.sign(value);
  if (sign !== 0 && previousSign !== 0 && sign !== previousSign) {
    signChanges += 1;
  }
  if (sign !== 0) {
    previousSign = sign;
  }
}

const maxAbsX = Math.max(...centerSamples.map((value) => Math.abs(value)));
assert.ok(signChanges >= 5, `expected continuous spiral oscillation, got ${signChanges} centerline sign changes`);
assert.ok(maxAbsX >= 13, `expected visible spiral radius, got max center offset ${maxAbsX.toFixed(2)}`);

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
