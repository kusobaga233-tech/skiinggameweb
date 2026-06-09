import type { MotionState } from "../pose/types";

export class BoostTutorialVideo {
  private visible = true;
  private tutorialPumpCount = 0;
  private unlockCycleReady = false;

  constructor(
    private readonly shell: HTMLElement,
    private readonly video: HTMLVideoElement
  ) {
    void this.video.play().catch(() => undefined);
  }

  render(motion: MotionState): void {
    if (motion.boostLocked) {
      this.unlockCycleReady = true;
      this.hide();
      return;
    }

    if (!this.visible && this.unlockCycleReady) {
      this.unlockCycleReady = false;
      this.show();
    }

    if (!this.visible) {
      return;
    }

    if (motion.pumpTriggered) {
      this.tutorialPumpCount += 1;
      if (this.tutorialPumpCount >= 2) {
        this.hide();
      }
    }
  }

  private show(): void {
    if (this.visible) {
      return;
    }

    this.visible = true;
    this.tutorialPumpCount = 0;
    this.shell.classList.toggle("is-hidden", false);
    this.video.currentTime = 0;
    void this.video.play().catch(() => undefined);
  }

  private hide(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;
    this.tutorialPumpCount = 0;
    this.shell.classList.toggle("is-hidden", true);
    this.video.pause();
  }
}
