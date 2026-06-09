export class SpeedLines {
  private currentTierClass = "";

  constructor(private readonly shell: HTMLElement) {}

  render(speed: number): void {
    const tierClass = this.getTierClass(speed);
    if (tierClass === this.currentTierClass) {
      return;
    }

    if (this.currentTierClass) {
      this.shell.classList.remove(this.currentTierClass);
    }

    this.currentTierClass = tierClass;
    if (tierClass) {
      this.shell.classList.add(tierClass);
    }
  }

  private getTierClass(speed: number): string {
    if (speed >= 120) {
      return "speed-lines-tier-120";
    }

    if (speed >= 100) {
      return "speed-lines-tier-100";
    }

    if (speed >= 80) {
      return "speed-lines-tier-80";
    }

    if (speed >= 60) {
      return "speed-lines-tier-60";
    }

    return "";
  }
}
