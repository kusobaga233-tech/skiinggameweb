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

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-ramp-sweep-check-"));
const trackCoursePath = await transpileToModule(path.resolve("src/game/trackCourse.ts"), tempDir);
const runSessionPath = await transpileToModule(path.resolve("src/game/runSession.ts"), tempDir);

const { createTrackCourse } = await import(pathToFileURL(trackCoursePath).href);
const { RunSession } = await import(pathToFileURL(runSessionPath).href);

const course = createTrackCourse();
const runSession = new RunSession(course);
const ramp = course.ramps.find((item) => item.kind === "small");
assert.ok(ramp, "expected at least one small ramp");

const startZ = ramp.centerZ - ramp.length * 0.5;
const endZ = ramp.centerZ + ramp.length * 0.5;
const launch = runSession.consumeRamp(ramp.centerX, startZ - 2.5, endZ + 2.5, true);

assert.ok(launch, "expected swept z range to consume a ramp crossed between frames");
assert.equal(launch.airBonus, true, "expected held jump to grant air bonus on swept ramp consume");

const stats = runSession.getStats();
assert.equal(stats.rampHits, 1, "expected swept ramp consume to count one ramp hit");
assert.equal(stats.airBonuses, 1, "expected swept ramp consume to count one air bonus");
assert.equal(stats.score, 150, "expected swept ramp consume to award ramp air bonus");

const secondLaunch = runSession.consumeRamp(ramp.centerX, startZ - 1, endZ + 1, true);
assert.equal(secondLaunch, null, "expected consumed ramp not to launch twice");

console.log("Ramp swept consume OK");
