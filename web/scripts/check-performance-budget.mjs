import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const gameAppSource = await fs.readFile(path.resolve("src/game/gameApp.ts"), "utf8");
const miniMapSource = await fs.readFile(path.resolve("src/ui/miniMap.ts"), "utf8");
const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
const viteConfigSource = await fs.readFile(path.resolve("vite.config.ts"), "utf8");
const packageSource = await fs.readFile(path.resolve("package.json"), "utf8");

assert.ok(
  gameAppSource.includes("uiUpdateIntervalMs") && gameAppSource.includes("shouldUpdateUi"),
  "expected UI updates to be throttled outside the render-rate path"
);
assert.ok(
  miniMapSource.includes("trackPath") && miniMapSource.includes("drawImage"),
  "expected minimap to cache the static course layer instead of redrawing every sample each frame"
);
assert.ok(
  sceneBuilderSource.includes("ENABLE_DYNAMIC_BACKDROP = false"),
  "expected expensive dynamic backdrop to stay disabled in the main gameplay scene"
);
assert.ok(
  viteConfigSource.includes("strictPort: true"),
  "expected Vite dev server to fail instead of silently changing ports"
);
assert.ok(
  packageSource.includes("\"client\"") && packageSource.includes("localhost:5173"),
  "expected package scripts to expose one canonical localhost client address"
);

console.log("Performance budget and client address checks OK");
