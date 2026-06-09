import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sceneBuilderSource = await fs.readFile(path.resolve("src/game/sceneBuilder.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.match(
  sceneBuilderSource,
  /applyPose\(\s*tuck: number,\s*glide = 0,\s*carve = 0,\s*turnBlend = 0,\s*lateralLean = 0,\s*pumpBlend = 0,\s*brakeBlend = 0,\s*edgeHold = 0,\s*driftSlip = 0\s*\): void/,
  "expected skier avatar rig pose API to accept edgeHold and driftSlip"
);

assert.ok(
  sceneBuilderSource.includes("const carveGripBlend = carveBlend * clamp01(0.3 + edgeHold * 0.85) * clamp01(1 - driftSlip * 0.78);"),
  "expected carve pose to strengthen with edgeHold and relax with driftSlip"
);

assert.ok(
  sceneBuilderSource.includes("const driftWashBlend = carveBlend * driftSlip;"),
  "expected carve pose to compute a drift washout blend"
);

assert.match(
  skierControllerSource,
  /this\.skierAvatarRig\.applyPose\([\s\S]*?motion\.brake,\s*this\.edgeHold,\s*this\.driftSlip[\s\S]*?\)/,
  "expected skier controller to forward edgeHold and driftSlip into avatar pose"
);

console.log("Carve pose dynamics check OK");
