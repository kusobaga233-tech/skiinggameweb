export class SpeedMeter {
  private maxSpeed = 90;

  constructor(
    private readonly shell: HTMLElement,
    private readonly value: HTMLElement,
    private readonly bar: HTMLElement
  ) {}

  setMaxSpeed(maxSpeed: number | undefined): void {
    if (typeof maxSpeed === "number" && Number.isFinite(maxSpeed) && maxSpeed > 0) {
      this.maxSpeed = maxSpeed;
    }
  }

  render(speed: number): void {
    const clampedSpeed = Math.max(0, speed);
    this.value.textContent = clampedSpeed.toFixed(1);
    const fill = Math.max(0, Math.min(1, clampedSpeed / this.maxSpeed));
    this.bar.style.width = `${Math.round(fill * 100)}%`;
    this.shell.classList.toggle("is-fast", clampedSpeed >= this.maxSpeed * 0.5);
  }
}
