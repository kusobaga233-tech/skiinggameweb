import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const gameAppSource = await fs.readFile(path.resolve("src/game/gameApp.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");
const typesSource = await fs.readFile(path.resolve("src/pose/types.ts"), "utf8");
const htmlSource = await fs.readFile(path.resolve("index.html"), "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");

assert.ok(
  gameAppSource.includes("private readonly maxStartBoostBonusRatio = 0.3;"),
  "expected start boost bonus to be capped at 30%"
);

assert.ok(
  gameAppSource.includes("return motion.tracking && motion.pumpTriggered;"),
  "expected pose start to require one recognized pole plant instead of two"
);

assert.ok(
  gameAppSource.includes("this.skierController.setStartBoostBonusRatio(this.startBoostBonusRatio);"),
  "expected GameApp to pass frozen start boost bonus into SkierController"
);

assert.ok(
  skierControllerSource.includes("setStartBoostBonusRatio(ratio: number): void"),
  "expected SkierController to accept a start boost bonus ratio"
);

assert.ok(
  skierControllerSource.includes("const startBoostMultiplier = 1 + this.startBoostBonusRatio * startBoostBlend;"),
  "expected start speed governor to apply a tapering 0-30% start boost"
);

for (const field of [
  "startBoostProgress: number;",
  "startBoostBonusRatio: number;",
  "startBoostLocked: boolean;",
  "startBoostWaiting: boolean;"
]) {
  assert.ok(typesSource.includes(field), `expected HudState.${field}`);
}

assert.ok(htmlSource.includes('id="start-boost-shell"'), "expected start boost meter shell in index.html");
assert.ok(htmlSource.includes('id="start-boost-fill"'), "expected start boost meter fill in index.html");
assert.ok(stylesSource.includes(".start-boost-shell"), "expected start boost meter styles");
assert.ok(mainSource.includes("new StartBoostMeter("), "expected StartBoostMeter to be created in main.ts");
assert.ok(mainSource.includes("startBoostMeter.render(hudState)"), "expected StartBoostMeter to render from HudState");

console.log("Start boost meter wiring OK");
