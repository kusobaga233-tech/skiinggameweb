import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MotionState } from "../pose/types";
import { RunSession } from "./runSession";
import { evaluateSnowTrailState, type SnowTrailState } from "./snowTrail";
import { SKIER_BODY_ROOT_OFFSET_Y, type SkierAvatarRig } from "./sceneBuilder";
import type { TrackCourse } from "./trackCourse";
import { evaluateTurnPreviewAssist } from "./turnPreview";
import {
  evaluateCourseCenterX,
  evaluateCourseElevation,
  evaluateCourseSlopeFactor,
  evaluateCourseTangent,
  resolveRampSideCollision,
  sampleGroundHeight
} from "./trackCourse";

export interface SkierSnapshot {
  position: Vector3;
  currentSteer: number;
  currentTuck: number;
  currentForwardSpeed: number;
  edgeHold: number;
  driftSlip: number;
  snowTrail: SnowTrailState;
}

export interface SkierControllerConfig {
  poseSteerScale?: number;
  maxForwardSpeed?: number;
  downhillSpeedBoost?: number;
  accelerationResponse?: number;
  driveSpeedBoost?: number;
  driveDownhillSynergy?: number;
  maxTuckSpeedBonusRatio?: number;
  startSpeedLimit?: number;
  pumpImpulseBoost?: number;
  carveRadiusMin?: number;
  carveRadiusMax?: number;
  lowSpeedTurnScale?: number;
  carveRadiusInputBias?: number;
  carveRadiusInputFloor?: number;
  gameplayLineAssistStrength?: number;
  gameplayLinePlayerOffsetScale?: number;
  gameplayLineMaxOffset?: number;
  gameplayLineLookahead?: number;
  gameplayLineTurnReduce?: number;
  gameplayLineMaxYaw?: number;
  turnSnowplowSteerStart?: number;
  turnSnowplowSteerRelease?: number;
  turnSnowplowSteerFull?: number;
  turnSnowplowHoldDuration?: number;
  turnSnowplowReleaseDuration?: number;
  turnSnowplowMinSpeed?: number;
  turnSnowplowMaxBlend?: number;
  turnSnowplowSpeedReduction?: number;
  snowplowStopResponseMin?: number;
  snowplowStopResponseMax?: number;
}

export class SkierController {
  private readonly baseForwardSpeed = 10;
  private readonly steerSmooth = 6;
  private readonly tuckSmooth = 6;
  private readonly glidePoseSpeedStart = 4;
  private readonly glidePoseSpeedFull = 22;
  private readonly tuckResponseExponent = 0.78;
  private readonly gravity = -20;
  private readonly groundOffsetY = 0;
  private readonly boundaryPadding = 0.2;
  private readonly skierRadius = 0.46;
  private readonly wallCollisionSpeedRetention = 0.5;
  private readonly steerYawInfluence = 0.28;
  private readonly carveYawInfluence = 0.26;
  private readonly carveLeanInfluence = 0.24;
  private readonly carvePreviewLeanInfluence = 0.1;
  private readonly routePreviewNearDistance = 14;
  private readonly routePreviewFarDistance = 42;
  private readonly routePreviewBiasScale = 0.065;
  private readonly routePreviewYawInfluence = 0.42;
  private readonly routePreviewCameraLeadBlend = 0.12;
  private readonly routePreviewCameraLeadLimit = 2.6;
  private readonly downhillSpeedBoost: number;
  private readonly driveSpeedBoost: number;
  private readonly driveDownhillSynergy: number;
  private readonly maxTuckSpeedBonusRatio: number;
  private readonly uphillSpeedPenalty = 12;
  private readonly minForwardSpeed = 7.5;
  private readonly maxForwardSpeed: number;
  private readonly startSpeedLimit: number;
  private readonly startSpeedReleaseZ = 180;
  private readonly visualPitchInfluence = 1.15;
  private readonly accelerationResponse: number;
  private readonly flatGlideDecelerationResponse = 0.2;
  private readonly gentleUphillDecelerationResponse = 0.7;
  private readonly uphillDecelerationResponse = 1.8;
  private readonly baseCameraAlpha = -Math.PI / 2;
  private readonly routePreviewCameraAlphaInfluence = 0.04;
  private readonly cameraHeadingVelocityWeight = 0.7;
  private readonly cameraHeadingSteerWeight = 0.45;
  private readonly cameraHeadingRouteWeight = 0.18;
  private readonly cameraHeadingTurnVelocityWeight = 0.92;
  private readonly cameraHeadingTurnSteerWeight = 0.68;
  private readonly cameraHeadingTurnRouteWeight = 0.04;
  private readonly cameraHeadingLeadX = 3.4;
  private readonly cameraTargetFollowBase = 0.24;
  private readonly cameraTargetFollowBoost = 0.18;
  private readonly downhillTurnTargetLiftScale = 0.76;
  private readonly downhillTurnTargetLeadZScale = 0.72;
  private readonly downhillTurnRadiusBoost = 1.45;
  private readonly baseCameraFov = 0.8;
  private readonly maxTuckCameraFov = 0.9;
  private readonly cameraFovSmooth = 0.09;
  private readonly turnPreviewBetaOffsetSmooth = 0.042;
  private readonly pumpPoseDuration = 0.3;
  private readonly turnSnowplowSteerStart: number;
  private readonly turnSnowplowSteerRelease: number;
  private readonly turnSnowplowSteerFull: number;
  private readonly turnSnowplowHoldDuration: number;
  private readonly turnSnowplowReleaseDuration: number;
  private readonly turnSnowplowMinSpeed: number;
  private readonly turnSnowplowMaxBlend: number;
  private readonly turnSnowplowSpeedReduction: number;
  private readonly snowplowStopResponseMin: number;
  private readonly snowplowStopResponseMax: number;
  private readonly headingTurnRate = 1.52;
  private readonly lowSpeedTurnScale: number;
  private readonly highSpeedTurnScale = 0.48;
  private readonly headingSnowplowTurnBoost = 0.46;
  private readonly headingAirControlScale = 0.24;
  private readonly maxMovementHeadingYaw = Math.PI * 0.62;
  private readonly counterSteerTurnBoostMax = 2.1;
  private readonly counterSteerAlignBoostMax = 2.4;
  private readonly headingNeutralReturnRate = 1.55;
  private readonly carveGripMin = 62;
  private readonly carveGripMax = 240;
  private readonly carveRadiusMin: number;
  private readonly carveRadiusMax: number;
  private readonly carveRadiusInputBias: number;
  private readonly carveRadiusInputFloor: number;
  private readonly gameplayLineAssistStrength: number;
  private readonly gameplayLinePlayerOffsetScale: number;
  private readonly gameplayLineMaxOffset: number;
  private readonly gameplayLineLookahead: number;
  private readonly gameplayLineTurnReduce: number;
  private readonly gameplayLineMaxYaw: number;
  private readonly carveSpeedAlignmentMin = 1.8;
  private readonly carveSpeedAlignmentMax = 9.4;
  private readonly carveDriftDrag = 8.5;
  private readonly carveBaseDrag = 0.9;
  private readonly pumpImpulseBoost: number;
  private readonly poseSteerScale: number;
  private startBoostBonusRatio = 0;

  private currentSteer = 0;
  private currentTuck = 0;
  private verticalVelocity = 0;
  private airborne = false;
  private currentForwardSpeed = 0;
  private lastFrameDeltaX = 0;
  private lastLateralVelocity = 0;
  private currentTurnPreviewBetaOffset = 0;
  private pumpPoseTimer = 0;
  private turnSnowplowHoldSeconds = 0;
  private movementHeadingYaw = 0;
  private velocity = new Vector3(0, 0, 0);
  private driftSlip = 0;
  private edgeHold = 0;
  private lastSnowplowBrakeBlend = 0;
  private wallCollisionLatched = false;

  constructor(
    private readonly skier: Mesh,
    private readonly skierAvatarRig: SkierAvatarRig,
    private readonly camera: ArcRotateCamera,
    private readonly course: TrackCourse,
    private readonly runSession: RunSession,
    config: SkierControllerConfig = {}
  ) {
    this.poseSteerScale = config.poseSteerScale ?? 1.25;
    this.maxForwardSpeed = config.maxForwardSpeed ?? 120;
    this.downhillSpeedBoost = config.downhillSpeedBoost ?? 230;
    this.accelerationResponse = config.accelerationResponse ?? 6.2;
    this.driveSpeedBoost = config.driveSpeedBoost ?? 22;
    this.driveDownhillSynergy = config.driveDownhillSynergy ?? 0.8;
    this.maxTuckSpeedBonusRatio = config.maxTuckSpeedBonusRatio ?? 0.1;
    this.startSpeedLimit = config.startSpeedLimit ?? 24;
    this.pumpImpulseBoost = config.pumpImpulseBoost ?? 7.8;
    this.carveRadiusMin = config.carveRadiusMin ?? 14;
    this.carveRadiusMax = config.carveRadiusMax ?? 118;
    this.lowSpeedTurnScale = config.lowSpeedTurnScale ?? 0.55;
    this.carveRadiusInputBias = config.carveRadiusInputBias ?? 0.08;
    this.carveRadiusInputFloor = config.carveRadiusInputFloor ?? 0.1;
    this.gameplayLineAssistStrength = config.gameplayLineAssistStrength ?? 0.32;
    this.gameplayLinePlayerOffsetScale = config.gameplayLinePlayerOffsetScale ?? 4.8;
    this.gameplayLineMaxOffset = config.gameplayLineMaxOffset ?? 6.5;
    this.gameplayLineLookahead = config.gameplayLineLookahead ?? 24;
    this.gameplayLineTurnReduce = config.gameplayLineTurnReduce ?? 0.45;
    this.gameplayLineMaxYaw = config.gameplayLineMaxYaw ?? 0.42;
    this.turnSnowplowSteerStart = config.turnSnowplowSteerStart ?? 0.5;
    this.turnSnowplowSteerRelease = config.turnSnowplowSteerRelease ?? 0.36;
    this.turnSnowplowSteerFull = config.turnSnowplowSteerFull ?? 0.82;
    this.turnSnowplowHoldDuration = config.turnSnowplowHoldDuration ?? 0.18;
    this.turnSnowplowReleaseDuration = config.turnSnowplowReleaseDuration ?? 0.16;
    this.turnSnowplowMinSpeed = config.turnSnowplowMinSpeed ?? 35;
    this.turnSnowplowMaxBlend = config.turnSnowplowMaxBlend ?? 1;
    this.turnSnowplowSpeedReduction = config.turnSnowplowSpeedReduction ?? 150;
    this.snowplowStopResponseMin = config.snowplowStopResponseMin ?? 4;
    this.snowplowStopResponseMax = config.snowplowStopResponseMax ?? 12;
  }

  reset(): void {
    this.skier.position.copyFromFloats(evaluateCourseCenterX(0), evaluateCourseElevation(0) + this.groundOffsetY, 0);
    this.skier.rotation.copyFromFloats(0, 0, 0);
    this.currentSteer = 0;
    this.currentTuck = 0;
    this.verticalVelocity = 0;
    this.airborne = false;
    this.currentForwardSpeed = 0;
    this.lastFrameDeltaX = 0;
    this.lastLateralVelocity = 0;
    this.currentTurnPreviewBetaOffset = 0;
    this.pumpPoseTimer = 0;
    this.turnSnowplowHoldSeconds = 0;
    this.movementHeadingYaw = 0;
    this.velocity.set(0, 0, 0);
    this.driftSlip = 0;
    this.edgeHold = 0;
    this.lastSnowplowBrakeBlend = 0;
    this.wallCollisionLatched = false;
    this.startBoostBonusRatio = 0;
    this.skierAvatarRig.applyPose(0, 0, 0, 0, 0, 0);
    this.camera.alpha = this.baseCameraAlpha;
    this.camera.fov = this.baseCameraFov;
  }

  setStartBoostBonusRatio(ratio: number): void {
    this.startBoostBonusRatio = this.clamp(ratio, 0, 0.3);
  }

  playPolePlantAnimation(): void {
    this.pumpPoseTimer = this.pumpPoseDuration;
  }

  update(motion: MotionState, dt: number, movementEnabled = true): SkierSnapshot {
    this.sanitizeRuntimeState();
    const sourceSteerScale = motion.source === "pose" ? this.poseSteerScale : 1;
    const steerTarget = movementEnabled && motion.tracking ? this.clamp(motion.steer * sourceSteerScale, -1, 1) : 0;
    const targetTuck = motion.tracking ? motion.tuck : 0;

    this.currentSteer = this.lerp(this.currentSteer, steerTarget, dt * this.steerSmooth);
    this.currentTuck = this.lerp(this.currentTuck, targetTuck, dt * this.tuckSmooth);
    if (motion.pumpTriggered) {
      this.playPolePlantAnimation();
    } else {
      this.pumpPoseTimer = Math.max(0, this.pumpPoseTimer - dt);
    }
    const pumpPoseBlend = this.evaluatePumpPoseBlend();
    const glidePoseBlend = this.evaluateGlidePoseBlend(movementEnabled);
    const lateralLean = this.evaluateLateralLean();

    if (!movementEnabled) {
      this.currentForwardSpeed = this.lerp(this.currentForwardSpeed, 0, dt * 12);
      this.velocity.set(0, 0, 0);
      this.driftSlip = this.lerp(this.driftSlip, 0, dt * 8);
      this.edgeHold = this.lerp(this.edgeHold, 0, dt * 8);
      this.lastSnowplowBrakeBlend = 0;
      this.wallCollisionLatched = false;
      this.verticalVelocity = 0;
      this.airborne = false;
      this.skier.position.y = sampleGroundHeight(this.course, this.skier.position.x, this.skier.position.z) + this.groundOffsetY;
      this.lastFrameDeltaX = 0;
      this.lastLateralVelocity = 0;

      const animationPreview = evaluateTurnPreviewAssist(this.skier.position.z + 2, this.course.turnMarkers);
      const animationTurnBlend = this.evaluateTurnFollowBlend(animationPreview.blend);
      const animationRouteBias = this.evaluateRoutePreviewBias(this.skier.position.z + 2);
      const carveIntent = this.evaluateCarveIntent(animationRouteBias, animationTurnBlend);
      this.skierAvatarRig.applyPose(
        this.currentTuck,
        glidePoseBlend,
        carveIntent,
        animationTurnBlend,
        lateralLean,
        pumpPoseBlend,
        0,
        this.edgeHold,
        this.driftSlip
      );
      this.updateVisualHeading();
      this.updateCamera(evaluateTurnPreviewAssist(this.skier.position.z, this.course.turnMarkers));

      return {
        position: this.skier.position.clone(),
        currentSteer: this.currentSteer,
        currentTuck: this.currentTuck,
        currentForwardSpeed: this.currentForwardSpeed,
        edgeHold: this.edgeHold,
        driftSlip: this.driftSlip,
        snowTrail: this.createSnowTrailState(false, true)
      };
    }

    const tuckEffect = Math.pow(this.currentTuck, this.tuckResponseExponent);
    const slopeFactor = evaluateCourseSlopeFactor(this.skier.position.z);
    const downhillFactor = Math.max(0, -slopeFactor);
    const driveEffect = motion.tracking ? motion.drive : 0;
    const upcomingTurnPreview = evaluateTurnPreviewAssist(this.skier.position.z, this.course.turnMarkers);
    const turnSnowplowBrakeBlend = this.evaluateTurnSnowplowBrakeBlend(
      upcomingTurnPreview.blend,
      this.currentSteer,
      this.currentForwardSpeed,
      dt
    );
    this.lastSnowplowBrakeBlend = turnSnowplowBrakeBlend;
    const effectiveBrakeBlend = turnSnowplowBrakeBlend;
    const noTuckTargetSpeed = this.baseForwardSpeed
      + (downhillFactor * this.downhillSpeedBoost)
      - (Math.max(0, slopeFactor) * this.uphillSpeedPenalty);
    const driveBoost =
      driveEffect
      * this.driveSpeedBoost
      * (0.65 + downhillFactor * this.driveDownhillSynergy);
    const tuckBonusMultiplier =
      1 + this.maxTuckSpeedBonusRatio * tuckEffect * (0.82 + downhillFactor * 0.3);
    const slopeAdjustedSpeed =
      (noTuckTargetSpeed + driveBoost) * tuckBonusMultiplier
      - turnSnowplowBrakeBlend * this.turnSnowplowSpeedReduction;
    const startSpeedLimit = this.evaluateStartSpeedLimit(this.skier.position.z);
    const minTargetSpeed = turnSnowplowBrakeBlend > 0.01 ? 0 : this.minForwardSpeed;
    const uncappedTargetForwardSpeed = this.clamp(Math.min(slopeAdjustedSpeed, startSpeedLimit), minTargetSpeed, this.maxForwardSpeed);
    const snowplowSpeedCeiling = Math.max(
      0,
      this.currentForwardSpeed - turnSnowplowBrakeBlend * this.turnSnowplowSpeedReduction * dt
    );
    const targetForwardSpeed = turnSnowplowBrakeBlend > 0.01
      ? Math.min(uncappedTargetForwardSpeed, snowplowSpeedCeiling)
      : uncappedTargetForwardSpeed;
    const snowplowStopResponse = this.lerp(this.snowplowStopResponseMin, this.snowplowStopResponseMax, turnSnowplowBrakeBlend);
    const speedResponse =
      targetForwardSpeed > this.currentForwardSpeed
        ? this.accelerationResponse * (0.58 + driveEffect * 0.62 + tuckEffect * 0.42)
        : turnSnowplowBrakeBlend > 0.01
          ? snowplowStopResponse
          : slopeFactor > 0.06
          ? this.uphillDecelerationResponse
          : slopeFactor > 0.015
            ? this.gentleUphillDecelerationResponse
            : this.flatGlideDecelerationResponse;
    this.currentForwardSpeed = this.lerp(
      this.currentForwardSpeed,
      targetForwardSpeed,
      dt * speedResponse
    );
    if (movementEnabled && motion.pumpTriggered) {
      this.currentForwardSpeed = Math.min(
        this.maxForwardSpeed,
        this.currentForwardSpeed + this.pumpImpulseBoost * (1 + this.startBoostBonusRatio) * (0.72 + downhillFactor * 0.38)
      );
    }
    const groundedForCarve = this.isGrounded();
    this.updateMovementHeading(dt, groundedForCarve, upcomingTurnPreview.blend);
    const previousZ = this.skier.position.z;
    const turnPreview = upcomingTurnPreview;
    const previousX = this.skier.position.x;
    this.updateCarvingVelocity(this.currentForwardSpeed, effectiveBrakeBlend, downhillFactor, dt, groundedForCarve);
    const proposedZ = this.skier.position.z + this.velocity.z * dt;
    const courseCenterX = evaluateCourseCenterX(proposedZ);
    const laneHalfWidth = Math.max(0.6, this.course.courseHalfWidth - this.boundaryPadding);
    const minLaneX = courseCenterX - laneHalfWidth;
    const maxLaneX = courseCenterX + laneHalfWidth;
    const unclampedProposedX = this.skier.position.x + this.velocity.x * dt;
    const proposedX = this.clamp(
      unclampedProposedX,
      minLaneX,
      maxLaneX
    );
    this.skier.position.z = proposedZ;
    const resolvedX = resolveRampSideCollision(this.course, proposedX, this.skier.position.z, this.skierRadius);
    const finalX = this.clamp(resolvedX, minLaneX, maxLaneX);
    const wallCollisionDetected = Math.abs(finalX - unclampedProposedX) > 1e-4;
    const naturalDeltaX = proposedX - previousX;
    const naturalLateralVelocity = naturalDeltaX / Math.max(dt, 1e-5);
    this.lastFrameDeltaX = naturalDeltaX;
    this.lastLateralVelocity = naturalLateralVelocity;
    this.skier.position.x = finalX;
    this.velocity.x = naturalLateralVelocity;
    this.velocity.z = (this.skier.position.z - previousZ) / Math.max(dt, 1e-5);
    this.currentForwardSpeed = Math.min(this.maxForwardSpeed, Math.hypot(this.velocity.x, this.velocity.z));
    if (!this.sanitizeRuntimeState()) {
      return this.createSnapshot(false, true);
    }
    if (wallCollisionDetected && !this.wallCollisionLatched) {
      this.currentForwardSpeed *= this.wallCollisionSpeedRetention;
      this.velocity.scaleInPlace(this.wallCollisionSpeedRetention);
      this.wallCollisionLatched = true;
    } else if (!wallCollisionDetected) {
      this.wallCollisionLatched = false;
    }
    const courseGroundY = sampleGroundHeight(this.course, finalX, this.skier.position.z);
    const ramp = this.runSession.consumeRamp(this.skier.position.x, previousZ, this.skier.position.z, false);
    if (ramp) {
      this.currentForwardSpeed = Math.min(this.maxForwardSpeed, this.currentForwardSpeed + ramp.launchBoost * 0.32);
      this.startRampLaunch(ramp.launchBoost);
    }
    this.updateVerticalMotion(courseGroundY, dt);

    this.runSession.evaluateGate(this.skier.position.x, this.skier.position.z);
    const animationPreview = evaluateTurnPreviewAssist(this.skier.position.z + 2, this.course.turnMarkers);
    const animationTurnBlend = this.evaluateTurnFollowBlend(animationPreview.blend);
    const animationRouteBias = this.evaluateRoutePreviewBias(this.skier.position.z + 2);
    const carveIntent = this.evaluateCarveIntent(animationRouteBias, animationTurnBlend);
    this.skierAvatarRig.applyPose(
      this.currentTuck,
      glidePoseBlend,
      carveIntent,
      animationTurnBlend,
      lateralLean,
      pumpPoseBlend,
      turnSnowplowBrakeBlend,
      this.edgeHold,
      this.driftSlip
    );
    this.updateVisualHeading();
    this.updateCamera(turnPreview);
    this.sanitizeRuntimeState();

    return this.createSnapshot(true, !this.airborne);
  }

  private createSnapshot(movementEnabled: boolean, grounded: boolean): SkierSnapshot {
    return {
      position: this.skier.position.clone(),
      currentSteer: this.currentSteer,
      currentTuck: this.currentTuck,
      currentForwardSpeed: this.currentForwardSpeed,
      edgeHold: this.edgeHold,
      driftSlip: this.driftSlip,
      snowTrail: this.createSnowTrailState(movementEnabled, grounded)
    };
  }

  private sanitizeRuntimeState(): boolean {
    const positionWasFinite =
      Number.isFinite(this.skier.position.x)
      && Number.isFinite(this.skier.position.y)
      && Number.isFinite(this.skier.position.z);
    const velocityWasFinite =
      Number.isFinite(this.velocity.x)
      && Number.isFinite(this.velocity.y)
      && Number.isFinite(this.velocity.z);
    const scalarWasFinite =
      Number.isFinite(this.currentForwardSpeed)
      && Number.isFinite(this.currentSteer)
      && Number.isFinite(this.currentTuck)
      && Number.isFinite(this.movementHeadingYaw)
      && Number.isFinite(this.driftSlip)
      && Number.isFinite(this.edgeHold)
      && Number.isFinite(this.verticalVelocity);

    if (!positionWasFinite || !velocityWasFinite || !scalarWasFinite) {
      const safeZ = Number.isFinite(this.skier.position.z)
        ? this.clamp(this.skier.position.z, 0, this.course.length)
        : 0;
      const safeX = evaluateCourseCenterX(safeZ);
      const safeY = sampleGroundHeight(this.course, safeX, safeZ) + this.groundOffsetY;
      this.skier.position.copyFromFloats(safeX, safeY, safeZ);
      this.velocity.set(0, 0, 0);
      this.currentForwardSpeed = 0;
      this.lastFrameDeltaX = 0;
      this.lastLateralVelocity = 0;
      this.verticalVelocity = 0;
      this.airborne = false;
      this.movementHeadingYaw = 0;
      this.driftSlip = 0;
      this.edgeHold = 0;
      this.wallCollisionLatched = false;
    }

    if (!Number.isFinite(this.camera.alpha)) {
      this.camera.alpha = this.baseCameraAlpha;
    }
    if (!Number.isFinite(this.camera.beta)) {
      this.camera.beta = 0.98;
    }
    if (!Number.isFinite(this.camera.radius) || this.camera.radius <= 0) {
      this.camera.radius = 10.1;
    }
    if (!Number.isFinite(this.camera.fov) || this.camera.fov <= 0) {
      this.camera.fov = this.baseCameraFov;
    }
    if (
      !Number.isFinite(this.camera.target.x)
      || !Number.isFinite(this.camera.target.y)
      || !Number.isFinite(this.camera.target.z)
    ) {
      this.camera.target.copyFromFloats(
        this.skier.position.x,
        this.skier.position.y + SKIER_BODY_ROOT_OFFSET_Y + 0.9,
        this.skier.position.z
      );
    }

    return positionWasFinite && velocityWasFinite && scalarWasFinite;
  }

  private updateCamera(turnPreview: ReturnType<typeof evaluateTurnPreviewAssist>): void {
    const lookAheadZ = this.skier.position.z + 10 + turnPreview.lookAheadDistance;
    const routePreviewBias = this.evaluateRoutePreviewBias(this.skier.position.z);
    const turnFollowBlend = this.evaluateTurnFollowBlend(turnPreview.blend);
    const routeCameraScale = this.lerp(1, 0.22, turnFollowBlend);
    const targetLeadXScale = this.lerp(1, 0.3, turnFollowBlend);
    const cameraHeadingBias = this.evaluateCameraHeadingBias(routePreviewBias, turnFollowBlend);
    const tangent = evaluateCourseTangent(lookAheadZ);
    const downhillCameraBlend = this.clamp(Math.max(0, -tangent.y) / 0.16, 0, 1);
    const downhillTurnDistanceBlend = turnFollowBlend * downhillCameraBlend;
    const targetLiftScale = this.lerp(1, this.downhillTurnTargetLiftScale, downhillTurnDistanceBlend);
    const targetLeadZScale = this.lerp(1, this.downhillTurnTargetLeadZScale, downhillTurnDistanceBlend);
    const playerTarget = new Vector3(
      this.skier.position.x + turnPreview.targetLeadX * targetLeadXScale,
      this.skier.position.y + SKIER_BODY_ROOT_OFFSET_Y + 0.9 + turnPreview.targetLiftY * targetLiftScale,
      this.skier.position.z + turnPreview.targetLeadZ * targetLeadZScale
    );
    this.camera.alpha = this.lerpAngle(
      this.camera.alpha,
      this.baseCameraAlpha
        - cameraHeadingBias * this.lerp(0.14, 0.2, turnFollowBlend)
        - routePreviewBias * this.routePreviewCameraAlphaInfluence * routeCameraScale
        - turnPreview.alphaBias * routeCameraScale,
      this.lerp(0.08, 0.13, turnFollowBlend)
    );
    const cameraBetaTarget = 0.98 + Math.max(-0.2, Math.min(0.2, tangent.y * -1.45));
    this.currentTurnPreviewBetaOffset = this.lerp(
      this.currentTurnPreviewBetaOffset,
      turnPreview.betaOffset,
      this.turnPreviewBetaOffsetSmooth
    );
    this.camera.beta = this.lerp(
      this.camera.beta,
      cameraBetaTarget + this.currentTurnPreviewBetaOffset,
      0.06
    );
    const cameraRadiusTarget =
      10.1
      + this.currentTuck * 1.0
      + Math.max(0, -tangent.y) * 2.1
      + turnPreview.radiusBoost
      + downhillTurnDistanceBlend * this.downhillTurnRadiusBoost;
    this.camera.radius = this.lerp(this.camera.radius, cameraRadiusTarget, 0.05);
    const fovTuckEffect = Math.pow(this.currentTuck, 0.82);
    const cameraFovTarget =
      this.lerp(this.baseCameraFov, this.maxTuckCameraFov, fovTuckEffect);
    this.camera.fov = this.lerp(this.camera.fov, cameraFovTarget, this.cameraFovSmooth);
    this.camera.target = Vector3.Lerp(
      this.camera.target,
      playerTarget,
      this.cameraTargetFollowBase
        + Math.abs(cameraHeadingBias) * this.cameraTargetFollowBoost
        + turnFollowBlend * 0.2
    );
  }

  private updateVisualHeading(): void {
    const previewZ = this.skier.position.z + 2;
    const turnPreview = evaluateTurnPreviewAssist(previewZ, this.course.turnMarkers);
    const turnFollowBlend = this.evaluateTurnFollowBlend(turnPreview.blend);
    const routePreviewBias = this.evaluateRoutePreviewBias(previewZ);
    const tangent = evaluateCourseTangent(previewZ);
    const carveIntent = this.evaluateCarveIntent(routePreviewBias, turnFollowBlend);
    this.skier.rotation.y = this.lerpAngle(
      this.skier.rotation.y,
      this.movementHeadingYaw
      - (this.currentSteer * this.steerYawInfluence * 0.52)
      + carveIntent * this.carveYawInfluence * 1.18,
      this.lerp(0.16, 0.24, turnFollowBlend)
    );
    const basePitch = Math.max(-0.42, Math.min(0.3, tangent.y * this.visualPitchInfluence - turnFollowBlend * 0.05));
    this.skier.rotation.x = this.lerp(
      this.skier.rotation.x,
      basePitch,
      0.12
    );
    this.skier.rotation.z = this.lerp(
      this.skier.rotation.z,
      this.clamp(
        carveIntent * 0.082 + routePreviewBias * 0.03,
        -0.16,
        0.16
      ),
      this.lerp(0.12, 0.22, turnFollowBlend)
    );
  }

  private isGrounded(): boolean {
    const groundedY = sampleGroundHeight(this.course, this.skier.position.x, this.skier.position.z) + this.groundOffsetY;
    return this.skier.position.y <= groundedY + 0.01;
  }

  private startRampLaunch(launchBoost: number): void {
    this.airborne = true;
    this.verticalVelocity = Math.max(this.verticalVelocity, launchBoost);
  }

  private updateVerticalMotion(courseGroundY: number, dt: number): void {
    const groundedY = courseGroundY + this.groundOffsetY;
    if (!this.airborne) {
      this.skier.position.y = courseGroundY + this.groundOffsetY;
      this.verticalVelocity = 0;
      return;
    }

    this.skier.position.y += this.verticalVelocity * dt;
    this.verticalVelocity += this.gravity * dt;

    if (this.skier.position.y <= groundedY) {
      this.skier.position.y = groundedY;
      this.verticalVelocity = 0;
      this.airborne = false;
    }
  }

  private evaluateRoutePreviewBias(z: number): number {
    const nearCenterX = evaluateCourseCenterX(z + this.routePreviewNearDistance);
    const farCenterX = evaluateCourseCenterX(z + this.routePreviewFarDistance);
    const routeDeltaX = farCenterX - nearCenterX;
    return this.clamp(routeDeltaX * this.routePreviewBiasScale, -1, 1);
  }

  private evaluateCameraHeadingBias(routePreviewBias: number, turnFollowBlend: number): number {
    const lateralVelocityBias = this.clamp(this.lastLateralVelocity / 12, -1, 1);
    const steerBias = -this.currentSteer;
    const velocityWeight = this.lerp(this.cameraHeadingVelocityWeight, this.cameraHeadingTurnVelocityWeight, turnFollowBlend);
    const steerWeight = this.lerp(this.cameraHeadingSteerWeight, this.cameraHeadingTurnSteerWeight, turnFollowBlend);
    const routeWeight = this.lerp(this.cameraHeadingRouteWeight, this.cameraHeadingTurnRouteWeight, turnFollowBlend);
    return this.clamp(
      lateralVelocityBias * velocityWeight
        + steerBias * steerWeight
        + routePreviewBias * routeWeight,
      -1,
      1
    );
  }

  private evaluateTurnFollowBlend(turnPreviewBlend: number): number {
    const steerInfluence = Math.abs(this.currentSteer) * 0.5;
    const lateralInfluence = Math.abs(this.lastLateralVelocity) / 11 * 0.45;
    const previewInfluence = turnPreviewBlend * 0.5;
    return this.clamp(previewInfluence + steerInfluence + lateralInfluence, 0, 1);
  }

  private evaluateCarveIntent(routePreviewBias: number, turnFollowBlend: number): number {
    return this.clamp(
      (-this.currentSteer * (0.46 + turnFollowBlend * 0.18 + this.edgeHold * 0.82))
      * this.lerp(1, 0.58, this.driftSlip)
      + routePreviewBias * 0,
      -1,
      1
    );
  }

  private evaluateTurnSnowplowBrakeBlend(turnPreviewBlend: number, steerInput: number, currentSpeed: number, dt: number): number {
    void turnPreviewBlend;
    if (currentSpeed < this.turnSnowplowMinSpeed) {
      this.turnSnowplowHoldSeconds = 0;
      return 0;
    }

    const steerMagnitude = Math.abs(steerInput);
    const steerFactor = this.clamp(
      (steerMagnitude - this.turnSnowplowSteerStart)
        / Math.max(this.turnSnowplowSteerFull - this.turnSnowplowSteerStart, 1e-5),
      0,
      1
    );
    const intent = steerFactor;
    const sustainTurnIntent = steerMagnitude >= this.turnSnowplowSteerRelease;

    if (intent > 0.01) {
      this.turnSnowplowHoldSeconds = Math.min(
        this.turnSnowplowHoldDuration,
        this.turnSnowplowHoldSeconds + dt * (0.7 + intent * 0.3)
      );
    } else if (sustainTurnIntent) {
      this.turnSnowplowHoldSeconds = Math.max(0, this.turnSnowplowHoldSeconds - dt * 0.16);
    } else {
      this.turnSnowplowHoldSeconds = Math.max(
        0,
        this.turnSnowplowHoldSeconds - dt * (this.turnSnowplowHoldDuration / Math.max(this.turnSnowplowReleaseDuration, 1e-5))
      );
    }

    const holdFactor = this.clamp(this.turnSnowplowHoldSeconds / Math.max(this.turnSnowplowHoldDuration, 1e-5), 0, 1);
    return holdFactor * intent * this.turnSnowplowMaxBlend;
  }

  private updateMovementHeading(dt: number, grounded: boolean, turnPreviewBlend: number): void {
    const speedBlend = this.clamp(this.currentForwardSpeed / Math.max(this.maxForwardSpeed, 1e-5), 0, 1);
    const speedTurnPenalty = this.lerp(this.lowSpeedTurnScale, this.highSpeedTurnScale, speedBlend);
    const tuckTurnPenalty = this.lerp(1, 0.82, this.currentTuck);
    const slipPenalty = this.lerp(1.06, 0.82, this.driftSlip);
    const counterSteerBlend = this.evaluateCounterSteerBlend();
    const counterSteerTurnBoost = this.lerp(1, this.counterSteerTurnBoostMax, counterSteerBlend);
    const snowplowTurnBoost =
      Math.abs(this.currentSteer) > 0.01
        ? this.headingSnowplowTurnBoost * this.turnSnowplowHoldSeconds / Math.max(this.turnSnowplowHoldDuration, 1e-5)
        : 0;
    const turnRate = (this.headingTurnRate * speedTurnPenalty * tuckTurnPenalty * slipPenalty + snowplowTurnBoost) * counterSteerTurnBoost;
    const airScale = grounded ? 1 : this.headingAirControlScale;
    this.movementHeadingYaw = this.clamp(
      this.movementHeadingYaw - this.currentSteer * turnRate * airScale * dt,
      -this.maxMovementHeadingYaw,
      this.maxMovementHeadingYaw
    );
    const neutralReturnBlend = this.evaluateNeutralReturnBlend();
    const neutralReturnRate = this.headingNeutralReturnRate * this.lerp(0.8, 1.2, neutralReturnBlend) * this.lerp(1, 0.72, speedBlend);
    this.movementHeadingYaw = this.lerp(this.movementHeadingYaw, 0, neutralReturnRate * dt);
    this.movementHeadingYaw = this.clamp(
      this.movementHeadingYaw + this.evaluateGameplayLineAssistYaw(turnPreviewBlend, dt, grounded),
      -this.maxMovementHeadingYaw,
      this.maxMovementHeadingYaw
    );
  }

  private evaluateGameplayLineAssistYaw(turnPreviewBlend: number, dt: number, grounded: boolean): number {
    if (!grounded || this.gameplayLineAssistStrength <= 0 || this.currentForwardSpeed < this.minForwardSpeed) {
      return 0;
    }

    const lookaheadZ = this.skier.position.z + this.gameplayLineLookahead;
    const gameplayLineX = this.evaluateGameplayLineX(lookaheadZ);
    const playerOffset = this.clamp(
      this.currentSteer * this.gameplayLinePlayerOffsetScale,
      -this.gameplayLineMaxOffset,
      this.gameplayLineMaxOffset
    );
    const targetLineX = gameplayLineX + playerOffset;
    const lineErrorX = targetLineX - this.skier.position.x;
    const turnAssistScale = this.lerp(1, this.gameplayLineTurnReduce, this.clamp(turnPreviewBlend, 0, 1));
    const speedScale = this.clamp(this.currentForwardSpeed / Math.max(this.maxForwardSpeed * 0.45, 1e-5), 0.25, 1);
    const requestedYaw = lineErrorX * this.gameplayLineAssistStrength * turnAssistScale * speedScale;
    return this.clamp(requestedYaw * dt, -this.gameplayLineMaxYaw * dt, this.gameplayLineMaxYaw * dt);
  }

  private evaluateGameplayLineX(z: number): number {
    const gates = this.course.gates;
    if (gates.length === 0) {
      return evaluateCourseCenterX(z);
    }

    if (z <= gates[0].z) {
      return gates[0].centerX;
    }

    const lastGate = gates[gates.length - 1];
    if (z >= lastGate.z) {
      return lastGate.centerX;
    }

    for (let index = 1; index < gates.length; index += 1) {
      const previousGate = gates[index - 1];
      const nextGate = gates[index];
      if (z > nextGate.z) {
        continue;
      }

      const t = this.clamp((z - previousGate.z) / Math.max(nextGate.z - previousGate.z, 1e-5), 0, 1);
      return this.lerp(previousGate.centerX, nextGate.centerX, t);
    }

    return evaluateCourseCenterX(z);
  }

  private updateCarvingVelocity(
    targetSpeed: number,
    effectiveBrakeBlend: number,
    downhillFactor: number,
    dt: number,
    grounded: boolean
  ): void {
    const velocityHeadingYaw = Math.atan2(this.velocity.x, this.velocity.z || 1e-5);
    const boardDirectionX = Math.sin(this.movementHeadingYaw);
    const boardDirectionZ = Math.cos(this.movementHeadingYaw);
    const speedFloor = effectiveBrakeBlend > 0.01 ? 0 : this.minForwardSpeed;
    const resolvedTravelSpeed = Math.min(this.maxForwardSpeed, Math.hypot(this.velocity.x, this.velocity.z));
    const speed = Math.max(resolvedTravelSpeed, this.currentForwardSpeed, speedFloor);
    const steerMagnitude = Math.abs(this.currentSteer);
    const bodyLeanMagnitude = Math.abs(this.currentSteer);
    const snowplowTurnAssist = effectiveBrakeBlend;
    const tuckPenalty = this.lerp(1, 0.82, this.currentTuck);
    const speedBlend = this.clamp(speed / Math.max(this.maxForwardSpeed, 1e-5), 0, 1);
    const carveInput = this.clamp(steerMagnitude * 0.76 + bodyLeanMagnitude * 1.36 + snowplowTurnAssist * 0.46, 0, 1);
    const loadedCarveInput = carveInput * tuckPenalty * (1.08 + this.edgeHold * 0.48);
    const desiredTurnRadius =
      this.lerp(this.carveRadiusMin, this.carveRadiusMax, speedBlend)
      / Math.max(this.carveRadiusInputFloor, loadedCarveInput + this.carveRadiusInputBias);
    const requiredLateralGrip = grounded ? (speed * speed) / Math.max(desiredTurnRadius, 1e-5) : 0;
    const availableLateralGrip =
      grounded
        ? this.lerp(this.carveGripMin, this.carveGripMax, loadedCarveInput)
          * (0.92 + downhillFactor * 0.5)
        : this.carveGripMin * 0.16;
    const overload = Math.max(0, (requiredLateralGrip - availableLateralGrip) / Math.max(availableLateralGrip, 1));
    const driftTarget = grounded
      ? this.clamp(
        overload * 0.92
          + Math.max(0, loadedCarveInput - 0.82) * speedBlend * 0.48
          + snowplowTurnAssist * 0.22,
        0,
        1
      )
      : 1;
    this.driftSlip = this.lerp(this.driftSlip, driftTarget, dt * (driftTarget > this.driftSlip ? 6.2 : 3.4));
    const edgeHoldTarget = grounded
      ? this.clamp(
        (1 - overload)
          * (0.36 + loadedCarveInput * 0.96)
          * this.lerp(1, 0.45, this.driftSlip),
        0,
        1
      )
      : 0.08;
    this.edgeHold = this.lerp(this.edgeHold, edgeHoldTarget, dt * (grounded ? 8 : 4));

    const headingError = this.normalizeAngle(this.movementHeadingYaw - velocityHeadingYaw);
    const counterSteerBlend = this.evaluateCounterSteerBlend();
    const counterSteerAlignBoost = this.lerp(
      1,
      this.counterSteerAlignBoostMax,
      counterSteerBlend * this.clamp(Math.abs(headingError) / 0.72, 0, 1)
    );
    const steerTurnDirection = Math.sign(this.currentSteer);
    const turnDirection = steerTurnDirection === 0 ? 0 : -steerTurnDirection;
    const idealTurnRate = speed / Math.max(desiredTurnRadius, 1e-5);
    const actualTurnRate = idealTurnRate * this.lerp(0.18, 1, this.edgeHold) * this.lerp(1, 0.4, this.driftSlip);
    const carveYawDelta = turnDirection * actualTurnRate * dt;
    const carvedVelocityYaw = velocityHeadingYaw + carveYawDelta;
    const alignRate = this.lerp(this.carveSpeedAlignmentMin, this.carveSpeedAlignmentMax, this.edgeHold) * this.lerp(1, 0.24, this.driftSlip) * counterSteerAlignBoost;
    const targetVelocityYaw = this.rotateAngleToward(carvedVelocityYaw, this.movementHeadingYaw, alignRate * dt);
    const drag = (this.carveBaseDrag + this.driftSlip * this.carveDriftDrag + snowplowTurnAssist * 5.2) * dt;
    const adjustedSpeedFloor = effectiveBrakeBlend > 0.01 ? 0 : this.minForwardSpeed * 0.5;
    const adjustedSpeed = Math.max(adjustedSpeedFloor, this.lerp(speed, targetSpeed, dt * 4.8) - drag);

    this.velocity.x = Math.sin(targetVelocityYaw) * adjustedSpeed;
    this.velocity.z = Math.cos(targetVelocityYaw) * adjustedSpeed;
    if (!grounded) {
      this.velocity.x = this.lerp(this.velocity.x, boardDirectionX * adjustedSpeed, dt * 0.8);
      this.velocity.z = this.lerp(this.velocity.z, boardDirectionZ * adjustedSpeed, dt * 0.8);
    }
  }

  private evaluateStartSpeedLimit(z: number): number {
    const progress = this.clamp(z / this.startSpeedReleaseZ, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    const startBoostBlend = 1 - eased;
    const startBoostMultiplier = 1 + this.startBoostBonusRatio * startBoostBlend;
    return this.lerp(this.startSpeedLimit * startBoostMultiplier, this.maxForwardSpeed, eased);
  }

  private evaluatePumpPoseBlend(): number {
    if (this.pumpPoseTimer <= 0) {
      return 0;
    }

    const progress = 1 - this.clamp(this.pumpPoseTimer / this.pumpPoseDuration, 0, 1);
    return Math.sin(progress * Math.PI);
  }

  private evaluateGlidePoseBlend(movementEnabled: boolean): number {
    if (!movementEnabled) {
      return 0;
    }

    return this.clamp(
      (this.currentForwardSpeed - this.glidePoseSpeedStart) / Math.max(this.glidePoseSpeedFull - this.glidePoseSpeedStart, 1e-5),
      0,
      1
    );
  }

  private evaluateLateralLean(): number {
    const movementLeanRaw = this.lastLateralVelocity / 8.2;
    const movementLean = Math.abs(movementLeanRaw) < 0.12 ? 0 : this.clamp(movementLeanRaw, -1, 1);
    const edgeLeanRaw = -this.currentSteer * (0.28 + this.edgeHold * 0.56);
    const edgeLean = Math.abs(edgeLeanRaw) < 0.08 ? 0 : this.clamp(edgeLeanRaw, -1, 1);
    const driftCounterLean = this.clamp(this.lastLateralVelocity / 11, -0.5, 0.5) * this.driftSlip;
    return this.clamp(movementLean * 0.34 + edgeLean + driftCounterLean, -1, 1);
  }

  private evaluateCounterSteerBlend(): number {
    if (Math.abs(this.currentSteer) < 0.01 || Math.abs(this.movementHeadingYaw) < 0.01) {
      return 0;
    }

    const opposingInputBlend = this.clamp(
      (this.currentSteer * this.movementHeadingYaw) / Math.max(this.maxMovementHeadingYaw, 1e-5),
      0,
      1
    );
    const headingExtentBlend = this.clamp(
      Math.abs(this.movementHeadingYaw) / Math.max(this.maxMovementHeadingYaw, 1e-5),
      0,
      1
    );
    return opposingInputBlend * headingExtentBlend;
  }

  private evaluateNeutralReturnBlend(): number {
    if (Math.abs(this.currentSteer) >= 0.08) {
      return 0;
    }

    const neutralInputBlend = this.clamp(1 - Math.abs(this.currentSteer) / 0.08, 0, 1);
    const headingExtentBlend = this.clamp(
      Math.abs(this.movementHeadingYaw) / Math.max(this.maxMovementHeadingYaw, 1e-5),
      0,
      1
    );
    return neutralInputBlend * headingExtentBlend;
  }

  private createSnowTrailState(movementEnabled: boolean, grounded: boolean): SnowTrailState {
    return evaluateSnowTrailState({
      movementEnabled,
      grounded,
      speed: this.currentForwardSpeed,
      maxForwardSpeed: this.maxForwardSpeed,
      steer: this.currentSteer,
      lateralVelocity: this.lastLateralVelocity,
      brakeBlend: this.lastSnowplowBrakeBlend
    });
  }

  private lerp(current: number, target: number, alpha: number): number {
    const clamped = Math.max(0, Math.min(1, alpha));
    return current + (target - current) * clamped;
  }

  private lerpAngle(current: number, target: number, alpha: number): number {
    let delta = target - current;
    while (delta > Math.PI) {
      delta -= Math.PI * 2;
    }
    while (delta < -Math.PI) {
      delta += Math.PI * 2;
    }
    return current + delta * Math.max(0, Math.min(1, alpha));
  }

  private rotateAngleToward(current: number, target: number, maxDelta: number): number {
    const delta = this.normalizeAngle(target - current);
    const clampedDelta = this.clamp(delta, -maxDelta, maxDelta);
    return current + clampedDelta;
  }

  private normalizeAngle(value: number): number {
    let angle = value;
    while (angle > Math.PI) {
      angle -= Math.PI * 2;
    }
    while (angle < -Math.PI) {
      angle += Math.PI * 2;
    }
    return angle;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
