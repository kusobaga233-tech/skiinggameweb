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
assert.equal(firstHint.direction, "left", "expected first turn entry hint to steer left");
assert.equal(firstHint.arrowText, "《《《", "expected first turn to demand a strong left line change");

assert.equal(secondTurn.direction, "left", "expected second turn geometry to also be left");
assert.equal(
  secondHint.direction,
  "right",
  "expected second same-direction turn to request a right-side line correction instead of blindly repeating left"
);
assert.ok(
  secondHint.arrowText === "》" || secondHint.arrowText === "》》",
  `expected second turn to show a lighter right correction, got ${secondHint.arrowText}`
);

assert.equal(thirdTurn.direction, "right", "expected third turn geometry to be right");
assert.equal(thirdHint.direction, "right", "expected third turn entry hint to also steer right");

console.log("Turn entry hint logic OK");
