import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const viteConfig = await fs.readFile(path.resolve("vite.config.ts"), "utf8");
const debuggerHtml = await fs.readFile(path.resolve("animation-debugger.html"), "utf8");
const debuggerMain = await fs.readFile(path.resolve("src/animationDebugger/main.ts"), "utf8");

assert.ok(
  viteConfig.includes('animationDebugger: resolve(__dirname, "animation-debugger.html")'),
  "expected animation-debugger.html to be registered as a Vite build input"
);
assert.ok(
  debuggerHtml.includes('id="animation-debugger-canvas"'),
  "expected animation debugger canvas in animation-debugger.html"
);
assert.ok(
  debuggerHtml.includes('id="timeline-scrubber"'),
  "expected timeline scrubber in animation-debugger.html"
);
assert.ok(
  debuggerMain.includes("SkeletonViewer"),
  "expected animation debugger entry to support skeleton visualization"
);
assert.ok(
  debuggerMain.includes("skiing_lady.glb"),
  "expected animation debugger entry to reference skiing_lady.glb"
);

console.log("Animation debugger wiring OK");
