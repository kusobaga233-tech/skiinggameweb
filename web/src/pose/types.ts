export interface MotionState {
  steer: number;
  tuck: number;
  brake: number;
  jumpTriggered: boolean;
  pumpTriggered: boolean;
  drive: number;
  pumpActive: boolean;
  pumpHits: number;
  boostLocked: boolean;
  boostRemainingMs: number;
  confidence: number;
  source: "pose" | "keyboard" | "none";
  tracking: boolean;
}

export interface PoseJointSample {
  x: number;
  y: number;
  z: number;
  visible: boolean;
}

export interface PoseSample {
  timestampMs: number;
  dt: number;
  hipCenterX: number;
  shoulderCenterX: number;
  kneeRatio: number;
  confidence: number;
  legConfidence: number;
  armConfidence: number;
  leftShoulder: PoseJointSample;
  rightShoulder: PoseJointSample;
  leftElbow: PoseJointSample;
  rightElbow: PoseJointSample;
  leftWrist: PoseJointSample;
  rightWrist: PoseJointSample;
}

export interface PoseRuntimeStatus {
  ready: boolean;
  message: string;
  fps: number;
  inferenceMs: number;
  confidence: number;
}

export interface PoseOverlayFrame {
  landmarks: Array<{ x: number; y: number; visible: boolean }>;
}

export interface HudState {
  score: number;
  clearedGates: number;
  missedGates: number;
  totalGates: number;
  rampHits: number;
  airBonuses: number;
  elapsedTime: number;
  started: boolean;
  completed: boolean;
  paused: boolean;
  speed: number;
  cameraLabel: string;
  poseMessage: string;
  poseFps: number;
  inferenceMs: number;
  playerX: number;
  playerZ: number;
  motion: MotionState;
}
