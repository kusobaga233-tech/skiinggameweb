import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const skierControllerPath = resolve(root, "src/game/skierController.ts");
const packagePath = resolve(root, "package.json");

const skierControllerSource = readFileSync(skierControllerPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

const failures = [];

if (!/private readonly maxFrameTravelScale\s*=/.test(skierControllerSource)) {
  failures.push("SkierController must define maxFrameTravelScale for per-frame travel guard.");
}

if (!/private clampFrameTravel\(\s*previousZ:\s*number,\s*proposedZ:\s*number,\s*dt:\s*number\s*\):\s*number/.test(skierControllerSource)) {
  failures.push("SkierController must clamp impossible finite z teleports.");
}

if (!/const proposedZ = this\.clampFrameTravel\(previousZ,\s*rawProposedZ,\s*dt\)/.test(skierControllerSource)) {
  failures.push("Movement integration must use clampFrameTravel before course/lane sampling.");
}

if (packageJson.scripts?.["check:skier-step"] !== "node scripts/check-skier-step-guard.mjs") {
  failures.push("package.json must expose check:skier-step.");
}

if (failures.length > 0) {
  console.error("Skier step guard check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Skier step guard check passed.");
