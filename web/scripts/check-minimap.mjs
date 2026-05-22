import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const indexHtml = await fs.readFile(path.resolve("index.html"), "utf8");
const poseTypes = await fs.readFile(path.resolve("src/pose/types.ts"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");

assert.ok(indexHtml.includes('id="mini-map"'), "expected mini-map canvas in index.html");
assert.ok(poseTypes.includes("playerX: number;"), "expected HudState.playerX in src/pose/types.ts");
assert.ok(poseTypes.includes("playerZ: number;"), "expected HudState.playerZ in src/pose/types.ts");
assert.ok(mainSource.includes("new MiniMap("), "expected MiniMap to be instantiated in src/main.ts");

console.log("Mini-map wiring OK");
