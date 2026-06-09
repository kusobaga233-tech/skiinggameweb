import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve("..");
const configPath = path.resolve(repoRoot, "config.txt");
const mainSource = await fs.readFile(path.resolve("src/main.ts"), "utf8");
const poseRuntimeSource = await fs.readFile(path.resolve("src/pose/poseRuntime.ts"), "utf8");
const viteConfigSource = await fs.readFile(path.resolve("vite.config.ts"), "utf8");

let configSource = "";
try {
  configSource = await fs.readFile(configPath, "utf8");
} catch {
  assert.fail("expected project root config.txt to exist");
}

assert.match(configSource, /body_steer_gain\s*=/, "expected body_steer_gain in root config.txt");
assert.match(configSource, /body_steer_deadzone\s*=/, "expected body_steer_deadzone in root config.txt");
assert.match(configSource, /body_steer_alpha\s*=/, "expected body_steer_alpha in root config.txt");
assert.match(configSource, /body_steer_curve_exponent\s*=/, "expected body_steer_curve_exponent in root config.txt");
assert.match(configSource, /body_steer_gameplay_scale\s*=/, "expected body_steer_gameplay_scale in root config.txt");
assert.match(mainSource, /config\.txt|loadRuntimeConfig|body_steer_gain/, "expected main.ts to load runtime config");
assert.ok(
  poseRuntimeSource.includes("motionMapper?: Partial<MotionMapperConfig>;")
    && poseRuntimeSource.includes("constructor(config: PoseRuntimeConfig = {})")
    && poseRuntimeSource.includes("this.mapper = new MotionMapper(config.motionMapper);"),
  "expected PoseRuntime to accept injected MotionMapper config instead of hard-coded defaults"
);
assert.ok(
  mainSource.includes("loadRuntimeConfig()")
    && mainSource.includes("motionMapper: {")
    && mainSource.includes("steerGain: runtimeConfig.bodySteerGain")
    && mainSource.includes("steerDeadzone: runtimeConfig.bodySteerDeadzone")
    && mainSource.includes("steerAlpha: runtimeConfig.bodySteerAlpha")
    && mainSource.includes("steerCurveExponent: runtimeConfig.bodySteerCurveExponent")
    && mainSource.includes("poseSteerScale: runtimeConfig.bodySteerGameplayScale"),
  "expected main.ts to pass body steer tuning config into PoseRuntime and GameApp"
);
assert.ok(
  /bodySteerCurveExponent\?: number;/.test(await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8"))
    && /bodySteerGameplayScale\?: number;/.test(await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8"))
    && /body_steer_curve_exponent/.test(await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8"))
    && /body_steer_gameplay_scale/.test(await fs.readFile(path.resolve("src/config/runtimeConfig.ts"), "utf8")),
  "expected runtimeConfig.ts to parse body_steer_curve_exponent and body_steer_gameplay_scale"
);
assert.match(viteConfigSource, /config\.txt/, "expected vite.config.ts to expose root config.txt to the client");

console.log("Body steer runtime config wiring OK");
