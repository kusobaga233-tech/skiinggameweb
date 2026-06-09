import type { MotionState } from "../pose/types";
import type { HudState } from "../pose/types";
import type { PickedMeshInfo } from "../ui/pauseInspectorText";
import { RunSession } from "./runSession";
import { createInactiveSnowTrailState } from "./snowTrail";
import { buildScene, type BuiltScene } from "./sceneBuilder";
import { SkierController, type SkierControllerConfig } from "./skierController";
import { createTrackCourse, type TrackCourse, type TrackCourseId } from "./trackCourse";

export interface GameAppConfig extends SkierControllerConfig {}

export class GameApp {
  private readonly course: TrackCourse;
  private readonly runSession: RunSession;
  private readonly built: BuiltScene;
  private readonly skierController: SkierController;
  private latestMotion: MotionState = {
    steer: 0,
    snowplow: 0,
    tuck: 0,
    brake: 0,
    jumpTriggered: false,
    pumpTriggered: false,
    drive: 0,
    pumpActive: false,
    pumpHits: 0,
    boostLocked: false,
    boostRemainingMs: 0,
    confidence: 0,
    source: "none",
    tracking: false
  };
  private poseMessage = "Pose runtime idle";
  private poseFps = 0;
  private inferenceMs = 0;
  private activeCameraLabel = "No camera selected";
  private latestSpeed = 0;
  private latestPlayerX = 0;
  private latestPlayerZ = 0;
  private latestEdgeHold = 0;
  private latestDriftSlip = 0;
  private latestSnowTrail = createInactiveSnowTrailState();
  private paused = false;
  private readonly uiUpdateIntervalMs = 100;
  private readonly finishAutoResetDelay = 1.0;
  private readonly startBoostCycleSeconds = 1.65;
  private readonly maxStartBoostBonusRatio = 0.3;
  private lastUiUpdateMs = -Infinity;
  private completedAutoResetTimer = 0;
  private startBoostPhaseSeconds = 0;
  private startBoostProgress = 0;
  private startBoostBonusRatio = 0;
  private startBoostLocked = false;
  private readonly handleResize = () => {
    this.built.engine.resize();
  };

  constructor(
    canvas: HTMLCanvasElement,
    readonly trackId: TrackCourseId = "track1",
    config: GameAppConfig = {}
  ) {
    this.course = createTrackCourse(trackId);
    this.runSession = new RunSession(this.course);
    this.built = buildScene(canvas, this.course);
    this.skierController = new SkierController(
      this.built.skier,
      this.built.skierAvatarRig,
      this.built.camera,
      this.course,
      this.runSession,
      config
    );
  }

  start(onFrame: (hud: HudState) => void): void {
    this.built.engine.resize();
    requestAnimationFrame(() => this.built.engine.resize());

    this.built.engine.runRenderLoop(() => {
      const dt = Math.min(this.built.engine.getDeltaTime() / 1000, 0.05);
      if (!this.paused && !this.runSession.getStats().completed) {
        const runStats = this.runSession.getStats();
        const startTriggered = this.shouldStartRun(this.latestMotion);
        this.updateStartBoost(dt, runStats.started, startTriggered);
        const movementEnabled = runStats.started || startTriggered;
        const snapshot = this.skierController.update(this.latestMotion, dt, movementEnabled);
        this.runSession.update(dt, snapshot.position.z, startTriggered);
        this.latestSpeed = snapshot.currentForwardSpeed;
        this.latestPlayerX = snapshot.position.x;
        this.latestPlayerZ = snapshot.position.z;
        this.latestEdgeHold = snapshot.edgeHold;
        this.latestDriftSlip = snapshot.driftSlip;
        this.latestSnowTrail = snapshot.snowTrail;
        this.completedAutoResetTimer = 0;
      } else if (!this.paused && this.runSession.getStats().completed) {
        this.latestSnowTrail = createInactiveSnowTrailState();
        this.completedAutoResetTimer += dt;
        if (this.completedAutoResetTimer >= this.finishAutoResetDelay) {
          this.restart();
        }
      } else if (!this.paused) {
        this.latestSnowTrail = createInactiveSnowTrailState();
      }

      this.built.snowTrailEffect.update(this.latestSnowTrail);
      this.built.scene.render();
      if (this.shouldUpdateUi()) {
        onFrame(this.createHudState());
      }
    });

    window.addEventListener("resize", this.handleResize);
  }

  setMotionState(motion: MotionState): void {
    this.latestMotion = motion;
  }

  setPoseStatus(message: string, fps: number, inferenceMs: number): void {
    this.poseMessage = message;
    this.poseFps = fps;
    this.inferenceMs = inferenceMs;
  }

  setCameraLabel(label: string): void {
    this.activeCameraLabel = label;
  }

  togglePaused(): boolean {
    this.paused = !this.paused;
    if (this.paused) {
      this.latestSnowTrail = createInactiveSnowTrailState();
    }
    return this.paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  pickMeshAtCanvasPoint(x: number, y: number): PickedMeshInfo | null {
    const pickResult = this.built.scene.pick(x, y);
    const mesh = pickResult?.pickedMesh;
    if (!mesh) {
      return null;
    }

    return {
      meshName: mesh.name || "(unnamed mesh)",
      parentName: mesh.parent?.name || "(no parent)",
      materialName: mesh.material?.name || "(no material)"
    };
  }

  getCourse(): TrackCourse {
    return this.course;
  }

  restart(): void {
    this.runSession.reset();
    this.skierController.reset();
    this.latestSpeed = 0;
    this.latestPlayerX = 0;
    this.latestPlayerZ = 0;
    this.latestEdgeHold = 0;
    this.latestDriftSlip = 0;
    this.latestMotion = {
      steer: 0,
      snowplow: 0,
      tuck: 0,
      brake: 0,
      jumpTriggered: false,
      pumpTriggered: false,
      drive: 0,
      pumpActive: false,
      pumpHits: 0,
      boostLocked: false,
      boostRemainingMs: 0,
      confidence: 0,
      source: "none",
      tracking: false
    };
    this.latestSnowTrail = createInactiveSnowTrailState();
    this.completedAutoResetTimer = 0;
    this.startBoostPhaseSeconds = 0;
    this.startBoostProgress = 0;
    this.startBoostBonusRatio = 0;
    this.startBoostLocked = false;
  }

  dispose(): void {
    this.built.engine.stopRenderLoop();
    window.removeEventListener("resize", this.handleResize);
    this.built.scene.dispose();
    this.built.engine.dispose();
  }

  private createHudState(): HudState {
    const stats = this.runSession.getStats();
    return {
      ...stats,
      paused: this.paused,
      speed: this.latestSpeed,
      cameraLabel: this.activeCameraLabel,
      poseMessage: this.poseMessage,
      poseFps: this.poseFps,
      inferenceMs: this.inferenceMs,
      playerX: this.latestPlayerX,
      playerZ: this.latestPlayerZ,
      edgeHold: this.latestEdgeHold,
      driftSlip: this.latestDriftSlip,
      startBoostProgress: this.startBoostProgress,
      startBoostBonusRatio: this.startBoostBonusRatio,
      startBoostLocked: this.startBoostLocked,
      startBoostWaiting: !stats.started && !stats.completed,
      motion: this.latestMotion
    };
  }

  private shouldStartRun(motion: MotionState): boolean {
    if (motion.source === "keyboard") {
      return motion.drive > 0;
    }

    return motion.tracking && motion.pumpTriggered;
  }

  private updateStartBoost(dt: number, started: boolean, startTriggered: boolean): void {
    if (started || this.startBoostLocked) {
      return;
    }

    this.startBoostPhaseSeconds = (this.startBoostPhaseSeconds + dt) % this.startBoostCycleSeconds;
    this.startBoostProgress = this.startBoostPhaseSeconds / this.startBoostCycleSeconds;

    if (!startTriggered) {
      return;
    }

    this.startBoostLocked = true;
    this.startBoostBonusRatio = this.startBoostProgress * this.maxStartBoostBonusRatio;
    this.skierController.setStartBoostBonusRatio(this.startBoostBonusRatio);
    this.skierController.playPolePlantAnimation();
  }

  private shouldUpdateUi(): boolean {
    const nowMs = performance.now();
    if (nowMs - this.lastUiUpdateMs < this.uiUpdateIntervalMs) {
      return false;
    }

    this.lastUiUpdateMs = nowMs;
    return true;
  }
}
