import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/ui/hud.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("Edge Hold:")
    && sourceText.includes("Drift Slip:"),
  "expected HUD to expose carving debug values"
);

console.log("Carving HUD debug OK");
