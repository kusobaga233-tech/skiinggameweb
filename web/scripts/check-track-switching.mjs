import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const indexHtml = await fs.readFile(path.resolve("index.html"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const gameAppSource = await fs.readFile(path.resolve("src/game/gameApp.ts"), "utf8");
const trackCoursePath = path.resolve("src/game/trackCourse.ts");
const trackCourseSource = await fs.readFile(trackCoursePath, "utf8");

assert.ok(indexHtml.includes('id="track-1-button"'), "expected top UI button for 赛道1");
assert.ok(indexHtml.includes('id="track-2-button"'), "expected top UI button for 赛道2");
assert.ok(mainSource.includes("track-1-button"), "expected main.ts to bind 赛道1 button");
assert.ok(mainSource.includes("track-2-button"), "expected main.ts to bind 赛道2 button");
assert.ok(gameAppSource.includes("trackId"), "expected GameApp to accept a selectable track id");

const transpiled = ts.transpileModule(trackCourseSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: trackCoursePath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-track-switch-check-"));
const compiledPath = path.join(tempDir, "trackCourse.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { createTrackCourse } = await import(pathToFileURL(compiledPath).href);

const track1 = createTrackCourse("track1");
const track2 = createTrackCourse("track2");

assert.equal(track2.length, track1.length, "expected track2 to match track1 length");
assert.equal(track2.gates.length, track1.gates.length, "expected track2 to keep same gate count as track1");
assert.equal(track2.turnMarkers.length, 0, "expected track2 to be a full straight course without turn markers");
assert.equal(track2.ramps.length, 0, "expected track2 to be a pure gate course without ramps");
assert.ok(track2.samples.every((sample) => Math.abs(sample.centerX) < 1e-6), "expected track2 centerline to stay straight at x=0");

for (let index = 1; index < track2.gates.length; index += 1) {
  const previous = track2.gates[index - 1].centerX;
  const current = track2.gates[index].centerX;
  assert.ok(
    Math.sign(previous) !== Math.sign(current),
    `expected track2 gates to alternate left/right, but gate ${index} and ${index + 1} did not`
  );
}

console.log("Track switching wiring OK");
