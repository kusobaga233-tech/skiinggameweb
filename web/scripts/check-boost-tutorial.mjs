import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const html = await fs.readFile(path.resolve("index.html"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const tutorialSource = await fs.readFile(path.resolve("src/ui/boostTutorialVideo.ts"), "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");

assert.ok(html.includes('id="boost-tutorial-shell"'), "expected tutorial shell in index.html");
assert.ok(html.includes('id="boost-tutorial-video"'), "expected tutorial video element in index.html");
assert.ok(html.includes('/tutorials/pump-demo.mp4'), "expected tutorial mp4 source in index.html");
assert.ok(mainSource.includes("new BoostTutorialVideo("), "expected boost tutorial controller to be instantiated in main.ts");
assert.ok(mainSource.includes("boostTutorialVideo.render(hudState.motion)"), "expected boost tutorial controller to render from motion state");
assert.ok(tutorialSource.includes("!motion.boostLocked"), "expected tutorial visibility to depend on boostLocked state");
assert.ok(stylesSource.includes(".boost-tutorial-shell"), "expected tutorial shell styles");

console.log("Boost tutorial overlay OK");
