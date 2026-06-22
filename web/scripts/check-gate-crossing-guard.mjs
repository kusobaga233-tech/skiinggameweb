import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const runSessionPath = resolve(root, "src/game/runSession.ts");
const skierControllerPath = resolve(root, "src/game/skierController.ts");
const packagePath = resolve(root, "package.json");

const runSessionSource = readFileSync(runSessionPath, "utf8");
const skierControllerSource = readFileSync(skierControllerPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

const failures = [];

if (!/evaluateGate\s*\(\s*skierX:\s*number,\s*previousSkierZ:\s*number,\s*skierZ:\s*number\s*\)/.test(runSessionSource)) {
  failures.push("RunSession.evaluateGate must receive previousSkierZ and current skierZ.");
}

if (!/previousSkierZ\s*<\s*gate\.z\s*&&\s*skierZ\s*>=\s*gate\.z/.test(runSessionSource)) {
  failures.push("Gate evaluation must require a real previousZ -> currentZ crossing.");
}

if (!/evaluateGate\s*\(\s*this\.skier\.position\.x,\s*previousZ,\s*this\.skier\.position\.z\s*\)/.test(skierControllerSource)) {
  failures.push("SkierController must pass previousZ into RunSession.evaluateGate.");
}

if (packageJson.scripts?.["check:gate-crossing"] !== "node scripts/check-gate-crossing-guard.mjs") {
  failures.push("package.json must expose check:gate-crossing.");
}

if (failures.length > 0) {
  console.error("Gate crossing guard check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Gate crossing guard check passed.");
