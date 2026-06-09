import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const sourceText = await fs.readFile(path.resolve("src/game/skierController.ts"), "utf8");

assert.ok(sourceText.includes("private readonly gravity = -20;"), "expected gravity for ramp airborne physics");
assert.ok(sourceText.includes("private verticalVelocity = 0;"), "expected vertical velocity state");
assert.ok(sourceText.includes("private airborne = false;"), "expected airborne state");
assert.ok(sourceText.includes("this.startRampLaunch(ramp.launchBoost);"), "expected ramp consume to start vertical launch");
assert.ok(sourceText.includes("private startRampLaunch(launchBoost: number): void"), "expected dedicated ramp launch helper");
assert.ok(sourceText.includes("this.verticalVelocity = Math.max(this.verticalVelocity, launchBoost);"), "expected ramp launch to set upward velocity");
assert.ok(sourceText.includes("this.updateVerticalMotion(courseGroundY, dt);"), "expected vertical motion update after ground sampling");
assert.ok(sourceText.includes("snowTrail: this.createSnowTrailState(true, !this.airborne)"), "expected snow trail to stop while airborne");
assert.ok(sourceText.includes("this.skier.position.y += this.verticalVelocity * dt;"), "expected airborne Y integration");
assert.ok(sourceText.includes("this.verticalVelocity += this.gravity * dt;"), "expected gravity integration");
assert.ok(
  sourceText.includes("if (!this.airborne) {\n      this.skier.position.y = courseGroundY + this.groundOffsetY;"),
  "expected grounded branch to keep skier attached to ramp/ground"
);
assert.ok(
  !sourceText.includes("stuntRotationX") && !sourceText.includes("startRampStunt"),
  "expected ramp fix to avoid restoring backflip stunt logic"
);

console.log("Ramp airborne physics OK");
