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

assert.ok(readNumber("carveRadiusMin") >= 14, "expected broader low-speed turning arc");
assert.ok(readNumber("carveRadiusMax") >= 110, "expected broader high-speed turning arc");
assert.ok(readNumber("headingTurnRate") <= 1.55, "expected slightly calmer heading turn response");

console.log("Turn arc softening OK");
