import type { GateData, RampData, TrackCourse } from "./trackCourse";

export interface RunStats {
  score: number;
  clearedGates: number;
  missedGates: number;
  totalGates: number;
  rampHits: number;
  airBonuses: number;
  elapsedTime: number;
  started: boolean;
  completed: boolean;
}

export class RunSession {
  private readonly gateScore = 100;
  private readonly rampAirBonus = 150;

  private elapsedSeconds = 0;
  private stats: RunStats;

  constructor(private readonly course: TrackCourse) {
    this.stats = this.createInitialStats();
  }

  reset(): void {
    this.elapsedSeconds = 0;
    this.stats = this.createInitialStats();
    this.course.gates.forEach((gate) => {
      gate.state = "pending";
    });
    this.course.ramps.forEach((ramp) => {
      ramp.consumed = false;
    });
  }

  update(dt: number, skierZ: number, startTriggered: boolean): void {
    if (this.stats.completed) {
      return;
    }

    if (!this.stats.started) {
      if (!startTriggered) {
        return;
      }
      this.stats.started = true;
    }

    this.elapsedSeconds += dt;
    this.stats.elapsedTime = this.elapsedSeconds;
    if (skierZ >= this.course.length) {
      this.stats.completed = true;
    }
  }

  evaluateGate(skierX: number, skierZ: number): void {
    const gate = this.course.gates.find((item) => item.state === "pending");
    if (!gate || skierZ < gate.z) {
      return;
    }

    if (Math.abs(skierX - gate.centerX) <= gate.halfWidth) {
      gate.state = "cleared";
      this.stats.clearedGates += 1;
      this.stats.score += this.gateScore;
    } else {
      gate.state = "missed";
      this.stats.missedGates += 1;
    }
  }

  consumeRamp(
    skierX: number,
    previousSkierZ: number,
    skierZ: number,
    jumpHeld: boolean
  ): { launchBoost: number; airBonus: boolean } | null {
    const minSkierZ = Math.min(previousSkierZ, skierZ);
    const maxSkierZ = Math.max(previousSkierZ, skierZ);
    const ramp = this.course.ramps.find((item) => {
      const insideX = Math.abs(skierX - item.centerX) <= item.halfWidth;
      const endZ = item.centerZ + item.length * 0.5;
      const crossesExit = minSkierZ <= endZ && maxSkierZ >= endZ;
      return !item.consumed && insideX && crossesExit;
    });

    if (!ramp) {
      return null;
    }

    ramp.consumed = true;
    this.stats.rampHits += 1;

    let airBonus = false;
    if (jumpHeld) {
      this.stats.airBonuses += 1;
      this.stats.score += this.rampAirBonus;
      airBonus = true;
    }

    return {
      launchBoost: ramp.launchBoost,
      airBonus
    };
  }

  getStats(): RunStats {
    return { ...this.stats };
  }

  isCompleted(): boolean {
    return this.stats.completed;
  }

  private createInitialStats(): RunStats {
    return {
      score: 0,
      clearedGates: 0,
      missedGates: 0,
      totalGates: this.course.gates.length,
      rampHits: 0,
      airBonuses: 0,
      elapsedTime: 0,
      started: false,
      completed: false
    };
  }
}
