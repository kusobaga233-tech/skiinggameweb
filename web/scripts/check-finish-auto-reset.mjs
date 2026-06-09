import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/gameApp.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("private readonly finishAutoResetDelay"),
  "expected a dedicated finish auto-reset delay in GameApp"
);

assert.ok(
  sourceText.includes("private completedAutoResetTimer = 0;"),
  "expected GameApp to track completed-state reset time"
);

assert.ok(
  sourceText.includes("this.runSession.getStats().completed")
    && sourceText.includes("this.completedAutoResetTimer += dt;")
    && sourceText.includes("if (this.completedAutoResetTimer >= this.finishAutoResetDelay)")
    && sourceText.includes("this.restart();"),
  "expected GameApp to restart automatically after a short completed-state delay"
);

console.log("Finish auto reset wiring OK");
