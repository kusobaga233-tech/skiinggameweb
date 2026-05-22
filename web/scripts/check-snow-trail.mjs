import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/game/snowTrail.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
});

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiiing-snow-trail-check-"));
const compiledPath = path.join(tempDir, "snowTrail.mjs");
await fs.writeFile(compiledPath, transpiled.outputText, "utf8");

const { evaluateSnowTrailState } = await import(pathToFileURL(compiledPath).href);

const idle = evaluateSnowTrailState({
  movementEnabled: false,
  grounded: true,
  speed: 0,
  maxForwardSpeed: 150,
  steer: 0,
  lateralVelocity: 0
});
assert.equal(idle.active, false, "expected snow trail idle when movement is disabled");
assert.equal(idle.emissionRate, 0, "expected no emission while idle");

const slowGlide = evaluateSnowTrailState({
  movementEnabled: true,
  grounded: true,
  speed: 8,
  maxForwardSpeed: 150,
  steer: 0.04,
  lateralVelocity: 0.2
});
assert.equal(slowGlide.active, false, "expected low-speed straight glide to avoid constant snow spray");

const cruise = evaluateSnowTrailState({
  movementEnabled: true,
  grounded: true,
  speed: 55,
  maxForwardSpeed: 150,
  steer: 0.08,
  lateralVelocity: 1.5
});
assert.equal(cruise.active, true, "expected visible snow trail once the skier is gliding at speed");
assert.ok(cruise.emissionRate >= 22, `expected cruise emission to remain visible after tightening the spray, got ${cruise.emissionRate}`);
assert.ok(cruise.maxSize > cruise.minSize, "expected particle size range for snow trail");
assert.ok(cruise.maxSize <= 0.12, `expected tightened cruise particle size, got ${cruise.maxSize.toFixed(2)}`);
assert.ok(cruise.maxLifeTime <= 0.14, `expected tightened cruise particle lifetime, got ${cruise.maxLifeTime.toFixed(2)}`);

const carve = evaluateSnowTrailState({
  movementEnabled: true,
  grounded: true,
  speed: 95,
  maxForwardSpeed: 150,
  steer: 0.75,
  lateralVelocity: -7.8
});
assert.equal(carve.active, true, "expected snow trail during strong carve");
assert.ok(carve.emissionRate > cruise.emissionRate, "expected carve to emit more snow than straight cruising");
assert.ok(carve.maxEmitPower > cruise.maxEmitPower, "expected carve to throw snow harder than straight cruising");
assert.ok(carve.maxSize <= 0.14, `expected carve snow particles to stay compact, got ${carve.maxSize.toFixed(2)}`);
assert.ok(carve.maxLifeTime <= 0.16, `expected carve snow particles to fade quickly, got ${carve.maxLifeTime.toFixed(2)}`);
assert.ok(carve.driftX > 0.08, `expected left carve to spray outward to skier right, got ${carve.driftX.toFixed(2)}`);

const airborne = evaluateSnowTrailState({
  movementEnabled: true,
  grounded: false,
  speed: 95,
  maxForwardSpeed: 150,
  steer: 0.75,
  lateralVelocity: -7.8
});
assert.equal(airborne.active, false, "expected snow trail to stop when airborne");
assert.equal(airborne.emissionRate, 0, "expected no airborne snow emission");

console.log("Snow trail tuning OK");
