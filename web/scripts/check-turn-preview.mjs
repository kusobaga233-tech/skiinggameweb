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

const idlePreview = evaluateTurnPreviewAssist(760, course.turnMarkers);
assert.equal(idlePreview.active, false, "expected no preview before major turn window");
assert.equal(idlePreview.blend, 0, "expected no preview blend before major turn window");

const firstTurnApproach = evaluateTurnPreviewAssist(900, course.turnMarkers);
assert.equal(firstTurnApproach.active, true, "expected preview active well before first major turn");
assert.ok(firstTurnApproach.blend >= 0.58, `expected meaningful early preview blend before first major turn, got ${firstTurnApproach.blend.toFixed(2)}`);
assert.ok(firstTurnApproach.lookAheadDistance >= 35, `expected earlier camera look-ahead before first major turn, got ${firstTurnApproach.lookAheadDistance.toFixed(2)}`);
assert.ok(firstTurnApproach.betaOffset <= -0.17, `expected stronger early overhead pitch before first major turn, got ${firstTurnApproach.betaOffset.toFixed(2)}`);
assert.ok(firstTurnApproach.targetLiftY >= 0.72, `expected earlier camera lift before first major turn, got ${firstTurnApproach.targetLiftY.toFixed(2)}`);

const firstTurnEntry = evaluateTurnPreviewAssist(950, course.turnMarkers);
assert.equal(firstTurnEntry.active, true, "expected preview active on first major turn entry");
assert.ok(firstTurnEntry.blend >= 0.78, `expected stronger early preview blend before first major turn, got ${firstTurnEntry.blend.toFixed(2)}`);
assert.ok(firstTurnEntry.directionBias <= -0.55, `expected leftward preview bias before first major turn, got ${firstTurnEntry.directionBias.toFixed(2)}`);
assert.ok(firstTurnEntry.targetLeadZ >= 3.5, `expected entry camera lead to look further ahead, got ${firstTurnEntry.targetLeadZ.toFixed(2)}`);
assert.ok(firstTurnEntry.betaOffset <= -0.24, `expected steeper entry overhead pitch before first major turn, got ${firstTurnEntry.betaOffset.toFixed(2)}`);
assert.ok(firstTurnEntry.targetLiftY >= 1.0, `expected higher entry camera lift before first major turn, got ${firstTurnEntry.targetLiftY.toFixed(2)}`);

const firstTurnApex = evaluateTurnPreviewAssist(1018, course.turnMarkers);
assert.ok(firstTurnApex.blend >= 0.8, `expected peak preview around first turn apex, got ${firstTurnApex.blend.toFixed(2)}`);
assert.ok(firstTurnApex.lookAheadDistance >= 38, `expected camera to look much further ahead through first apex, got ${firstTurnApex.lookAheadDistance.toFixed(2)}`);
assert.ok(firstTurnApex.targetLiftY >= 1.08, `expected apex camera to lift up for better bend visibility, got ${firstTurnApex.targetLiftY.toFixed(2)}`);
assert.ok(firstTurnApex.betaOffset <= -0.24, `expected apex camera to maintain steeper overhead pitch, got ${firstTurnApex.betaOffset.toFixed(2)}`);

const betweenTurns = evaluateTurnPreviewAssist(1180, course.turnMarkers);
assert.ok(betweenTurns.blend >= 0.7, `expected preview to stay readable through long-arc transition, got ${betweenTurns.blend.toFixed(2)}`);

const secondTurnEntry = evaluateTurnPreviewAssist(1310, course.turnMarkers);
assert.equal(secondTurnEntry.active, true, "expected preview active on second major turn entry");
assert.ok(secondTurnEntry.blend >= 0.7, `expected stronger early preview blend before second major turn, got ${secondTurnEntry.blend.toFixed(2)}`);
assert.ok(secondTurnEntry.directionBias >= 0.55, `expected rightward preview bias before second major turn, got ${secondTurnEntry.directionBias.toFixed(2)}`);
assert.ok(secondTurnEntry.radiusBoost >= 2.0, `expected second turn entry camera radius boost, got ${secondTurnEntry.radiusBoost.toFixed(2)}`);

const secondTurnExit = evaluateTurnPreviewAssist(1454, course.turnMarkers);
assert.ok(secondTurnExit.blend >= 0.35, `expected preview to persist further through second turn exit, got ${secondTurnExit.blend.toFixed(2)}`);

console.log("Turn preview assist OK");
