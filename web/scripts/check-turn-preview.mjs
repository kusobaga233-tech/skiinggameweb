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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-turn-preview-check-"));
const trackCoursePath = await transpileToModule(path.resolve("src/game/trackCourse.ts"), tempDir);
const turnPreviewPath = await transpileToModule(path.resolve("src/game/turnPreview.ts"), tempDir);

const { createTrackCourse } = await import(pathToFileURL(trackCoursePath).href);
const { evaluateTurnPreviewAssist } = await import(pathToFileURL(turnPreviewPath).href);

const course = createTrackCourse();

assert.ok(course.turnMarkers.length >= 9, `expected continuous spiral turn markers, got ${course.turnMarkers.length}`);
assert.equal(course.turnMarkers.every((turn) => turn.kind === "sweep"), true, "expected spiral turns to use sweep previews");

const startPreview = evaluateTurnPreviewAssist(0, course.turnMarkers);
assert.equal(startPreview.active, true, "expected preview to be active immediately on spiral course");
assert.ok(startPreview.blend > 0 && startPreview.blend < 0.25, `expected gentle start preview blend, got ${startPreview.blend.toFixed(2)}`);

const firstSpiral = evaluateTurnPreviewAssist(220, course.turnMarkers);
assert.equal(firstSpiral.active, true, "expected first spiral preview active");
assert.ok(firstSpiral.blend >= 0.95, `expected strong first spiral preview, got ${firstSpiral.blend.toFixed(2)}`);
assert.ok(firstSpiral.directionBias <= -0.85, `expected first spiral preview to point left, got ${firstSpiral.directionBias.toFixed(2)}`);
assert.ok(firstSpiral.lookAheadDistance >= 48, `expected spiral camera to look ahead, got ${firstSpiral.lookAheadDistance.toFixed(2)}`);
assert.ok(firstSpiral.betaOffset <= -0.28, `expected spiral camera to add overhead pitch, got ${firstSpiral.betaOffset.toFixed(2)}`);

const crestPreview = evaluateTurnPreviewAssist(800, course.turnMarkers);
assert.equal(crestPreview.active, true, "expected preview active at uphill-to-downhill crest");
assert.ok(Math.abs(crestPreview.directionBias) >= 0.85, `expected strong crest direction bias, got ${crestPreview.directionBias.toFixed(2)}`);
assert.ok(crestPreview.targetLiftY >= 1.1, `expected crest preview to lift camera, got ${crestPreview.targetLiftY.toFixed(2)}`);

const downhillPreview = evaluateTurnPreviewAssist(1570, course.turnMarkers);
assert.equal(downhillPreview.active, true, "expected preview active on downhill spiral");
assert.ok(downhillPreview.blend >= 0.9, `expected strong downhill spiral preview, got ${downhillPreview.blend.toFixed(2)}`);
assert.ok(downhillPreview.radiusBoost >= 2.4, `expected downhill spiral radius boost, got ${downhillPreview.radiusBoost.toFixed(2)}`);

const latePreview = evaluateTurnPreviewAssist(2350, course.turnMarkers);
assert.equal(latePreview.active, true, "expected late spiral preview active");
assert.ok(latePreview.lookAheadDistance >= 45, `expected late spiral camera look-ahead, got ${latePreview.lookAheadDistance.toFixed(2)}`);

console.log("Spiral turn preview assist OK");
