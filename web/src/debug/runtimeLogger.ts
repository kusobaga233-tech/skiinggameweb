import type { HudState, MotionState } from "../pose/types";

export interface RuntimeLogEvent {
  t: number;
  type: string;
  data: Record<string, unknown>;
}

export class RuntimeLogger {
  private readonly startedAt = Date.now();
  private readonly events: RuntimeLogEvent[] = [];
  private readonly maxEvents: number;
  private lastHudCaptureMs = -Infinity;

  constructor(maxEvents = 2400) {
    this.maxEvents = maxEvents;
    window.addEventListener("error", (event) => {
      this.capture("window.error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error instanceof Error ? event.error.stack : null
      });
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      this.capture("window.unhandledrejection", {
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : null
      });
    });
  }

  capture(type: string, data: Record<string, unknown> = {}): void {
    this.events.push({
      t: Date.now() - this.startedAt,
      type,
      data
    });

    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  captureHudState(state: HudState): void {
    const now = performance.now();
    if (now - this.lastHudCaptureMs < 100) {
      return;
    }

    this.lastHudCaptureMs = now;
    this.capture("hud.frame", {
      speed: this.round(state.speed),
      playerX: this.round(state.playerX),
      playerZ: this.round(state.playerZ),
      elapsedTime: this.round(state.elapsedTime),
      started: state.started,
      completed: state.completed,
      paused: state.paused,
      gates: `${state.clearedGates}/${state.totalGates}`,
      missedGates: state.missedGates,
      edgeHold: this.round(state.edgeHold),
      driftSlip: this.round(state.driftSlip),
      cameraLabel: state.cameraLabel,
      poseMessage: state.poseMessage,
      poseFps: this.round(state.poseFps),
      inferenceMs: this.round(state.inferenceMs),
      motion: this.summarizeMotion(state.motion)
    });
  }

  downloadJson(): void {
    const payload = {
      app: "skiiing-web",
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: location.href,
      eventCount: this.events.length,
      events: this.events
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `skiiing-log-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private summarizeMotion(motion: MotionState): Record<string, unknown> {
    return {
      source: motion.source,
      tracking: motion.tracking,
      confidence: this.round(motion.confidence),
      steer: this.round(motion.steer),
      tuck: this.round(motion.tuck),
      drive: this.round(motion.drive),
      snowplow: this.round(motion.snowplow),
      brake: this.round(motion.brake),
      pumpTriggered: motion.pumpTriggered,
      pumpActive: motion.pumpActive,
      pumpHits: motion.pumpHits,
      boostLocked: motion.boostLocked,
      boostRemainingMs: Math.round(motion.boostRemainingMs)
    };
  }

  private round(value: number): number {
    return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
  }
}
