import type { MotionState } from "../pose/types";

export class BoostTutorialVideo {
  private visible = true;

  constructor(
    private readonly shell: HTMLElement,
    private readonly video: HTMLVideoElement
  ) {
    void this.video.play().catch(() => undefined);
  }

  render(motion: MotionState): void {
    const shouldShow = !motion.boostLocked;
    if (shouldShow === this.visible) {
      return;
    }

    this.visible = shouldShow;
    this.shell.classList.toggle("is-hidden", !shouldShow);

    if (shouldShow) {
      this.video.currentTime = 0;
      void this.video.play().catch(() => undefined);
      return;
    }

    this.video.pause();
  }
}
