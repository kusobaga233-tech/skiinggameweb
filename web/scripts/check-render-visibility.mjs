import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const gameAppSource = await fs.readFile(path.resolve("src/game/gameApp.ts"), "utf8");
const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");

assert.ok(
  sceneBuilderSource.includes("scene.activeCamera = camera"),
  "expected buildScene to explicitly assign the active camera"
);
assert.ok(
  sceneBuilderSource.includes("tryCreateDynamicBackdrop"),
  "expected dynamic backdrop creation to be isolated behind a safe wrapper"
);
assert.ok(
  gameAppSource.includes("this.built.engine.resize()"),
  "expected GameApp.start to resize the engine before rendering"
);
assert.ok(
  stylesSource.includes("#game-canvas") && stylesSource.includes("z-index: 0"),
  "expected canvas layer to have an explicit base z-index"
);
assert.ok(
  stylesSource.includes("@media (max-width: 960px)") && stylesSource.includes(".boost-tutorial-shell"),
  "expected small screens to reduce nonessential overlay obstruction"
);

console.log("Render visibility guards OK");
