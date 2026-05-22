import type { MotionState, PoseSample } from "./types";

export interface MotionMapperConfig {
  steerGain: number;
  steerAlpha: number;
  tuckAlpha: number;
  brakeAlpha: number;
  brakeDecayAlpha: number;
  driveAlpha: number;
  driveDecayAlpha: number;
  neutralDecayAlpha: number;
  crouchThreshold: number;
  standThreshold: number;
  brakeCrouchStartThreshold: number;
  brakeCrouchFullThreshold: number;
  brakeSteerStartThreshold: number;
  brakeSteerFullThreshold: number;
  brakeArmSpreadStartRatio: number;
  brakeArmSpreadFullRatio: number;
  brakeArmDropStartThreshold: number;
  brakeArmDropFullThreshold: number;
  jumpVelocityThreshold: number;
  jumpCooldownMs: number;
  minConfidence: number;
  minArmConfidence: number;
  pumpEnterThreshold: number;
  pumpExitThreshold: number;
  pumpCooldownMs: number;
  pumpWindowMs: number;
  pumpMaxHits: number;
  pumpLockDurationMs: number;
  firstPumpDrive: number;
}

const DEFAULT_CONFIG: MotionMapperConfig = {
  steerGain: 6,
  steerAlpha: 0.25,
  tuckAlpha: 0.5,
  brakeAlpha: 0.38,
  brakeDecayAlpha: 0.58,
  driveAlpha: 0.24,
  driveDecayAlpha: 0.14,
  neutralDecayAlpha: 0.2,
  crouchThreshold: 0.82,
  standThreshold: 0.92,
  brakeCrouchStartThreshold: 0.95,
  brakeCrouchFullThreshold: 0.84,
  brakeSteerStartThreshold: 0.24,
  brakeSteerFullThreshold: 0.48,
  brakeArmSpreadStartRatio: 1.4,
  brakeArmSpreadFullRatio: 2.8,
  brakeArmDropStartThreshold: 0.18,
  brakeArmDropFullThreshold: 0.4,
  jumpVelocityThreshold: 7.5,
  jumpCooldownMs: 300,
  minConfidence: 0.6,
  minArmConfidence: 0.6,
  pumpEnterThreshold: 0.14,
  pumpExitThreshold: -0.1,
  pumpCooldownMs: 140,
  pumpWindowMs: 1500,
  pumpMaxHits: 2,
  pumpLockDurationMs: 10000,
  firstPumpDrive: 0.72
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ema(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * clamp(alpha, 0, 1);
}

export class MotionMapper {
  private readonly config: MotionMapperConfig;
  private previousKneeRatio: number | null = null;
  private lastJumpMs = -10000;
  private lastPumpMs = -10000;
  private steerSmoothed = 0;
  private tuckSmoothed = 0;
  private brakeSmoothed = 0;
  private driveSmoothed = 0;
  private baselineKneeRatio = 1;
  private pumpLoaded = false;
  private recentPumpHits: number[] = [];
  private boostLockedUntilMs = -1;

  constructor(config: Partial<MotionMapperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  mapSample(sample: PoseSample): MotionState {
    this.updateBaseline(sample);
    const lockActive = sample.timestampMs < this.boostLockedUntilMs;
    const initialBoostRemainingMs = lockActive ? Math.max(0, this.boostLockedUntilMs - sample.timestampMs) : 0;

    if (sample.confidence < this.config.minConfidence) {
      this.steerSmoothed = ema(this.steerSmoothed, 0, this.config.neutralDecayAlpha);
      this.tuckSmoothed = ema(this.tuckSmoothed, 0, this.config.neutralDecayAlpha);
      this.brakeSmoothed = ema(this.brakeSmoothed, 0, this.config.brakeDecayAlpha);
      this.recentPumpHits = lockActive ? this.recentPumpHits : this.prunePumpHits(sample.timestampMs);
      this.driveSmoothed = lockActive ? 1 : ema(this.driveSmoothed, 0, this.config.driveDecayAlpha);
      return {
        steer: this.steerSmoothed,
        tuck: this.tuckSmoothed,
        brake: this.brakeSmoothed,
        jumpTriggered: false,
        pumpTriggered: false,
        drive: this.driveSmoothed,
        pumpActive: lockActive,
        pumpHits: lockActive ? this.config.pumpMaxHits : this.recentPumpHits.length,
        boostLocked: lockActive,
        boostRemainingMs: initialBoostRemainingMs,
        confidence: lockActive ? Math.max(sample.confidence, this.config.minConfidence) : sample.confidence,
        source: "pose",
        tracking: lockActive
      };
    }

    const lean = sample.shoulderCenterX - sample.hipCenterX;
    const steerRaw = clamp(lean * this.config.steerGain, -1, 1);
    this.steerSmoothed = ema(this.steerSmoothed, steerRaw, this.config.steerAlpha);

    const legTracking = sample.legConfidence >= this.config.minConfidence;
    let normalizedKnee = 1;
    if (legTracking) {
      normalizedKnee = clamp(sample.kneeRatio / Math.max(this.baselineKneeRatio, 1e-5), 0.5, 1.08);
      const tuckStartThreshold = 0.92;
      const tuckFullThreshold = 0.79;
      const tuckRaw = clamp(
        (tuckStartThreshold - normalizedKnee) / Math.max(tuckStartThreshold - tuckFullThreshold, 1e-5),
        0,
        1
      );
      this.tuckSmoothed = ema(this.tuckSmoothed, tuckRaw, this.config.tuckAlpha);
    } else {
      this.tuckSmoothed = ema(this.tuckSmoothed, 0, this.config.neutralDecayAlpha);
      this.previousKneeRatio = null;
    }

    const brakeRaw = this.evaluateBrakeRaw(sample, normalizedKnee, legTracking);
    this.brakeSmoothed = ema(
      this.brakeSmoothed,
      brakeRaw,
      brakeRaw > this.brakeSmoothed ? this.config.brakeAlpha : this.config.brakeDecayAlpha
    );

    const { pumpHits, pumpTriggered } = this.updatePumpHits(sample);
    const boostLockActive = sample.timestampMs < this.boostLockedUntilMs;
    const boostRemainingMs = boostLockActive ? Math.max(0, this.boostLockedUntilMs - sample.timestampMs) : 0;
    const driveTarget = boostLockActive
      ? 1
      : pumpHits >= this.config.pumpMaxHits
        ? 1
        : pumpHits === 1
          ? this.config.firstPumpDrive
          : 0;
    if (boostLockActive) {
      this.driveSmoothed = 1;
    } else {
      this.driveSmoothed = ema(
        this.driveSmoothed,
        driveTarget,
        driveTarget > this.driveSmoothed ? this.config.driveAlpha : this.config.driveDecayAlpha
      );
    }

    let jump = false;
    if (legTracking && this.previousKneeRatio !== null) {
      const previousNormalized = clamp(this.previousKneeRatio / Math.max(this.baselineKneeRatio, 1e-5), 0.4, 1.1);
      const riseVelocity = (normalizedKnee - previousNormalized) / Math.max(sample.dt, 1e-5);
      const cooldownOk = sample.timestampMs - this.lastJumpMs >= this.config.jumpCooldownMs;
      const wasCrouched = previousNormalized < this.config.crouchThreshold;
      const nowStanding = normalizedKnee > this.config.standThreshold;
      jump = cooldownOk && wasCrouched && nowStanding && riseVelocity > this.config.jumpVelocityThreshold;
    }

    if (jump) {
      this.lastJumpMs = sample.timestampMs;
    }

    this.previousKneeRatio = legTracking ? sample.kneeRatio : null;

    return {
      steer: this.steerSmoothed,
      tuck: this.tuckSmoothed,
      brake: this.brakeSmoothed,
      jumpTriggered: jump,
      pumpTriggered,
      drive: this.driveSmoothed,
      pumpActive: boostLockActive || pumpHits > 0,
      pumpHits,
      boostLocked: boostLockActive,
      boostRemainingMs,
      confidence: sample.confidence,
      source: "pose",
      tracking: true
    };
  }

  private updatePumpHits(sample: PoseSample): { pumpHits: number; pumpTriggered: boolean } {
    if (sample.timestampMs >= this.boostLockedUntilMs && this.boostLockedUntilMs > 0) {
      this.recentPumpHits = [];
      this.boostLockedUntilMs = -1;
      this.pumpLoaded = false;
    }

    const boostLockActive = sample.timestampMs < this.boostLockedUntilMs;
    this.recentPumpHits = this.prunePumpHits(sample.timestampMs);
    if (sample.armConfidence < this.config.minArmConfidence) {
      this.pumpLoaded = false;
      return {
        pumpHits: boostLockActive ? this.config.pumpMaxHits : this.recentPumpHits.length,
        pumpTriggered: false
      };
    }

    const leftSignal = this.armSwingSignal(sample.leftShoulder, sample.leftElbow, sample.leftWrist);
    const rightSignal = this.armSwingSignal(sample.rightShoulder, sample.rightElbow, sample.rightWrist);
    const combinedSignal = (leftSignal + rightSignal) * 0.5;
    const wasLoaded = this.pumpLoaded;

    if (combinedSignal >= this.config.pumpEnterThreshold) {
      this.pumpLoaded = true;
    }

    if (
      wasLoaded
      && combinedSignal <= this.config.pumpExitThreshold
      && sample.timestampMs - this.lastPumpMs >= this.config.pumpCooldownMs
    ) {
      this.lastPumpMs = sample.timestampMs;
      this.pumpLoaded = false;
      if (boostLockActive) {
        return { pumpHits: this.config.pumpMaxHits, pumpTriggered: true };
      }
      this.recentPumpHits.push(sample.timestampMs);
      if (this.recentPumpHits.length >= this.config.pumpMaxHits) {
        this.boostLockedUntilMs = sample.timestampMs + this.config.pumpLockDurationMs;
        this.driveSmoothed = 1;
        return { pumpHits: this.config.pumpMaxHits, pumpTriggered: true };
      }
      this.driveSmoothed = Math.max(this.driveSmoothed, this.config.firstPumpDrive);
      return { pumpHits: this.recentPumpHits.length, pumpTriggered: true };
    } else if (combinedSignal <= this.config.pumpExitThreshold) {
      this.pumpLoaded = false;
    }

    this.recentPumpHits = this.prunePumpHits(sample.timestampMs);
    return { pumpHits: this.recentPumpHits.length, pumpTriggered: false };
  }

  private armSwingSignal(
    shoulder: PoseSample["leftShoulder"],
    elbow: PoseSample["leftElbow"],
    wrist: PoseSample["leftWrist"]
  ): number {
    if (!shoulder.visible || !elbow.visible || !wrist.visible) {
      return 0;
    }

    const forwardReach = shoulder.z - wrist.z;
    const elbowReach = shoulder.z - elbow.z;
    const wristDrop = wrist.y - shoulder.y;
    return clamp(forwardReach * 4.6 + elbowReach * 2.2 - wristDrop * 1.8, -1.2, 1.2);
  }

  private prunePumpHits(nowMs: number): number[] {
    return this.recentPumpHits.filter((timestamp) => nowMs - timestamp <= this.config.pumpWindowMs);
  }

  private updateBaseline(sample: PoseSample): void {
    if (sample.confidence < this.config.minConfidence || sample.legConfidence < this.config.minConfidence) {
      return;
    }

    if (this.baselineKneeRatio <= 0) {
      this.baselineKneeRatio = sample.kneeRatio;
      return;
    }

    const decayed = this.baselineKneeRatio * 0.999;
    this.baselineKneeRatio = Math.max(decayed, sample.kneeRatio);
  }

  private evaluateBrakeRaw(sample: PoseSample, normalizedKnee: number, legTracking: boolean): number {
    if (sample.armConfidence < this.config.minArmConfidence) {
      return 0;
    }

    const shoulderWidth = Math.max(Math.abs(sample.rightShoulder.x - sample.leftShoulder.x), 1e-4);
    const wristWidth = Math.abs(sample.rightWrist.x - sample.leftWrist.x);
    const spreadRatio = wristWidth / shoulderWidth;
    const averageShoulderY = (sample.leftShoulder.y + sample.rightShoulder.y) * 0.5;
    const averageWristY = (sample.leftWrist.y + sample.rightWrist.y) * 0.5;
    const armDrop = averageWristY - averageShoulderY;
    const steerMagnitude = Math.abs(this.steerSmoothed);

    const crouchFactor = legTracking
      ? this.inverseLerp(this.config.brakeCrouchStartThreshold, this.config.brakeCrouchFullThreshold, normalizedKnee)
      : 0;
    const spreadFactor = this.inverseLerp(
      this.config.brakeArmSpreadStartRatio,
      this.config.brakeArmSpreadFullRatio,
      spreadRatio
    );
    const armDropFactor = this.inverseLerp(
      this.config.brakeArmDropStartThreshold,
      this.config.brakeArmDropFullThreshold,
      armDrop
    );
    const armBrake = Math.min(spreadFactor, armDropFactor);
    const steerFactor = this.inverseLerp(
      this.config.brakeSteerStartThreshold,
      this.config.brakeSteerFullThreshold,
      steerMagnitude
    );

    let brake = armBrake * 0.44 + crouchFactor * 0.22 + steerFactor * 0.38;
    if (armBrake < 0.24 || steerFactor < 0.18 || crouchFactor < 0.06) {
      brake *= 0.35;
    }

    return clamp(brake, 0, 1);
  }

  private inverseLerp(start: number, end: number, value: number): number {
    if (start === end) {
      return value >= end ? 1 : 0;
    }

    if (start < end) {
      return clamp((value - start) / (end - start), 0, 1);
    }

    return clamp((start - value) / (start - end), 0, 1);
  }
}
