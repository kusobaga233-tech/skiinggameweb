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

const { evaluateCourseCenterX, evaluateCourseTangent, createTrackCourse } = await import(pathToFileURL(compiledPath).href);

const checkpoints = [
  { z: 220, direction: "left", minMagnitude: 4.7 },
  { z: 520, direction: "right", minMagnitude: 6.8 },
  { z: 760, direction: "left", minMagnitude: 4.7 },
  { z: 930, direction: "right", minMagnitude: 5.0 },
  { z: 1085, direction: "left", minMagnitude: 15 },
  { z: 1470, direction: "right", minMagnitude: 4.0 },
  { z: 1650, direction: "right", minMagnitude: 1.0 },
  { z: 1830, direction: "right", minMagnitude: 10 },
  { z: 2010, direction: "right", minMagnitude: 10.5 },
  { z: 2200, direction: "left", minMagnitude: 0.6 },
  { z: 2330, direction: "right", minMagnitude: 0.6 },
  { z: 2460, direction: "right", minMagnitude: 0.8 }
];

const results = checkpoints.map((checkpoint) => {
  const value = evaluateCourseCenterX(checkpoint.z);
  const signedMagnitude = checkpoint.direction === "left" ? -value : value;

  assert.ok(
    signedMagnitude >= checkpoint.minMagnitude,
    `${checkpoint.direction} turn too weak at z=${checkpoint.z}: expected >= ${checkpoint.minMagnitude.toFixed(1)}, got ${value.toFixed(2)}`
  );

  return {
    ...checkpoint,
    value: Number(value.toFixed(2))
  };
});

console.log("Course bend profile OK");
console.table(results);

const course = createTrackCourse();
assert.equal(course.gates.length, 23, `expected 23 gates after 50% density reduction, got ${course.gates.length}`);
assert.equal(course.turnMarkers?.length, 12, `expected 12 turn markers, got ${course.turnMarkers?.length ?? "none"}`);
assert.equal(course.ramps.length, 11, `expected 11 ramps after adding 2 track-wide jumps, got ${course.ramps.length}`);

const trackWideRamps = course.ramps.filter((ramp) => ramp.kind === "large" && ramp.halfWidth >= course.courseHalfWidth - 0.6);
assert.equal(trackWideRamps.length, 2, `expected 2 track-wide large ramps, got ${trackWideRamps.length}`);

for (const ramp of trackWideRamps) {
  assert.ok(
    Math.abs(ramp.centerX - evaluateCourseCenterX(ramp.centerZ)) <= 0.01,
    `expected track-wide ramp ${ramp.index} to stay centered on course at z=${ramp.centerZ}`
  );
}

for (let index = 0; index < course.turnMarkers.length; index += 1) {
  const marker = course.turnMarkers[index];
  assert.equal(marker.index, index + 1, `expected turn marker index ${index + 1}, got ${marker.index}`);
}

for (let index = 1; index < course.gates.length; index += 1) {
  const spacing = course.gates[index].z - course.gates[index - 1].z;
  assert.equal(spacing, 84, `expected gate spacing 84 at pair ${index}, got ${spacing}`);
}

console.log("Course gate density OK");
console.log("Track-wide jump ramps OK");
console.table(
  trackWideRamps.map((ramp) => ({
    index: ramp.index,
    centerZ: ramp.centerZ,
    width: Number((ramp.halfWidth * 2).toFixed(2)),
    courseWidth: Number((course.courseHalfWidth * 2).toFixed(2))
  }))
);

function gateAtZ(z) {
  const gate = course.gates.find((item) => item.z === z);
  assert.ok(gate, `expected gate at z=${z}`);
  return gate;
}

function gateOffsetAtZ(z) {
  const gate = gateAtZ(z);
  return Number((gate.centerX - evaluateCourseCenterX(z)).toFixed(2));
}

const turnAGates = {
  entry: gateOffsetAtZ(950),
  apex: gateOffsetAtZ(1034),
  exit: gateOffsetAtZ(1202)
};

assert.ok(turnAGates.entry >= 3.5, `expected left major turn entry gate to guide outside-right, got ${turnAGates.entry}`);
assert.ok(turnAGates.apex <= -3.5, `expected left major turn apex gate to guide inside-left, got ${turnAGates.apex}`);
assert.ok(turnAGates.exit >= 2.8, `expected left major turn exit gate to reopen to outside-right, got ${turnAGates.exit}`);

const turnBGates = {
  entry: gateOffsetAtZ(1286),
  apex: gateOffsetAtZ(1370),
  exit: gateOffsetAtZ(1538)
};

assert.ok(turnBGates.entry <= -3.5, `expected right major turn entry gate to guide outside-left, got ${turnBGates.entry}`);
assert.ok(turnBGates.apex >= 3.5, `expected right major turn apex gate to guide inside-right, got ${turnBGates.apex}`);
assert.ok(turnBGates.exit <= -2.8, `expected right major turn exit gate to reopen to outside-left, got ${turnBGates.exit}`);

console.log("Gate line guidance OK");
console.table([
  { turn: "turnA-entry", offset: turnAGates.entry },
  { turn: "turnA-apex", offset: turnAGates.apex },
  { turn: "turnA-exit", offset: turnAGates.exit },
  { turn: "turnB-entry", offset: turnBGates.entry },
  { turn: "turnB-apex", offset: turnBGates.apex },
  { turn: "turnB-exit", offset: turnBGates.exit }
]);

function maxTurnAngleDegrees(start, end) {
  let maxDegrees = 0;
  for (let z = start; z <= end; z += 1) {
    const tangent = evaluateCourseTangent(z);
    const degrees = Math.atan2(Math.abs(tangent.x), tangent.z) * 180 / Math.PI;
    if (degrees > maxDegrees) {
      maxDegrees = degrees;
    }
  }
  return Number(maxDegrees.toFixed(2));
}

const majorTurnA = maxTurnAngleDegrees(978, 1137);
const majorTurnB = maxTurnAngleDegrees(1318, 1492);
const majorTurnC = maxTurnAngleDegrees(2138, 2262);
const majorTurnD = maxTurnAngleDegrees(2268, 2392);
const majorTurnE = maxTurnAngleDegrees(2398, 2522);
assert.ok(majorTurnA >= 12 && majorTurnA <= 18, `expected first long-arc bend in GS-style range, got ${majorTurnA}`);
assert.ok(majorTurnB >= 13 && majorTurnB <= 20, `expected second long-arc bend in GS-style range, got ${majorTurnB}`);
assert.ok(majorTurnC >= 9 && majorTurnC <= 14, `expected third tail bend in medium long-arc range, got ${majorTurnC}`);
assert.ok(majorTurnD >= 10 && majorTurnD <= 15, `expected fourth tail bend in medium long-arc range, got ${majorTurnD}`);
assert.ok(majorTurnE >= 10 && majorTurnE <= 15, `expected fifth tail bend in medium long-arc range, got ${majorTurnE}`);

console.log("Major turn angle OK");
console.table([
  { label: "turnA", degrees: majorTurnA },
  { label: "turnB", degrees: majorTurnB },
  { label: "turnC", degrees: majorTurnC },
  { label: "turnD", degrees: majorTurnD },
  { label: "turnE", degrees: majorTurnE }
]);
