import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const htmlSource = await fs.readFile(path.resolve("index.html"), "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const boostMeterSource = await fs.readFile(path.resolve("src/ui/startBoostMeter.ts"), "utf8");

assert.ok(htmlSource.includes('id="speed-meter"'), "expected a centered speed meter in index.html");
assert.ok(mainSource.includes("new SpeedMeter("), "expected SpeedMeter to be wired in main.ts");
assert.ok(stylesSource.includes(".speed-meter"), "expected speed meter styles");
assert.ok(stylesSource.includes(".start-boost-shell {\n  position: absolute;\n  bottom: 136px;"), "expected start boost UI to anchor to the bottom");
assert.ok(
  boostMeterSource.includes("const hideAfterMs = 3000") || boostMeterSource.includes("3000"),
  "expected start boost indicator to hide after 3s"
);

console.log("Start boost UI layout OK");
