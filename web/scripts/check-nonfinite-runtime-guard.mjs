import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const runSessionSource = await fs.readFile(path.resolve("src/game/runSession.ts"), "utf8");
const skierSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");
const loggerSource = await fs.readFile(path.resolve("src/debug/runtimeLogger.ts"), "utf8");

assert.match(
  runSessionSource,
  /Number\.isFinite\(skierZ\)/,
  "RunSession must ignore non-finite skierZ before starting, timing, finishing, or gate evaluation"
);
assert.match(
  runSessionSource,
  /Number\.isFinite\(skierX\)/,
  "RunSession must ignore non-finite skierX before gate evaluation"
);
assert.match(
  skierSource,
  /sanitizeRuntimeState/,
  "SkierController must sanitize non-finite position, velocity, speed, and camera state"
);
assert.match(
  skierSource,
  /Number\.isFinite\(this\.skier\.position\.x\)/,
  "SkierController guard must inspect skier position components"
);
assert.match(
  loggerSource,
  /nonFiniteNumber/,
  "RuntimeLogger must not serialize NaN or Infinity as 0"
);
assert.match(
  loggerSource,
  /Number\.isFinite\(value\)/,
  "RuntimeLogger must explicitly test number finiteness"
);

console.log("Non-finite runtime guards OK");
