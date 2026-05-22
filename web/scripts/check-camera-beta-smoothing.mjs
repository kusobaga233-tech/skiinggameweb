import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("private currentTurnPreviewBetaOffset = 0;"),
  "expected a dedicated smoothed turn-preview beta offset state for gentler overhead transitions"
);

assert.ok(
  sourceText.includes("this.currentTurnPreviewBetaOffset = this.lerp("),
  "expected turn-preview beta offset to be smoothed over time instead of snapping to the raw preview value"
);

assert.ok(
  sourceText.includes("cameraBetaTarget + this.currentTurnPreviewBetaOffset + this.airCameraBlend * this.airCameraBetaBoost"),
  "expected camera beta target to use the smoothed turn-preview overhead offset"
);

console.log("Camera beta smoothing check OK");
