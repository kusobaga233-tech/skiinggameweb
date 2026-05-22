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
  courseHalfWidth: number;
  gates: GateData[];
  ramps: RampData[];
  samples: CourseSample[];
  turnMarkers: TurnMarkerData[];
  length: number;
}

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

const COURSE_HALF_WIDTH = 12.0;
const COURSE_LENGTH = 2600;
const SAMPLE_STEP = 10;
const BEND_AMPLITUDE_SCALE = 1.16;
const COURSE_BENDS: BendSegment[] = [
  { start: 100, end: 380, amplitude: -5.4 * BEND_AMPLITUDE_SCALE },
  { start: 350, end: 690, amplitude: 6.1 * BEND_AMPLITUDE_SCALE },
  { start: 640, end: 860, amplitude: -4.4 * BEND_AMPLITUDE_SCALE },
  { start: 860, end: 1040, amplitude: 5.1 * BEND_AMPLITUDE_SCALE },
  { start: 1540, end: 1760, amplitude: -3.8 * BEND_AMPLITUDE_SCALE },
  { start: 1720, end: 1940, amplitude: 4.2 * BEND_AMPLITUDE_SCALE },
  { start: 1910, end: 2130, amplitude: 4.9 * BEND_AMPLITUDE_SCALE }
];
const COURSE_SWEEP_TURNS: SweepTurnSegment[] = [
  { start: 980, end: 1135, shift: -22 },
  { start: 1320, end: 1490, shift: 28 },
  { start: 2140, end: 2260, shift: -14 },
  { start: 2270, end: 2390, shift: 16 },
  { start: 2400, end: 2520, shift: -16 }
];

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
  const ambientDrift = Math.sin(z * 0.0032 + 0.4) * 0.65 + Math.sin(z * 0.0085 - 0.9) * 0.35;
  const bendOffset = COURSE_BENDS.reduce((sum, bend) => sum + turnPulse(z, bend.start, bend.end, bend.amplitude), 0);
  const sweepOffset = COURSE_SWEEP_TURNS.reduce((sum, bend) => sum + turnSweep(z, bend.start, bend.end, bend.shift), 0);
  return ambientDrift + bendOffset + sweepOffset;
}

export function evaluateCourseElevation(z: number): number {
  const baseDownhill = -0.205 * z;
  const startPitch = -10 * (1 - Math.exp(-z / 150));
  const rollingA = Math.sin(z * 0.009) * 3.2;
  const rollingB = Math.sin(z * 0.024 + 0.8) * 1.6;
  const plungeA = -26 * Math.exp(-Math.pow((z - 360) / 150, 2));
  const plungeB = -34 * Math.exp(-Math.pow((z - 980) / 170, 2));
  const plungeC = -32 * Math.exp(-Math.pow((z - 1540) / 150, 2));
  const plungeD = -24 * Math.exp(-Math.pow((z - 1880) / 120, 2));
  const reliefA = 4 * Math.exp(-Math.pow((z - 620) / 120, 2));
  const reliefB = 3 * Math.exp(-Math.pow((z - 1290) / 130, 2));
  return baseDownhill + startPitch + rollingA + rollingB + plungeA + plungeB + plungeC + plungeD + reliefA + reliefB;
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

export function createTrackCourse(): TrackCourse {
  const samples: CourseSample[] = [];
  for (let z = 0; z <= COURSE_LENGTH; z += SAMPLE_STEP) {
    samples.push({
      z,
      centerX: evaluateCourseCenterX(z),
      elevationY: evaluateCourseElevation(z)
    });
  }

  const turnMarkers = createTurnMarkers();

  const gates: GateData[] = [];
  const gateSpacing = 84;
  const firstGateZ = 110;
  for (let index = 0; index < 23; index += 1) {
    const z = firstGateZ + index * gateSpacing;
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
      halfWidth: 1.45,
      state: "pending"
    });
  }

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
  ramps.push({
    index: ramps.length + 1,
    kind: "large",
    centerX: clamp(
      evaluateCourseCenterX(largeRampZ),
      -COURSE_HALF_WIDTH + largeRampHalfWidth + 1.2,
      COURSE_HALF_WIDTH - largeRampHalfWidth - 1.2
    ),
    centerZ: largeRampZ,
    halfWidth: largeRampHalfWidth,
    length: smallRampLength * 1.65,
    surfaceRise: smallRampSurfaceRise * 1.6,
    launchBoost: 2.2,
    consumed: false
  });

  return {
    courseHalfWidth: COURSE_HALF_WIDTH,
    gates,
    ramps,
    samples,
    turnMarkers,
    length: COURSE_LENGTH
  };
}

function createTurnMarkers(): TurnMarkerData[] {
  const markers = [
    ...COURSE_BENDS.map((bend) => ({
      start: bend.start,
      end: bend.end,
      apexZ: (bend.start + bend.end) * 0.5,
      direction: bend.amplitude < 0 ? "left" as const : "right" as const,
      kind: "pulse" as const
    })),
    ...COURSE_SWEEP_TURNS.map((bend) => ({
      start: bend.start,
      end: bend.end,
      apexZ: bend.start + (bend.end - bend.start) * 0.72,
      direction: bend.shift < 0 ? "left" as const : "right" as const,
      kind: "sweep" as const
    }))
  ].sort((a, b) => a.start - b.start);

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

function smoothstep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
