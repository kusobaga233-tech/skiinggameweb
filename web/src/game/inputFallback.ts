import type { MotionState } from "../pose/types";

export class KeyboardFallback {
  private steer = 0;
  private tuck = 0;
  private brake = 0;
  private drive = 0;
  private jumpQueued = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (event) => this.handleKeyDown(event));
    target.addEventListener("keyup", (event) => this.handleKeyUp(event));
  }

  consumeState(): MotionState {
    const state: MotionState = {
      steer: this.steer,
      tuck: this.tuck,
      brake: this.brake,
      jumpTriggered: this.jumpQueued,
      pumpTriggered: false,
      drive: this.drive,
      pumpActive: this.drive > 0,
      pumpHits: this.drive > 0 ? 3 : 0,
      boostLocked: false,
      boostRemainingMs: 0,
      confidence: this.steer !== 0 || this.tuck !== 0 || this.brake !== 0 || this.jumpQueued || this.drive > 0 ? 1 : 0,
      source: "keyboard",
      tracking: true
    };
    this.jumpQueued = false;
    return state;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "KeyA") {
      this.steer = 1;
    } else if (event.code === "KeyD") {
      this.steer = -1;
    } else if (event.code === "KeyW") {
      this.drive = 1;
    } else if (event.code === "KeyS") {
      this.tuck = 1;
    } else if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      this.brake = 1;
    } else if (event.code === "Space") {
      this.jumpQueued = true;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if ((event.code === "KeyA" && this.steer < 0) || (event.code === "KeyD" && this.steer > 0)) {
      this.steer = 0;
    } else if (event.code === "KeyW") {
      this.drive = 0;
    } else if (event.code === "KeyS") {
      this.tuck = 0;
    } else if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      this.brake = 0;
    }
  }
}
