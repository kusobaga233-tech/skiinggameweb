import type { TurnMarkerData } from "./trackCourse";

export interface TurnPreviewAssist {
  active: boolean;
  blend: number;
  directionBias: number;
  lookAheadDistance: number;
  alphaBias: number;
  radiusBoost: number;
  betaOffset: number;
  targetLeadX: number;
  targetLeadZ: number;
  targetLiftY: number;
}

const PREVIEW_IDLE: TurnPreviewAssist = {
  active: false,
  blend: 0,
  directionBias: 0,
  lookAheadDistance: 0,
  alphaBias: 0,
  radiusBoost: 0,
  betaOffset: 0,
  targetLeadX: 0,
  targetLeadZ: 0,
  targetLiftY: 0
};

export function evaluateTurnPreviewAssist(z: number, turnMarkers: TurnMarkerData[]): TurnPreviewAssist {
  const activeTurn = turnMarkers.find((turn) => turn.kind === "sweep" && z >= turn.start - 170 && z <= turn.end + 85);
  if (!activeTurn) {
    return PREVIEW_IDLE;
  }

  const directionSign = activeTurn.direction === "left" ? -1 : 1;
  const previewStart = activeTurn.start - 170;
  const peakStart = activeTurn.start - 8;
  const peakEnd = activeTurn.end + 34;
  const previewEnd = activeTurn.end + 85;

  let blend = 0;
  if (z <= peakStart) {
    blend = smoothstep(normalize(z, previewStart, peakStart));
  } else if (z <= peakEnd) {
    blend = 1;
  } else {
    blend = 1 - smoothstep(normalize(z, peakEnd, previewEnd));
  }

  return {
    active: blend > 0.001,
    blend,
    directionBias: directionSign * blend,
    lookAheadDistance: 17 + blend * 33,
    alphaBias: directionSign * blend * 0.22,
    radiusBoost: blend * 2.8,
    betaOffset: -blend * 0.31,
    targetLeadX: directionSign * blend * 1.35,
    targetLeadZ: blend * 4.8,
    targetLiftY: blend * 1.25
  };
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) {
    return 1;
  }

  return clamp((value - min) / (max - min), 0, 1);
}

function smoothstep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
