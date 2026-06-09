import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const indexHtml = await fs.readFile(path.resolve("index.html"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");

assert.ok(indexHtml.includes('id="speed-lines"'), "expected full-screen speed line overlay shell");
assert.ok(indexHtml.includes('class="speed-line speed-line-1"'), "expected speed line elements in the overlay");

assert.ok(mainSource.includes('import { SpeedLines } from "./ui/speedLines";'), "expected SpeedLines UI import");
assert.ok(mainSource.includes('const speedLines = new SpeedLines'), "expected SpeedLines instance");
assert.ok(mainSource.includes("speedLines.render(hudState.speed);"), "expected speed lines to update from HUD speed");

for (const threshold of [60, 80, 100, 120]) {
  assert.ok(
    stylesSource.includes(`speed-lines-tier-${threshold}`),
    `expected CSS tier for speed ${threshold}`
  );
}

assert.ok(stylesSource.includes("@keyframes speed-line-rush"), "expected speed line rush animation");
assert.ok(stylesSource.includes("pointer-events: none"), "expected speed lines to avoid blocking gameplay controls");

const speedLinesSource = await fs.readFile(path.resolve("src/ui/speedLines.ts"), "utf8");
assert.ok(speedLinesSource.includes("speed >= 120"), "expected top speed tier at 120");
assert.ok(speedLinesSource.includes("speed >= 100"), "expected third speed tier at 100");
assert.ok(speedLinesSource.includes("speed >= 80"), "expected second speed tier at 80");
assert.ok(speedLinesSource.includes("speed >= 60"), "expected first speed tier at 60");

console.log("Speed line overlay OK");
