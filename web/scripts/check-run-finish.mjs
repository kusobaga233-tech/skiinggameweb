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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-run-finish-check-"));
const trackCoursePath = await transpileToModule(path.resolve("src/game/trackCourse.ts"), tempDir);
const runSessionPath = await transpileToModule(path.resolve("src/game/runSession.ts"), tempDir);

const { createTrackCourse } = await import(pathToFileURL(trackCoursePath).href);
const { RunSession } = await import(pathToFileURL(runSessionPath).href);

const course = createTrackCourse();
const runSession = new RunSession(course);

runSession.update(0.1, 0, true);
runSession.update(179.9, course.length - 120, false);
let stats = runSession.getStats();
assert.equal(stats.completed, false, "expected run to stay active before finish line even after long elapsed time");
assert.ok(stats.elapsedTime > 179.9, `expected elapsed time to keep counting up before finish, got ${stats.elapsedTime.toFixed(2)}`);

runSession.update(2.4, course.length + 1, false);
stats = runSession.getStats();
assert.equal(stats.completed, true, "expected run to complete when skier reaches finish line");
assert.ok(stats.elapsedTime > 182.3 && stats.elapsedTime < 182.5, `expected finish time to freeze at completion, got ${stats.elapsedTime.toFixed(2)}`);

runSession.update(5, course.length + 100, false);
stats = runSession.getStats();
assert.ok(stats.elapsedTime > 182.3 && stats.elapsedTime < 182.5, `expected finish time to remain frozen after completion, got ${stats.elapsedTime.toFixed(2)}`);

console.log("Run finish behavior OK");
