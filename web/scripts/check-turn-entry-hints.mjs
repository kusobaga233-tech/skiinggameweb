import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function transpileToModule(sourcePath, outputDir) {
  const sourceText = await fs.readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: sourcePath
  });

  const outputPath = path.join(outputDir, `${path.basename(sourcePath, ".ts")}.mjs`);
  await fs.writeFile(outputPath, transpiled.outputText, "utf8");
  return outputPath;
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-turn-entry-hint-check-"));
const trackCoursePath = await transpileToModule(path.resolve("src/game/trackCourse.ts"), tempDir);

const { createTrackCourse, evaluateTurnEntryHint } = await import(pathToFileURL(trackCoursePath).href);

const course = createTrackCourse("track1");
assert.ok(course.turnMarkers.length >= 3, "expected enough turn markers for entry hint checks");

const firstTurn = course.turnMarkers[0];
const secondTurn = course.turnMarkers[1];
const thirdTurn = course.turnMarkers[2];

const firstHint = evaluateTurnEntryHint(firstTurn, course.courseHalfWidth);
const secondHint = evaluateTurnEntryHint(secondTurn, course.courseHalfWidth);
const thirdHint = evaluateTurnEntryHint(thirdTurn, course.courseHalfWidth);

assert.equal(firstTurn.direction, "left", "expected first turn geometry to be left");
assert.equal(
  firstHint.direction,
  "right",
  "expected softened first turn to request a right-side line setup before the left turn"
);
assert.ok(firstHint.arrowText.includes("》"), `expected first turn to show a right setup arrow, got ${firstHint.arrowText}`);

assert.equal(secondTurn.direction, "right", "expected second turn geometry to be right");
assert.equal(secondHint.direction, "right", "expected second turn entry hint to steer right");
assert.ok(secondHint.arrowText.includes("》"), `expected second turn to show right arrows, got ${secondHint.arrowText}`);

assert.equal(thirdTurn.direction, "right", "expected third turn geometry to be right");
assert.equal(
  thirdHint.direction,
  "left",
  "expected third same-direction turn to request a left-side line correction"
);
assert.ok(thirdHint.arrowText.includes("《"), `expected third turn to show left arrows, got ${thirdHint.arrowText}`);

console.log("Turn entry hint logic OK");
