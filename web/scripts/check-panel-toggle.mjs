import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const indexHtml = await fs.readFile(path.resolve("index.html"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const stylesSource = await fs.readFile(path.resolve("src/styles.css"), "utf8");

for (const id of ["toggle-hud-panel", "toggle-minimap-panel"]) {
  assert.ok(indexHtml.includes(`id="${id}"`), `expected ${id} button in index.html`);
  assert.ok(mainSource.includes(`"${id}"`), `expected ${id} to be wired in main.ts`);
}

assert.ok(indexHtml.includes("collapsible-panel"), "expected collapsible panel class on target UI panels");
assert.ok(indexHtml.includes('id="control-panel"'), "expected camera control panel to have an id for HUD-linked hiding");
assert.ok(mainSource.includes("bindPanelToggle"), "expected reusable panel toggle binding");
assert.ok(mainSource.includes("is-collapsed"), "expected panel toggle to switch collapsed state");
assert.ok(mainSource.includes("linkedPanels"), "expected panel toggle to support linked panels");
assert.ok(mainSource.includes("controlPanelShell"), "expected HUD toggle to reference camera control panel");
assert.ok(mainSource.includes("is-hidden-with-hud"), "expected HUD toggle to hide camera control panel");
assert.ok(stylesSource.includes(".collapsible-panel.is-collapsed"), "expected collapsed panel styling");
assert.ok(stylesSource.includes(".control-panel.is-hidden-with-hud"), "expected camera control panel hidden styling");
assert.ok(stylesSource.includes(".panel-toggle"), "expected panel toggle button styling");
assert.ok(stylesSource.includes(".panel-body"), "expected panel body styling for hide/show content");

console.log("Panel hide/show toggles OK");
