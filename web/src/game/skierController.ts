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
  snowTrail: SnowTrailState;
}

export class SkierController {
  private readonly baseForwardSpeed = 10;
  private readonly lateralSpeed = 14.8;
  private readonly steerSmooth = 6;
  private readonly tuckSmooth = 6;
  private readonly glidePoseSpeedStart = 4;
  private readonly glidePoseSpeedFull = 22;
  private readonly tuckResponseExponent = 0.78;
  private readonly jumpHeight = 2.4;
  private readonly rampCruiseJumpHeight = 1.2;
  private readonly rampJumpHeight = 1.8;
  private readonly stuntSpeedThreshold = 45;
  private readonly stuntDurationMin = 0.72;
  private readonly stuntDurationMax = 1.2;
  private readonly gravity = -20;
  private readonly groundOffsetY = 0;
  private readonly boundaryPadding = 0.2;
  private readonly skierRadius = 0.46;
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
  private readonly downhillSpeedBoost = 350;
  private readonly driveSpeedBoost = 34;
  private readonly driveDownhillSynergy = 0.8;
  private readonly maxTuckSpeedBonusRatio = 0.08;
  private readonly uphillSpeedPenalty = 12;
  private readonly autoBrakeSpeedStart = 45;
  private readonly autoBrakeSpeedRange = 55;
  private readonly autoBrakeTurnStart = 0.42;
  private readonly autoBrakeTurnRange = 0.4;
  private readonly autoBrakeMaxBlend = 0.38;
  private readonly manualBrakeSpeedStart = 24;
  private readonly manualBrakeSpeedRange = 56;
  private readonly manualBrakeSpeedReduction = 48;
  private readonly autoBrakeSpeedReduction = 26;
  private readonly minForwardSpeed = 7.5;
  private readonly maxForwardSpeed = 150;
  private readonly visualPitchInfluence = 1.15;
  private readonly accelerationResponse = 5.6;
  private readonly flatGlideDecelerationResponse = 0.2;
  private readonly gentleUphillDecelerationResponse = 0.7;
  private readonly uphillDecelerationResponse = 1.8;
  private readonly brakeDecelerationResponse = 5.2;
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
  private readonly airCameraRadiusBoost = 1.7;
  private readonly airCameraBetaBoost = 0.12;
  private readonly airCameraTargetHeightBoost = 1.2;
  private readonly airCameraFovBoost = 0.08;
  private readonly airCameraHoldSeconds = 0.24;
  private readonly airCameraBlendResponse = 7.5;
  private readonly turnPreviewBetaOffsetSmooth = 0.042;
  private readonly turnLateralSpeedBoost = 9.5;
  private readonly speedLateralAuthorityBoost = 2.15;
  private readonly brakeLateralAuthorityBoost = 4.2;
  private readonly pumpPoseDuration = 0.3;

  private currentSteer = 0;
  private currentTuck = 0;
  private verticalVelocity = 0;
  private currentForwardSpeed = 0;
  private airCameraBlend = 0;
  private airCameraTimer = 0;
  private airCameraActive = false;
  private lastFrameDeltaX = 0;
  private lastLateralVelocity = 0;
  private currentTurnPreviewBetaOffset = 0;
  private stuntActive = false;
  private stuntElapsed = 0;
  private stuntDuration = 0;
  private stuntRotationX = 0;
  private pumpPoseTimer = 0;

  constructor(
    private readonly skier: Mesh,
    private readonly skierAvatarRig: SkierAvatarRig,
    private readonly camera: ArcRotateCamera,
    private readonly course: TrackCourse,
    private readonly runSession: RunSession
  ) {}

  reset(): void {
    this.skier.position.copyFromFloats(evaluateCourseCenterX(0), evaluateCourseElevation(0) + this.groundOffsetY, 0);
    this.skier.rotation.copyFromFloats(0, 0, 0);
    this.currentSteer = 0;
    this.currentTuck = 0;
    this.verticalVelocity = 0;
    this.currentForwardSpeed = 0;
    this.airCameraBlend = 0;
    this.airCameraTimer = 0;
    this.airCameraActive = false;
    this.lastFrameDeltaX = 0;
    this.lastLateralVelocity = 0;
    this.currentTurnPreviewBetaOffset = 0;
    this.stuntActive = false;
    this.stuntElapsed = 0;
    this.stuntDuration = 0;
    this.stuntRotationX = 0;
    this.pumpPoseTimer = 0;
    this.skierAvatarRig.applyPose(0, 0, 0, 0, 0, 0);
    this.camera.alpha = this.baseCameraAlpha;
    this.camera.fov = this.baseCameraFov;
  }

  update(motion: MotionState, dt: number, movementEnabled = true): SkierSnapshot {
    const targetSteer = motion.tracking ? motion.steer : 0;
    const targetTuck = motion.tracking ? motion.tuck : 0;

    this.currentSteer = this.lerp(this.currentSteer, targetSteer, dt * this.steerSmooth);
    this.currentTuck = this.lerp(this.currentTuck, targetTuck, dt * this.tuckSmooth);
    if (motion.pumpTriggered) {
      this.pumpPoseTimer = this.pumpPoseDuration;
    } else {
      this.pumpPoseTimer = Math.max(0, this.pumpPoseTimer - dt);
    }
    const pumpPoseBlend = this.evaluatePumpPoseBlend();
    const glidePoseBlend = this.evaluateGlidePoseBlend(movementEnabled);
    const lateralLean = this.evaluateLateralLean();

    if (!movementEnabled) {
      this.currentForwardSpeed = this.lerp(this.currentForwardSpeed, 0, dt * 12);
      this.verticalVelocity = 0;
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
        motion.brake
      );
      this.updateVisualHeading();
      this.updateCamera(evaluateTurnPreviewAssist(this.skier.position.z, this.course.turnMarkers));

      return {
        position: this.skier.position.clone(),
        currentSteer: this.currentSteer,
        currentTuck: this.currentTuck,
        currentForwardSpeed: this.currentForwardSpeed,
        snowTrail: this.createSnowTrailState(false, true)
      };
    }

    const tuckEffect = Math.pow(this.currentTuck, this.tuckResponseExponent);
    const slopeFactor = evaluateCourseSlopeFactor(this.skier.position.z);
    const downhillFactor = Math.max(0, -slopeFactor);
    const driveEffect = motion.tracking ? motion.drive : 0;
    const upcomingTurnPreview = evaluateTurnPreviewAssist(this.skier.position.z, this.course.turnMarkers);
    const autoBrakeBlend = this.evaluateAutoBrakeBlend(upcomingTurnPreview.blend);
    const manualBrakeBlend = this.evaluateManualBrakeBlend(motion.brake);
    const effectiveBrakeBlend = Math.max(autoBrakeBlend, manualBrakeBlend);
    const noTuckTargetSpeed = this.baseForwardSpeed
      + (downhillFactor * this.downhillSpeedBoost)
      - (Math.max(0, slopeFactor) * this.uphillSpeedPenalty);
    const driveBoost =
      driveEffect
      * this.driveSpeedBoost
      * (0.65 + downhillFactor * this.driveDownhillSynergy);
    const tuckBonusMultiplier =
      1 + this.maxTuckSpeedBonusRatio * tuckEffect * (0.4 + downhillFactor * 1.05);
    const brakeSpeedReduction =
      manualBrakeBlend * this.manualBrakeSpeedReduction
      + autoBrakeBlend * this.autoBrakeSpeedReduction;
    const slopeAdjustedSpeed = (noTuckTargetSpeed + driveBoost) * tuckBonusMultiplier - brakeSpeedReduction;
    const targetForwardSpeed = this.clamp(slopeAdjustedSpeed, this.minForwardSpeed, this.maxForwardSpeed);
    const speedResponse =
      targetForwardSpeed > this.currentForwardSpeed
        ? this.accelerationResponse * (0.58 + driveEffect * 0.62)
        : effectiveBrakeBlend > 0.05
          ? this.brakeDecelerationResponse + effectiveBrakeBlend * 2.2
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
    this.skier.position.z += this.currentForwardSpeed * dt;
    const turnPreview = upcomingTurnPreview;
    const previousX = this.skier.position.x;
    const courseCenterX = evaluateCourseCenterX(this.skier.position.z);
    const laneHalfWidth = Math.max(0.6, this.course.courseHalfWidth - this.boundaryPadding);
    const minLaneX = courseCenterX - laneHalfWidth;
    const maxLaneX = courseCenterX + laneHalfWidth;
    const lateralSpeed = this.evaluateLateralControlSpeed(turnPreview.blend, effectiveBrakeBlend);
    const proposedX = this.clamp(
      this.skier.position.x + -this.currentSteer * lateralSpeed * dt,
      minLaneX,
      maxLaneX
    );
    const resolvedX = resolveRampSideCollision(this.course, proposedX, this.skier.position.z, this.skierRadius);
    const finalX = this.clamp(resolvedX, minLaneX, maxLaneX);
    this.lastFrameDeltaX = finalX - previousX;
    this.lastLateralVelocity = this.lastFrameDeltaX / Math.max(dt, 1e-5);
    this.skier.position.x = finalX;
    const courseGroundY = sampleGroundHeight(this.course, finalX, this.skier.position.z);

    let rampLaunchedThisFrame = false;
    if (this.isGrounded()) {
      if (this.verticalVelocity < 0) {
        this.verticalVelocity = -1;
      }

      const ramp = this.runSession.consumeRamp(this.skier.position.x, this.skier.position.z, motion.jumpTriggered);
      if (ramp) {
        const launchHeight = motion.jumpTriggered ? this.rampJumpHeight : this.rampCruiseJumpHeight;
        this.verticalVelocity = Math.sqrt(launchHeight * -2 * this.gravity) + ramp.launchBoost;
        this.startRampStunt(this.currentForwardSpeed, this.verticalVelocity);
        this.airCameraActive = true;
        this.airCameraTimer = this.airCameraHoldSeconds;
        rampLaunchedThisFrame = true;
      } else if (motion.jumpTriggered) {
        this.verticalVelocity = Math.sqrt(this.jumpHeight * -2 * this.gravity);
      }
    }

    this.verticalVelocity += this.gravity * dt;
    this.skier.position.y += this.verticalVelocity * dt;

    const groundedY = courseGroundY + this.groundOffsetY;
    if (this.skier.position.y < groundedY) {
      this.skier.position.y = groundedY;
    }

    if (!rampLaunchedThisFrame) {
      this.airCameraTimer = Math.max(0, this.airCameraTimer - dt);
    }

    const airborne = this.skier.position.y > groundedY + 0.02;
    this.updateRampStunt(dt, airborne);
    const airCameraTarget = this.airCameraActive && (airborne || this.airCameraTimer > 0) ? 1 : 0;
    this.airCameraBlend = this.lerp(this.airCameraBlend, airCameraTarget, dt * this.airCameraBlendResponse);
    if (airCameraTarget === 0 && this.airCameraBlend < 0.02) {
      this.airCameraActive = false;
      this.airCameraBlend = 0;
    }

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
      manualBrakeBlend
    );
    this.updateVisualHeading();
    this.updateCamera(turnPreview);

    return {
      position: this.skier.position.clone(),
      currentSteer: this.currentSteer,
      currentTuck: this.currentTuck,
      currentForwardSpeed: this.currentForwardSpeed,
      snowTrail: this.createSnowTrailState(true, !airborne)
    };
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
      this.skier.position.y + SKIER_BODY_ROOT_OFFSET_Y + 0.9 + turnPreview.targetLiftY * targetLiftScale + this.airCameraBlend * this.airCameraTargetHeightBoost * 0.45,
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
      cameraBetaTarget + this.currentTurnPreviewBetaOffset + this.airCameraBlend * this.airCameraBetaBoost,
      0.06
    );
    const cameraRadiusTarget =
      10.1
      + this.currentTuck * 1.0
      + Math.max(0, -tangent.y) * 2.1
      + turnPreview.radiusBoost
      + downhillTurnDistanceBlend * this.downhillTurnRadiusBoost
      + this.airCameraBlend * this.airCameraRadiusBoost;
    this.camera.radius = this.lerp(this.camera.radius, cameraRadiusTarget, 0.05);
    const fovTuckEffect = Math.pow(this.currentTuck, 0.82);
    const cameraFovTarget =
      this.lerp(this.baseCameraFov, this.maxTuckCameraFov, fovTuckEffect) + this.airCameraBlend * this.airCameraFovBoost;
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
      (-routePreviewBias * this.routePreviewYawInfluence * (1 + turnFollowBlend * 0.2))
      - (this.currentSteer * this.steerYawInfluence)
      + carveIntent * this.carveYawInfluence,
      this.lerp(0.16, 0.24, turnFollowBlend)
    );
    const basePitch = Math.max(-0.42, Math.min(0.3, tangent.y * this.visualPitchInfluence - turnFollowBlend * 0.05));
    if (this.stuntActive || this.stuntRotationX > 0.001) {
      this.skier.rotation.x = basePitch + this.stuntRotationX;
    } else {
      this.skier.rotation.x = this.lerp(
        this.skier.rotation.x,
        basePitch,
        0.12
      );
    }
    this.skier.rotation.z = this.lerp(
      this.skier.rotation.z,
      this.clamp(
        carveIntent * 0.045 + routePreviewBias * 0.025,
        -0.08,
        0.08
      ),
      this.lerp(0.12, 0.22, turnFollowBlend)
    );
  }

  private isGrounded(): boolean {
    const groundedY = sampleGroundHeight(this.course, this.skier.position.x, this.skier.position.z) + this.groundOffsetY;
    return this.skier.position.y <= groundedY + 0.01;
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
      (-this.currentSteer * (0.72 + turnFollowBlend * 0.24))
      - routePreviewBias * (0.22 + turnFollowBlend * 0.18),
      -1,
      1
    );
  }

  private evaluateLateralControlSpeed(turnPreviewBlend: number, brakeBlend: number): number {
    const speedBlend = this.clamp((this.currentForwardSpeed - 18) / 102, 0, 1);
    const steerBlend = Math.abs(this.currentSteer);
    const turnBoost = turnPreviewBlend * this.turnLateralSpeedBoost;
    const speedBoost = speedBlend * this.speedLateralAuthorityBoost * this.lateralSpeed;
    const steerBoost = steerBlend * 3.0;
    const brakeBoost = brakeBlend * this.brakeLateralAuthorityBoost;
    return this.lateralSpeed + turnBoost + speedBoost + steerBoost + brakeBoost;
  }

  private evaluateAutoBrakeBlend(turnPreviewBlend: number): number {
    const speedFactor = this.clamp(
      (this.currentForwardSpeed - this.autoBrakeSpeedStart) / this.autoBrakeSpeedRange,
      0,
      1
    );
    const turnDemand = Math.max(turnPreviewBlend, Math.abs(this.currentSteer));
    const turnFactor = this.clamp(
      (turnDemand - this.autoBrakeTurnStart) / this.autoBrakeTurnRange,
      0,
      1
    );
    return speedFactor * turnFactor * this.autoBrakeMaxBlend;
  }

  private evaluateManualBrakeBlend(brake: number): number {
    const speedFactor = this.clamp(
      (this.currentForwardSpeed - this.manualBrakeSpeedStart) / this.manualBrakeSpeedRange,
      0,
      1
    );
    return this.clamp(brake, 0, 1) * speedFactor;
  }

  private evaluatePumpPoseBlend(): number {
    if (this.pumpPoseTimer <= 0) {
      return 0;
    }

    const progress = 1 - this.clamp(this.pumpPoseTimer / this.pumpPoseDuration, 0, 1);
    return Math.sin(progress * Math.PI);
  }

  private startRampStunt(speed: number, launchVelocity: number): void {
    if (speed < this.stuntSpeedThreshold) {
      this.stuntActive = false;
      this.stuntElapsed = 0;
      this.stuntDuration = 0;
      this.stuntRotationX = 0;
      return;
    }

    const estimatedDuration = this.clamp(
      (Math.max(launchVelocity, 0.1) * 2) / Math.max(-this.gravity, 1e-5),
      this.stuntDurationMin,
      this.stuntDurationMax
    );
    this.stuntActive = true;
    this.stuntElapsed = 0;
    this.stuntDuration = estimatedDuration;
    this.stuntRotationX = 0;
  }

  private updateRampStunt(dt: number, airborne: boolean): void {
    if (!this.stuntActive) {
      this.stuntRotationX = 0;
      return;
    }

    if (!airborne) {
      this.stuntActive = false;
      this.stuntElapsed = 0;
      this.stuntDuration = 0;
      this.stuntRotationX = 0;
      return;
    }

    this.stuntElapsed = Math.min(this.stuntElapsed + dt, this.stuntDuration);
    const progress = this.clamp(this.stuntElapsed / Math.max(this.stuntDuration, 1e-5), 0, 1);
    const easedProgress = progress * progress * (3 - 2 * progress);
    this.stuntRotationX = easedProgress * Math.PI * 2;
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
    const movementLean = this.clamp(this.lastLateralVelocity / 9.5, -1, 1);
    const steerLean = this.clamp(-this.currentSteer * 0.38, -0.38, 0.38);
    return this.clamp(movementLean + steerLean, -1, 1);
  }

  private createSnowTrailState(movementEnabled: boolean, grounded: boolean): SnowTrailState {
    return evaluateSnowTrailState({
      movementEnabled,
      grounded,
      speed: this.currentForwardSpeed,
      maxForwardSpeed: this.maxForwardSpeed,
      steer: this.currentSteer,
      lateralVelocity: this.lastLateralVelocity
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
