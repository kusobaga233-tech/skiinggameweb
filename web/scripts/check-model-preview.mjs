import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const viteConfig = await fs.readFile(path.resolve("vite.config.ts"), "utf8");
const previewHtml = await fs.readFile(path.resolve("model-preview.html"), "utf8");
const previewMain = await fs.readFile(path.resolve("src/modelPreview/main.ts"), "utf8");

assert.ok(
  viteConfig.includes('modelPreview: resolve(__dirname, "model-preview.html")'),
  "expected model-preview.html to be registered as a Vite build input"
);
assert.ok(previewHtml.includes('id="model-preview-canvas"'), "expected preview canvas in model-preview.html");
assert.ok(previewMain.includes("skiing_lady.glb"), "expected preview entry to reference skiing_lady.glb");

console.log("Model preview wiring OK");
