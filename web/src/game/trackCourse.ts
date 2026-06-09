export interface GateData {
  index: number;
  centerX: number;
  z: number;
  halfWidth: number;
  state: "pending" | "cleared" | "missed";
}

export interface RampData {
  index: number;
  kind: "small" | "large";
  centerX: number;
  centerZ: number;
  halfWidth: number;
  length: number;
  surfaceRise: number;
  launchBoost: number;
  consumed: boolean;
}

export interface CourseSample {
  z: number;
  centerX: number;
  elevationY: number;
}

export interface TrackCourse {
  trackId: TrackCourseId;
  courseHalfWidth: number;
  gates: GateData[];
  ramps: RampData[];
  samples: CourseSample[];
  turnMarkers: TurnMarkerData[];
  length: number;
}

export type TrackCourseId = "track1" | "track2";

interface BendSegment {
  start: number;
  end: number;
  amplitude: number;
}

interface SweepTurnSegment {
  start: number;
  end: number;
  shift: number;
}

export interface TurnMarkerData {
  index: number;
  label: string;
  start: number;
  end: number;
  apexZ: number;
  centerX: number;
  direction: "left" | "right";
  kind: "pulse" | "sweep";
}

export interface TurnEntryHintData {
  direction: "left" | "right";
  arrowText: string;
  strength: 1 | 2 | 3;
  entryZ: number;
  targetZ: number;
  entryX: number;
  targetX: number;
  deltaX: number;
}

const COURSE_HALF_WIDTH = 12.0;
const COURSE_LENGTH = 2600;
const SAMPLE_STEP = 10;
export const COURSE_Y_OFFSET = 100;
const SPIRAL_CREST_Z = 760;
const SPIRAL_PHASE_OFFSET = -0.55;
const SPIRAL_PHASE_SCALE = (Math.PI * 2) / 360;
const SPIRAL_RADIUS_MIN = 5.5;
const SPIRAL_RADIUS_MAX = 15.5;
const SPIRAL_TURN_LENGTH = 260;
const COURSE_BENDS: BendSegment[] = [];
const COURSE_SWEEP_TURNS: SweepTurnSegment[] = [];
const GATE_SPACING = 140;
const FIRST_GATE_Z = 110;
const GATE_COUNT = 18;
let activeTrackId: TrackCourseId = "track1";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function turnPulse(z: number, start: number, end: number, amplitude: number): number {
  if (z <= start || z >= end) {
    return 0;
  }

  const t = (z - start) / Math.max(1e-5, end - start);
  const eased = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
  return amplitude * eased;
}

function turnSweep(z: number, start: number, end: number, shift: number): number {
  if (z <= start) {
    return 0;
  }

  if (z >= end) {
    return shift;
  }

  const t = (z - start) / Math.max(1e-5, end - start);
  const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);
  return shift * eased;
}

export function evaluateCourseCenterX(z: number): number {
  const clampedZ = clamp(z, 0, COURSE_LENGTH);
  if (activeTrackId === "track2") {
    return 0;
  }

  const climbBuild = smoothstep(clampedZ / 420);
  const lateTaper = 1 - 0.18 * smoothstep((clampedZ - 1900) / 520);
  const radius = (SPIRAL_RADIUS_MIN + (SPIRAL_RADIUS_MAX - SPIRAL_RADIUS_MIN) * climbBuild) * lateTaper;
  const phase = clampedZ * SPIRAL_PHASE_SCALE + SPIRAL_PHASE_OFFSET;
  const secondaryCurl = Math.sin(phase * 0.5 + 1.2) * 1.15;
  return Math.sin(phase) * radius + secondaryCurl;
}

export function evaluateCourseElevation(z: number): number {
  const clampedZ = clamp(z, 0, COURSE_LENGTH);
  const downhill = clampedZ * 0.19;
  const entryDrop = -10 * smoothstep(clampedZ / 220);
  if (activeTrackId === "track2") {
    const terrainRoll = Math.sin(clampedZ * 0.012 - 0.2) * 1.1;
    return -downhill + entryDrop + terrainRoll + COURSE_Y_OFFSET;
  }

  const spiralBankWave = Math.sin(clampedZ * SPIRAL_PHASE_SCALE + 0.8) * 2.4;
  const terrainRoll = Math.sin(clampedZ * 0.012 - 0.2) * 1.5;
  const rawElevation = -downhill + entryDrop + spiralBankWave + terrainRoll;
  return rawElevation + COURSE_Y_OFFSET;
}

export function evaluateCourseTangent(z: number): { x: number; y: number; z: number } {
  const sampleAhead = z + 1;
  const sampleBehind = z - 1;
  const dx = evaluateCourseCenterX(sampleAhead) - evaluateCourseCenterX(sampleBehind);
  const dy = evaluateCourseElevation(sampleAhead) - evaluateCourseElevation(sampleBehind);
  const dz = 2;
  const length = Math.hypot(dx, dy, dz) || 1;
  return {
    x: dx / length,
    y: dy / length,
    z: dz / length
  };
}

export function evaluateCourseSlopeFactor(z: number): number {
  return evaluateCourseTangent(z).y;
}

export function sampleCoursePoint(z: number): CourseSample {
  return {
    z,
    centerX: evaluateCourseCenterX(z),
    elevationY: evaluateCourseElevation(z)
  };
}

export function sampleGroundHeight(course: TrackCourse, x: number, z: number): number {
  const baseHeight = evaluateCourseElevation(z);
  let surfaceHeight = baseHeight;

  for (const ramp of course.ramps) {
    const rampHeight = sampleRampSurfaceHeight(ramp, x, z);
    if (rampHeight !== null) {
      surfaceHeight = Math.max(surfaceHeight, rampHeight);
    }
  }

  return surfaceHeight;
}

export function resolveRampSideCollision(course: TrackCourse, x: number, z: number, radius: number): number {
  let resolvedX = x;

  for (const ramp of course.ramps) {
    const nearZ = z >= ramp.centerZ - ramp.length * 0.62 && z <= ramp.centerZ + ramp.length * 0.62;
    if (!nearZ) {
      continue;
    }

    const deltaX = resolvedX - ramp.centerX;
    const distance = Math.abs(deltaX);
    const minDistance = ramp.halfWidth + radius;
    if (distance <= ramp.halfWidth || distance >= minDistance) {
      continue;
    }

    resolvedX = ramp.centerX + Math.sign(deltaX || 1) * minDistance;
  }

  return resolvedX;
}

function sampleRampSurfaceHeight(ramp: RampData, x: number, z: number): number | null {
  const localX = x - ramp.centerX;
  const localZ = z - ramp.centerZ;
  if (Math.abs(localX) > ramp.halfWidth || Math.abs(localZ) > ramp.length * 0.5) {
    return null;
  }

  const progress = (localZ + ramp.length * 0.5) / Math.max(1e-5, ramp.length);
  const baseHeight = evaluateCourseElevation(z);
  return baseHeight + progress * ramp.surfaceRise;
}

export function createTrackCourse(trackId: TrackCourseId = "track1"): TrackCourse {
  activeTrackId = trackId;
  const samples: CourseSample[] = [];
  for (let z = 0; z <= COURSE_LENGTH; z += SAMPLE_STEP) {
    samples.push({
      z,
      centerX: evaluateCourseCenterX(z),
      elevationY: evaluateCourseElevation(z)
    });
  }

  const turnMarkers = trackId === "track1" ? createTurnMarkers() : [];
  const gates = trackId === "track1"
    ? createTrack1Gates(turnMarkers)
    : createTrack2Gates();
  const ramps = trackId === "track1"
    ? createTrack1Ramps()
    : [];

  return {
    trackId,
    courseHalfWidth: COURSE_HALF_WIDTH,
    gates,
    ramps,
    samples,
    turnMarkers,
    length: COURSE_LENGTH
  };
}

export function evaluateTurnEntryHint(
  turn: TurnMarkerData,
  courseHalfWidth: number = COURSE_HALF_WIDTH
): TurnEntryHintData {
  const entryZ = turn.start - 58;
  const targetZ = turn.start + (turn.end - turn.start) * 0.28;
  const entryX = evaluateTurnGuideX(turn, entryZ, courseHalfWidth);
  const targetX = evaluateTurnGuideX(turn, targetZ, courseHalfWidth);
  const deltaX = targetX - entryX;
  const direction = deltaX < 0 ? "left" : "right";
  const magnitude = Math.abs(deltaX);
  const strength: 1 | 2 | 3 = magnitude >= 14 ? 3 : magnitude >= 6 ? 2 : 1;
  const arrowText = direction === "left" ? "《".repeat(strength) : "》".repeat(strength);

  return {
    direction,
    arrowText,
    strength,
    entryZ,
    targetZ,
    entryX,
    targetX,
    deltaX
  };
}

function createTrack1Gates(turnMarkers: TurnMarkerData[]): GateData[] {
  const gates: GateData[] = [];
  for (let index = 0; index < GATE_COUNT; index += 1) {
    const z = FIRST_GATE_Z + index * GATE_SPACING;
    const courseCenter = evaluateCourseCenterX(z);
    const guidingOffset = evaluateGateGuideOffset(z, turnMarkers, COURSE_HALF_WIDTH - 2.5);
    const cadenceOffset = (index % 2 === 0 ? -1 : 1) * (0.72 + (index % 3) * 0.18);
    const laneOffset = Math.abs(guidingOffset) > 0.01 ? guidingOffset : cadenceOffset;
    const centerX = clamp(
      courseCenter + laneOffset,
      courseCenter - COURSE_HALF_WIDTH + 1.9,
      courseCenter + COURSE_HALF_WIDTH - 1.9
    );
    gates.push({
      index: index + 1,
      centerX,
      z,
      halfWidth: 2.9,
      state: "pending"
    });
  }
  return gates;
}

function createTrack2Gates(): GateData[] {
  const gates: GateData[] = [];
  for (let index = 0; index < GATE_COUNT; index += 1) {
    const z = FIRST_GATE_Z + index * GATE_SPACING;
    const alternatingOffset = index % 2 === 0 ? -4.4 : 4.4;
    gates.push({
      index: index + 1,
      centerX: clamp(alternatingOffset, -COURSE_HALF_WIDTH + 1.9, COURSE_HALF_WIDTH - 1.9),
      z,
      halfWidth: 2.9,
      state: "pending"
    });
  }
  return gates;
}

function createTrack1Ramps(): RampData[] {
  const ramps: RampData[] = [];
  const smallRampHalfWidth = 1.15;
  const smallRampLength = 5.2;
  const smallRampSurfaceRise = 1.1;
  const rampZs = [250, 520, 690, 960, 1180, 1450, 1605, 1940];
  for (let index = 0; index < rampZs.length; index += 1) {
    const centerZ = rampZs[index];
    const courseCenter = evaluateCourseCenterX(centerZ);
    const offset = (index % 2 === 0 ? 1 : -1) * 1.8;
    ramps.push({
      index: index + 1,
      kind: "small",
      centerX: clamp(
        courseCenter + offset,
        courseCenter - COURSE_HALF_WIDTH + 1.6,
        courseCenter + COURSE_HALF_WIDTH - 1.6
      ),
      centerZ,
      halfWidth: smallRampHalfWidth,
      length: smallRampLength,
      surfaceRise: smallRampSurfaceRise,
      launchBoost: 1.6,
      consumed: false
    });
  }

  const trackWideRampHalfWidth = COURSE_HALF_WIDTH;
  const trackWideRampLength = smallRampLength * 1.95;
  const trackWideRampSurfaceRise = smallRampSurfaceRise * 1.85;
  const trackWideRampZs = [900, 1710];
  for (const centerZ of trackWideRampZs) {
    ramps.push({
      index: ramps.length + 1,
      kind: "large",
      centerX: evaluateCourseCenterX(centerZ),
      centerZ,
      halfWidth: trackWideRampHalfWidth,
      length: trackWideRampLength,
      surfaceRise: trackWideRampSurfaceRise,
      launchBoost: 2.35,
      consumed: false
    });
  }

  const largeRampZ = 2060;
  const largeRampHalfWidth = smallRampHalfWidth * 3;
  const largeRampCourseCenter = evaluateCourseCenterX(largeRampZ);
  ramps.push({
    index: ramps.length + 1,
    kind: "large",
    centerX: clamp(
      largeRampCourseCenter,
      largeRampCourseCenter - COURSE_HALF_WIDTH + largeRampHalfWidth + 1.2,
      largeRampCourseCenter + COURSE_HALF_WIDTH - largeRampHalfWidth - 1.2
    ),
    centerZ: largeRampZ,
    halfWidth: largeRampHalfWidth,
    length: smallRampLength * 1.65,
    surfaceRise: smallRampSurfaceRise * 1.6,
    launchBoost: 2.2,
    consumed: false
  });

  return ramps;
}

function createTurnMarkers(): TurnMarkerData[] {
  const markers: Array<Omit<TurnMarkerData, "index" | "label" | "centerX">> = [];
  for (let start = 140; start < COURSE_LENGTH - 130; start += SPIRAL_TURN_LENGTH) {
    const end = Math.min(start + SPIRAL_TURN_LENGTH, COURSE_LENGTH - 40);
    const apexZ = start + (end - start) * 0.5;
    const beforeX = evaluateCourseCenterX(Math.max(0, apexZ - 24));
    const afterX = evaluateCourseCenterX(Math.min(COURSE_LENGTH, apexZ + 24));
    markers.push({
      start,
      end,
      apexZ,
      direction: afterX < beforeX ? "left" : "right",
      kind: "sweep"
    });
  }

  return markers.map((marker, index) => {
    const label = `T${index + 1}-${marker.direction === "left" ? "L" : "R"}`;
    return {
      index: index + 1,
      label,
      start: marker.start,
      end: marker.end,
      apexZ: marker.apexZ,
      centerX: evaluateCourseCenterX(marker.apexZ),
      direction: marker.direction,
      kind: marker.kind
    };
  });
}

function evaluateGateGuideOffset(z: number, turnMarkers: TurnMarkerData[], guideHalfWidth: number): number {
  const activeTurn = turnMarkers.find((turn) => turn.kind === "sweep" && z >= turn.start - 90 && z <= turn.end + 90);
  if (!activeTurn) {
    return 0;
  }

  const outsideSign = activeTurn.direction === "left" ? 1 : -1;
  const insideSign = -outsideSign;
  const entryHoldStart = activeTurn.start - 90;
  const entryHoldEnd = activeTurn.start - 26;
  const apexBlendEnd = activeTurn.start + (activeTurn.end - activeTurn.start) * 0.28;
  const exitBlendEnd = activeTurn.end + 44;
  const entryOffset = outsideSign * guideHalfWidth * 0.68;
  const apexOffset = insideSign * guideHalfWidth * 0.6;
  const exitOffset = outsideSign * guideHalfWidth * 0.52;

  if (z <= entryHoldEnd) {
    return entryOffset;
  }

  if (z <= apexBlendEnd) {
    const t = clamp((z - entryHoldEnd) / Math.max(1e-5, apexBlendEnd - entryHoldEnd), 0, 1);
    return lerp(entryOffset, apexOffset, smoothstep(t));
  }

  const t = clamp((z - apexBlendEnd) / Math.max(1e-5, exitBlendEnd - apexBlendEnd), 0, 1);
  return lerp(apexOffset, exitOffset, smoothstep(t));
}

function evaluateTurnGuideX(turn: TurnMarkerData, z: number, courseHalfWidth: number): number {
  const centerX = evaluateCourseCenterX(z);
  const guideOffset = evaluateGateGuideOffset(z, [turn], courseHalfWidth - 2.5);
  return clamp(
    centerX + guideOffset,
    centerX - courseHalfWidth + 1.9,
    centerX + courseHalfWidth - 1.9
  );
}

function smoothstep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
