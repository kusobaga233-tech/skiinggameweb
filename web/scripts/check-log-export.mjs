import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const indexSource = await fs.readFile(path.resolve("index.html"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const loggerSourcePath = path.resolve("src/debug/runtimeLogger.ts");

await fs.access(loggerSourcePath);
const loggerSource = await fs.readFile(loggerSourcePath, "utf8");

assert.match(indexSource, /id="download-log"/, "expected a download log button in index.html");
assert.match(mainSource, /RuntimeLogger/, "expected main.ts to create a RuntimeLogger");
assert.match(mainSource, /runtimeLogger\.captureHudState\(hudState\)/, "expected HUD frames to be sampled into the logger");
assert.match(mainSource, /downloadLogButton\.addEventListener\("click"/, "expected the download button to export logs");
assert.match(loggerSource, /export class RuntimeLogger/, "expected RuntimeLogger class");
assert.match(loggerSource, /captureHudState/, "expected RuntimeLogger to capture HUD state");
assert.match(loggerSource, /downloadJson/, "expected RuntimeLogger to download JSON logs");
assert.match(loggerSource, /window\.addEventListener\("error"/, "expected RuntimeLogger to capture window errors");
assert.match(loggerSource, /window\.addEventListener\("unhandledrejection"/, "expected RuntimeLogger to capture promise errors");

console.log("Log export wiring OK");
