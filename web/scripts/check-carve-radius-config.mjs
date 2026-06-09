import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve("..");
const configSource = await fs.readFile(path.resolve(repoRoot, "config.txt"), "utf8");
const runtimeConfigSource = await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const skierControllerSource = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.match(configSource, /carve_radius_min\s*=/, "expected carve_radius_min in config.txt");
assert.match(configSource, /carve_radius_max\s*=/, "expected carve_radius_max in config.txt");
assert.ok(runtimeConfigSource.includes("carveRadiusMin?: number;"), "expected RuntimeConfig.carveRadiusMin");
assert.ok(runtimeConfigSource.includes("carveRadiusMax?: number;"), "expected RuntimeConfig.carveRadiusMax");
assert.ok(runtimeConfigSource.includes('"carve_radius_min"'), "expected parser to read carve_radius_min");
assert.ok(runtimeConfigSource.includes('"carve_radius_max"'), "expected parser to read carve_radius_max");
assert.ok(mainSource.includes("carveRadiusMin: runtimeConfig.carveRadiusMin"), "expected main.ts to pass carve radius min");
assert.ok(mainSource.includes("carveRadiusMax: runtimeConfig.carveRadiusMax"), "expected main.ts to pass carve radius max");
assert.ok(skierControllerSource.includes("carveRadiusMin?: number;"), "expected SkierControllerConfig.carveRadiusMin");
assert.ok(skierControllerSource.includes("carveRadiusMax?: number;"), "expected SkierControllerConfig.carveRadiusMax");
assert.ok(skierControllerSource.includes("this.carveRadiusMin = config.carveRadiusMin ?? 14;"), "expected configurable carve radius min default");
assert.ok(skierControllerSource.includes("this.carveRadiusMax = config.carveRadiusMax ?? 118;"), "expected configurable carve radius max default");

console.log("Carve radius runtime config wiring OK");
