import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/game/skierController.ts");
const sourceText = await fs.readFile(sourcePath, "utf8");

assert.ok(
  sourceText.includes("const counterSteerBlend = this.evaluateCounterSteerBlend();"),
  "expected heading update to compute counter-steer recovery blend"
);

assert.ok(
  sourceText.includes("const turnRate = (this.headingTurnRate * speedTurnPenalty * tuckTurnPenalty * slipPenalty + snowplowTurnBoost) * counterSteerTurnBoost;"),
  "expected opposite steering input to boost heading recovery rate"
);

assert.ok(
  sourceText.includes("const alignRate = this.lerp(this.carveSpeedAlignmentMin, this.carveSpeedAlignmentMax, this.edgeHold) * this.lerp(1, 0.24, this.driftSlip) * counterSteerAlignBoost;"),
  "expected opposite steering input to help velocity heading realign out of a saturated turn"
);

console.log("Counter-steer recovery OK");
