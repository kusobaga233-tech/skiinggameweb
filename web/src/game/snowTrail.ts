export interface SnowTrailInput {
  movementEnabled: boolean;
  grounded: boolean;
  speed: number;
  maxForwardSpeed: number;
  steer: number;
  lateralVelocity: number;
}

export interface SnowTrailState {
  active: boolean;
  emissionRate: number;
  minSize: number;
  maxSize: number;
  minLifeTime: number;
  maxLifeTime: number;
  minEmitPower: number;
  maxEmitPower: number;
  driftX: number;
  liftY: number;
}

const IDLE_SNOW_TRAIL_STATE: SnowTrailState = {
  active: false,
  emissionRate: 0,
  minSize: 0.04,
  maxSize: 0.08,
  minLifeTime: 0.06,
  maxLifeTime: 0.11,
  minEmitPower: 0.06,
  maxEmitPower: 0.1,
  driftX: 0,
  liftY: 0.07
};

export function createInactiveSnowTrailState(): SnowTrailState {
  return { ...IDLE_SNOW_TRAIL_STATE };
}

export function evaluateSnowTrailState(input: SnowTrailInput): SnowTrailState {
  if (!input.movementEnabled || !input.grounded) {
    return createInactiveSnowTrailState();
  }

  const speedRatio = clamp((input.speed - 8) / Math.max(16, input.maxForwardSpeed - 8), 0, 1);
  const steerRatio = clamp(Math.abs(input.steer), 0, 1);
  const lateralRatio = clamp(Math.abs(input.lateralVelocity) / 10, 0, 1);
  const carveRatio = clamp(Math.max(steerRatio * 0.75, lateralRatio), 0, 1);
  const intensity = clamp(speedRatio * 0.7 + carveRatio * 0.85, 0, 1);

  if (input.speed < 8 || intensity < 0.08) {
    return createInactiveSnowTrailState();
  }

  const emissionRate = Math.round(12 + intensity * 28 + carveRatio * 12);
  const minEmitPower = 0.06 + speedRatio * 0.08 + carveRatio * 0.04;
  const maxEmitPower = minEmitPower + 0.05 + intensity * 0.08;

  return {
    active: true,
    emissionRate,
    minSize: 0.04 + intensity * 0.015,
    maxSize: 0.08 + intensity * 0.025 + carveRatio * 0.01,
    minLifeTime: 0.06 + intensity * 0.02,
    maxLifeTime: 0.11 + intensity * 0.035,
    minEmitPower,
    maxEmitPower,
    driftX: clamp(-input.steer * 0.18 - (input.lateralVelocity / 12) * 0.36, -0.42, 0.42),
    liftY: 0.07 + intensity * 0.06 + carveRatio * 0.03
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
