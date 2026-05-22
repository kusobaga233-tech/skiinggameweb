import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("private readonly downhillTurnTargetLiftScale = 0.76;"),
  "expected downhill turn target-lift scaling to reduce excessive close-up framing"
);

assert.ok(
  sourceText.includes("private readonly downhillTurnTargetLeadZScale = 0.72;"),
  "expected downhill turn target-lead scaling to avoid pulling the camera target too far ahead"
);

assert.ok(
  sourceText.includes("private readonly downhillTurnRadiusBoost = 1.45;"),
  "expected downhill turn radius compensation to keep character distance closer to flat-ground framing"
);

assert.ok(
  sourceText.includes("const downhillTurnDistanceBlend = turnFollowBlend * downhillCameraBlend;"),
  "expected a dedicated downhill-turn distance blend when composing the camera target"
);

assert.ok(
  sourceText.includes("const targetLiftScale = this.lerp(1, this.downhillTurnTargetLiftScale, downhillTurnDistanceBlend);"),
  "expected downhill-turn lift scaling when composing playerTarget"
);

assert.ok(
  sourceText.includes("const targetLeadZScale = this.lerp(1, this.downhillTurnTargetLeadZScale, downhillTurnDistanceBlend);"),
  "expected downhill-turn forward target scaling when composing playerTarget"
);

assert.ok(
  /\+\s*downhillTurnDistanceBlend\s*\*\s*this\.downhillTurnRadiusBoost/.test(sourceText),
  "expected downhill-turn distance blend to add extra camera radius compensation"
);

console.log("Camera downhill-turn distance check OK");
