import assert from "node:assert/strict";
import fs from "node:fs/promises";
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

const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
assert.ok(sceneBuilderSource.includes('"START"'), "expected visible START marker near the beginning of the course");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");
assert.ok(
  skierControllerSource.includes("update(motion: MotionState, dt: number, movementEnabled = true)"),
  "expected skier controller to accept an explicit movement-enabled start lock"
);
assert.ok(
  skierControllerSource.includes("if (!movementEnabled)"),
  "expected skier controller to gate movement before the launch gesture"
);
assert.ok(
  skierControllerSource.includes("this.currentForwardSpeed = 0;"),
  "expected skier controller reset to return the skier to a stationary start state"
);

const tempDir = await fs.mkdtemp(path.resolve("tmp-start-sequence-check-"));
const trackCoursePath = await transpileToModule(path.resolve("src/game/trackCourse.ts"), tempDir);
const runSessionPath = await transpileToModule(path.resolve("src/game/runSession.ts"), tempDir);

const { createTrackCourse } = await import(pathToFileURL(trackCoursePath).href);
const { RunSession } = await import(pathToFileURL(runSessionPath).href);

const course = createTrackCourse();
const runSession = new RunSession(course);

runSession.update(5, 0, false);
let stats = runSession.getStats();
assert.equal(stats.started, false, "expected run to remain locked before valid ski-start motion");
assert.equal(stats.elapsedTime, 0, "expected timer to remain frozen before valid ski-start motion");

runSession.update(0.25, 0, true);
stats = runSession.getStats();
assert.equal(stats.started, true, "expected run to start once valid ski-start motion is detected");
assert.ok(stats.elapsedTime >= 0.24, `expected timer to begin after valid ski-start motion, got ${stats.elapsedTime.toFixed(2)}`);

console.log("Start sequence behavior OK");
