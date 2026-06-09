import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const indexHtml = await fs.readFile(path.resolve("index.html"), "utf8");
const speedMeterSource = await fs.readFile(path.resolve("src/ui/speedMeter.ts"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");

assert.ok(indexHtml.includes('id="speed-meter-gates"'), "expected bottom speed UI to include gate progress element");
assert.ok(speedMeterSource.includes('import type { HudState }'), "expected SpeedMeter to consume HudState");
assert.ok(speedMeterSource.includes("state.clearedGates"), "expected SpeedMeter to render cleared gates");
assert.ok(speedMeterSource.includes("state.totalGates"), "expected SpeedMeter to render total gates");
assert.ok(mainSource.includes("speedMeter.render(hudState);"), "expected main loop to pass full HUD state to SpeedMeter");
assert.ok(stylesSource.includes(".speed-meter-gates"), "expected styling for bottom gate progress");

console.log("Bottom gate progress meter OK");
