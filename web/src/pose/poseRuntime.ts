import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark
} from "@mediapipe/tasks-vision";
import { MotionMapper, type MotionMapperConfig } from "./motionMapper";
import type { MotionState, PoseJointSample, PoseOverlayFrame, PoseRuntimeStatus, PoseSample } from "./types";

export interface PoseRuntimeConfig {
  motionMapper?: Partial<MotionMapperConfig>;
}

export class PoseRuntime {
  private poseLandmarker: PoseLandmarker | null = null;
  private animationFrameId = 0;
  private readonly mapper: MotionMapper;
  private readonly status: PoseRuntimeStatus = {
    ready: false,
    message: "Pose runtime idle",
    fps: 0,
    inferenceMs: 0,
    confidence: 0
  };
  private lastFrameTime = performance.now();

  constructor(config: PoseRuntimeConfig = {}) {
    this.mapper = new MotionMapper(config.motionMapper);
  }

  async initialize(): Promise<void> {
    if (this.poseLandmarker) {
      return;
    }

    this.status.message = "Loading pose model...";
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/pose_landmarker_full.task"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    this.status.ready = true;
    this.status.message = "Pose model ready";
  }

  start(
    video: HTMLVideoElement,
    onMotion: (state: MotionState) => void,
    onStatus: (status: PoseRuntimeStatus) => void,
    onOverlay: (frame: PoseOverlayFrame) => void
  ): void {
    const tick = () => {
      this.animationFrameId = requestAnimationFrame(tick);

      if (!this.poseLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      const now = performance.now();
      const dt = Math.max((now - this.lastFrameTime) / 1000, 1 / 120);
      this.lastFrameTime = now;

      const startedAt = performance.now();
      const result = this.poseLandmarker.detectForVideo(video, now);
      const inferenceMs = performance.now() - startedAt;

      this.status.inferenceMs = inferenceMs;
      this.status.fps = 1 / dt;

      const sample = this.createSample(result.landmarks?.[0] ?? null, dt, now);
      const motion = this.mapper.mapSample(sample);
      this.status.confidence = motion.confidence;
      this.status.message = motion.tracking ? "Pose tracking" : "Tracking lost";
      onMotion(motion);
      onStatus({ ...this.status });
      onOverlay(this.createOverlayFrame(result.landmarks?.[0] ?? null));
    };

    this.stop();
    this.lastFrameTime = performance.now();
    tick();
  }

  stop(): void {
    if (this.animationFrameId !== 0) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  getStatus(): PoseRuntimeStatus {
    return { ...this.status };
  }

  private createOverlayFrame(landmarks: NormalizedLandmark[] | null): PoseOverlayFrame {
    if (!landmarks || landmarks.length === 0) {
      return { landmarks: [] };
    }

    return {
      landmarks: landmarks.map((landmark) => ({
        x: landmark.x,
        y: landmark.y,
        visible: landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1
      }))
    };
  }

  private createSample(landmarks: NormalizedLandmark[] | null, dt: number, nowMs: number): PoseSample {
    if (!landmarks || landmarks.length === 0) {
      return {
        timestampMs: Math.round(nowMs),
        dt,
        hipCenterX: 0.5,
        hipCenterY: 0.62,
        shoulderCenterX: 0.5,
        shoulderCenterY: 0.38,
        kneeRatio: 1,
        confidence: 0,
        legConfidence: 0,
        armConfidence: 0,
        leftShoulder: this.emptyJoint(),
        rightShoulder: this.emptyJoint(),
        leftElbow: this.emptyJoint(),
        rightElbow: this.emptyJoint(),
        leftWrist: this.emptyJoint(),
        rightWrist: this.emptyJoint()
      };
    }

    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    const hipCenterX = (leftHip.x + rightHip.x) * 0.5;
    const hipCenterY = (leftHip.y + rightHip.y) * 0.5;
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) * 0.5;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) * 0.5;
    const kneeRatio = (this.legLength(landmarks, 23, 25, 27) + this.legLength(landmarks, 24, 26, 28)) * 0.5;
    const confidence = this.landmarksInFrame(landmarks, [11, 12, 23, 24]) ? 1 : 0;
    const legConfidence = this.landmarksInFrame(landmarks, [23, 24, 25, 26, 27, 28]) ? 1 : 0;
    const armConfidence = this.landmarksInFrame(landmarks, [11, 12, 13, 14, 15, 16]) ? 1 : 0;

    return {
      timestampMs: Math.round(nowMs),
      dt,
      hipCenterX,
      hipCenterY,
      shoulderCenterX,
      shoulderCenterY,
      kneeRatio,
      confidence,
      legConfidence,
      armConfidence,
      leftShoulder: this.toJoint(leftShoulder),
      rightShoulder: this.toJoint(rightShoulder),
      leftElbow: this.toJoint(leftElbow),
      rightElbow: this.toJoint(rightElbow),
      leftWrist: this.toJoint(leftWrist),
      rightWrist: this.toJoint(rightWrist)
    };
  }

  private emptyJoint(): PoseJointSample {
    return { x: 0, y: 0, z: 0, visible: false };
  }

  private toJoint(landmark: NormalizedLandmark): PoseJointSample {
    const visible = landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1;
    return {
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visible
    };
  }

  private legLength(landmarks: NormalizedLandmark[], hipIndex: number, kneeIndex: number, ankleIndex: number): number {
    const hip = landmarks[hipIndex];
    const knee = landmarks[kneeIndex];
    const ankle = landmarks[ankleIndex];
    const upper = Math.hypot(knee.x - hip.x, knee.y - hip.y);
    const lower = Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
    return Math.max(upper + lower, 1e-3);
  }

  private landmarksInFrame(landmarks: NormalizedLandmark[], indices: number[]): boolean {
    return indices.every((index) => {
      const landmark = landmarks[index];
      return landmark && landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1;
    });
  }
}
