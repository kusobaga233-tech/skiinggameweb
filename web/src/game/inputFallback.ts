import type { MotionState } from "../pose/types";

export class KeyboardFallback {
  private steer = 0;
  private tuck = 0;
  private drive = 0;
  private leftScrapePole = 0;
  private rightScrapePole = 0;
  private pumpTriggeredQueued = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (event) => this.handleKeyDown(event));
    target.addEventListener("keyup", (event) => this.handleKeyUp(event));
  }

  consumeState(): MotionState {
    const pumpTriggered = this.pumpTriggeredQueued;
    this.pumpTriggeredQueued = false;

    const state: MotionState = {
      steer: this.steer,
      snowplow: 0,
      tuck: this.tuck,
      brake: 0,
      jumpTriggered: false,
      pumpTriggered,
      drive: this.drive,
      pumpActive: this.drive > 0,
      pumpHits: this.drive > 0 ? 3 : 0,
      boostLocked: false,
      boostRemainingMs: 0,
      confidence:
        this.steer !== 0
        || this.tuck !== 0
        || this.drive > 0
        || this.leftScrapePole > 0
        || this.rightScrapePole > 0
          ? 1
          : 0,
      source: "keyboard",
      tracking: true
    };
    return state;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "KeyA") {
      this.steer = 1;
    } else if (event.code === "KeyD") {
      this.steer = -1;
    } else if (event.code === "KeyW") {
      if (this.drive === 0) {
        this.pumpTriggeredQueued = true;
      }
      this.drive = 1;
    } else if (event.code === "KeyJ") {
      this.leftScrapePole = 1;
    } else if (event.code === "KeyK") {
      this.rightScrapePole = 1;
    } else if (event.code === "KeyS") {
      this.tuck = 1;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if ((event.code === "KeyA" && this.steer > 0) || (event.code === "KeyD" && this.steer < 0)) {
      this.steer = 0;
    } else if (event.code === "KeyW") {
      this.drive = 0;
    } else if (event.code === "KeyJ") {
      this.leftScrapePole = 0;
    } else if (event.code === "KeyK") {
      this.rightScrapePole = 0;
    } else if (event.code === "KeyS") {
      this.tuck = 0;
    }
  }
}
