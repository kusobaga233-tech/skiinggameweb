import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/sceneBuilder.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("createTurnEntryArrowSigns(scene, course);"),
  "expected scene builder to create dedicated turn entry arrow signs"
);

assert.ok(
  sourceText.includes("function createTurnEntryArrowSigns"),
  "expected dedicated turn entry arrow sign helper"
);

assert.ok(
  sourceText.includes("context.fillText(entryHint.arrowText, 512, 176);"),
  "expected turn entry signs to render dynamic arrow glyphs from entry hint logic"
);

assert.ok(
  sourceText.includes("const entryMidZ = turn.start - 58"),
  "expected turn entry signs to sit at the middle of the recommended entry window"
);

assert.ok(
  sourceText.includes("const edgeSign = turn.direction === \"left\" ? 1 : -1"),
  "expected turn entry signs to choose the outside course edge based on turn direction"
);

assert.ok(
  sourceText.includes("const centerX = evaluateCourseCenterX(entryMidZ) + edgeSign * (course.courseHalfWidth + 3.2)"),
  "expected turn entry signs to be placed beside the course edge instead of the centerline"
);

console.log("Turn entry arrow signage OK");
