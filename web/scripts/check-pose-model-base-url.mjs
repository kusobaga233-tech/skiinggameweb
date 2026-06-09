import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const source = await fs.readFile(path.resolve("src/pose/poseRuntime.ts"), "utf8");

assert.ok(
  source.includes("import.meta.env.BASE_URL"),
  "expected pose model path to respect Vite BASE_URL for GitHub Pages subpath deployments"
);

assert.ok(
  !source.includes('modelAssetPath: "/models/pose_landmarker_full.task"'),
  "expected pose model path not to use a domain-root absolute /models URL"
);

console.log("Pose model BASE_URL path OK");
