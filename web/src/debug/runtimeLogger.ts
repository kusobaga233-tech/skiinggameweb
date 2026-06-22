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
      speed: this.formatNumber(state.speed),
      playerX: this.formatNumber(state.playerX),
      playerZ: this.formatNumber(state.playerZ),
      elapsedTime: this.formatNumber(state.elapsedTime),
      started: state.started,
      completed: state.completed,
      paused: state.paused,
      gates: `${state.clearedGates}/${state.totalGates}`,
      missedGates: state.missedGates,
      edgeHold: this.formatNumber(state.edgeHold),
      driftSlip: this.formatNumber(state.driftSlip),
      cameraLabel: state.cameraLabel,
      poseMessage: state.poseMessage,
      poseFps: this.formatNumber(state.poseFps),
      inferenceMs: this.formatNumber(state.inferenceMs),
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
      confidence: this.formatNumber(motion.confidence),
      steer: this.formatNumber(motion.steer),
      tuck: this.formatNumber(motion.tuck),
      drive: this.formatNumber(motion.drive),
      snowplow: this.formatNumber(motion.snowplow),
      brake: this.formatNumber(motion.brake),
      pumpTriggered: motion.pumpTriggered,
      pumpActive: motion.pumpActive,
      pumpHits: motion.pumpHits,
      boostLocked: motion.boostLocked,
      boostRemainingMs: this.formatNumber(motion.boostRemainingMs)
    };
  }

  private formatNumber(value: number): number | { nonFiniteNumber: string } {
    if (!Number.isFinite(value)) {
      return { nonFiniteNumber: String(value) };
    }

    return Math.round(value * 1000) / 1000;
  }
}
