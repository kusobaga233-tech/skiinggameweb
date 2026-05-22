import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/ui/pauseInspectorText.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-pause-inspector-check-"));
const compiledPath = path.join(tempDir, "pauseInspectorText.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { buildPauseInspectorText, getPauseToggleLabel } = await import(pathToFileURL(compiledPath).href);

assert.equal(getPauseToggleLabel(false), "Pause Game");
assert.equal(getPauseToggleLabel(true), "Resume Game");

assert.equal(buildPauseInspectorText(false, null), "Pause the game to inspect scene meshes.");
assert.equal(buildPauseInspectorText(true, null), "Paused. Click a mesh in the scene to inspect its resource name.");

const pickedText = buildPauseInspectorText(true, {
  meshName: "ramp-9",
  parentName: "ground",
  materialName: "ramp"
});

assert.ok(pickedText.includes("Mesh: ramp-9"));
assert.ok(pickedText.includes("Parent: ground"));
assert.ok(pickedText.includes("Material: ramp"));

console.log("Pause inspector text OK");
