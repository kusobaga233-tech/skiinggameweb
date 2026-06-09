import type { HudState } from "../pose/types";

export class StartBoostMeter {
  private readonly hideAfterMs = 3000;
  private lockedElapsedMs = 0;
  private lastRenderMs = performance.now();

  constructor(
    private readonly shell: HTMLElement,
    private readonly fill: HTMLElement,
    private readonly value: HTMLElement
  ) {}

  render(state: HudState): void {
    const nowMs = performance.now();
    const deltaMs = Math.max(0, nowMs - this.lastRenderMs);
    this.lastRenderMs = nowMs;

    if (state.startBoostWaiting || !state.startBoostLocked) {
      this.lockedElapsedMs = 0;
    } else {
      this.lockedElapsedMs += deltaMs;
    }

    const visible = state.startBoostWaiting || (state.startBoostLocked && this.lockedElapsedMs < this.hideAfterMs);
    this.shell.classList.toggle("is-hidden", !visible);
    this.shell.classList.toggle("is-locked", state.startBoostLocked);

    const progress = Math.max(0, Math.min(1, state.startBoostProgress));
    this.fill.style.width = `${Math.round(progress * 100)}%`;
    this.value.textContent = state.startBoostLocked
      ? `+${Math.round(state.startBoostBonusRatio * 100)}%`
      : "READY";
  }
}
