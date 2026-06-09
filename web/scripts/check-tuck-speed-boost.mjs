import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

function readNumber(name) {
  const match = sourceText.match(new RegExp(`private readonly ${name} = ([0-9.]+);`));
  assert.ok(match, `expected numeric tuning constant ${name}`);
  return Number(match[1]);
}

assert.ok(readNumber("maxTuckSpeedBonusRatio") >= 0.09, "expected crouch boost base ratio to stay in a clearly noticeable range");

assert.ok(
  sourceText.includes("1 + this.maxTuckSpeedBonusRatio * tuckEffect * (0.82 + downhillFactor * 0.3);"),
  "expected crouch speed bonus to stay noticeable even on moderate downhill while keeping the total cap near 10%"
);

assert.ok(
  sourceText.includes("? this.accelerationResponse * (0.58 + driveEffect * 0.62 + tuckEffect * 0.42)"),
  "expected crouch-triggered acceleration to ramp in faster once active"
);

console.log("Tuck speed boost OK");
