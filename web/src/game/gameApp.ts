import type { MotionState } from "../pose/types";
import type { HudState } from "../pose/types";
import type { PickedMeshInfo } from "../ui/pauseInspectorText";
import { RunSession } from "./runSession";
import { createInactiveSnowTrailState } from "./snowTrail";
import { buildScene, type BuiltScene } from "./sceneBuilder";
import { SkierController } from "./skierController";
import { createTrackCourse, type TrackCourse } from "./trackCourse";

export class GameApp {
  private readonly course = createTrackCourse();
  private readonly runSession = new RunSession(this.course);
  private readonly built: BuiltScene;
  private readonly skierController: SkierController;
  private latestMotion: MotionState = {
    steer: 0,
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
  private latestSnowTrail = createInactiveSnowTrailState();
  private paused = false;

  constructor(canvas: HTMLCanvasElement) {
    this.built = buildScene(canvas, this.course);
    this.skierController = new SkierController(
      this.built.skier,
      this.built.skierAvatarRig,
      this.built.camera,
      this.course,
      this.runSession
    );
  }

  start(onFrame: (hud: HudState) => void): void {
    this.built.engine.runRenderLoop(() => {
      const dt = Math.min(this.built.engine.getDeltaTime() / 1000, 0.05);
      if (!this.paused && !this.runSession.getStats().completed) {
        const runStats = this.runSession.getStats();
        const startTriggered = this.shouldStartRun(this.latestMotion);
        const movementEnabled = runStats.started || startTriggered;
        const snapshot = this.skierController.update(this.latestMotion, dt, movementEnabled);
        this.runSession.update(dt, snapshot.position.z, startTriggered);
        this.latestSpeed = snapshot.currentForwardSpeed;
        this.latestPlayerX = snapshot.position.x;
        this.latestPlayerZ = snapshot.position.z;
        this.latestSnowTrail = snapshot.snowTrail;
      } else if (!this.paused) {
        this.latestSnowTrail = createInactiveSnowTrailState();
      }

      this.built.snowTrailEffect.update(this.latestSnowTrail);
      this.built.scene.render();
      onFrame(this.createHudState());
    });

    window.addEventListener("resize", () => {
      this.built.engine.resize();
    });
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
    this.latestMotion = {
      steer: 0,
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
      motion: this.latestMotion
    };
  }

  private shouldStartRun(motion: MotionState): boolean {
    if (motion.source === "keyboard") {
      return motion.drive > 0;
    }

    return motion.tracking && (motion.boostLocked || motion.pumpHits >= 2);
  }
}
