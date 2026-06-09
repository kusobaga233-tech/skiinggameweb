import type { HudState } from "../pose/types";

export class Hud {
  constructor(
    private readonly output: HTMLElement,
    private readonly poseStatus: HTMLElement
  ) {}

  render(state: HudState): void {
    this.output.textContent =
      `Score: ${state.score}\n` +
      `Gates: ${state.clearedGates}/${state.totalGates}  Missed: ${state.missedGates}\n` +
      `Ramps: ${state.rampHits}  Air Bonus: ${state.airBonuses}\n` +
      `Time: ${state.elapsedTime.toFixed(1)}s\n` +
      `Started: ${state.started}\n` +
      `Paused: ${state.paused}\n` +
      `Speed: ${state.speed.toFixed(1)}\n` +
      `Completed: ${state.completed}\n` +
      `Camera: ${state.cameraLabel}\n` +
      `Pose: ${state.poseMessage}\n` +
      `Pose FPS: ${state.poseFps.toFixed(1)}  Inference: ${state.inferenceMs.toFixed(1)}ms\n` +
      `Steer: ${state.motion.steer.toFixed(2)}\n` +
      `Tuck: ${state.motion.tuck.toFixed(2)}\n` +
      `Drive: ${state.motion.drive.toFixed(2)}  Pump: ${state.motion.pumpActive}  Hits: ${state.motion.pumpHits}\n` +
      `Boost Lock: ${state.motion.boostLocked}  Remaining: ${(state.motion.boostRemainingMs / 1000).toFixed(1)}s\n` +
      `Confidence: ${state.motion.confidence.toFixed(2)}\n` +
      `Edge Hold: ${state.edgeHold.toFixed(2)}  Drift Slip: ${state.driftSlip.toFixed(2)}\n` +
      `Source: ${state.motion.source}`;

    this.poseStatus.textContent = `${state.poseMessage} | ${state.cameraLabel}`;
  }
}
