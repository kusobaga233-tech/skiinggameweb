import "./styles.css";
import { CameraManager } from "./camera/cameraManager";
import { KeyboardFallback } from "./game/inputFallback";
import type { MotionState } from "./pose/types";
import type { PoseRuntime } from "./pose/poseRuntime";
import type { GameApp } from "./game/gameApp";
import { BoostTutorialVideo } from "./ui/boostTutorialVideo";
import { buildPauseInspectorText, getPauseToggleLabel } from "./ui/pauseInspectorText";
import { ControlPanel } from "./ui/controlPanel";
import { Hud } from "./ui/hud";
import { MiniMap } from "./ui/miniMap";
import { PoseOverlay } from "./ui/poseOverlay";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

const canvas = requiredElement<HTMLCanvasElement>("game-canvas");
const video = requiredElement<HTMLVideoElement>("camera-preview");
const poseOverlayCanvas = requiredElement<HTMLCanvasElement>("pose-overlay");
const miniMapCanvas = requiredElement<HTMLCanvasElement>("mini-map");
const hudOutput = requiredElement<HTMLElement>("hud-output");
const poseStatus = requiredElement<HTMLElement>("pose-status");
const boostTutorialShell = requiredElement<HTMLElement>("boost-tutorial-shell");
const boostTutorialVideoElement = requiredElement<HTMLVideoElement>("boost-tutorial-video");
const cameraSelect = requiredElement<HTMLSelectElement>("camera-select");
const cameraStatus = requiredElement<HTMLElement>("camera-status");
const refreshButton = requiredElement<HTMLButtonElement>("refresh-cameras");
const applyButton = requiredElement<HTMLButtonElement>("apply-camera");
const restartButton = requiredElement<HTMLButtonElement>("restart-run");
const pauseButton = requiredElement<HTMLButtonElement>("toggle-pause");
const meshPickOutput = requiredElement<HTMLElement>("mesh-pick-output");

const cameraManager = new CameraManager(video);
const fallback = new KeyboardFallback();
const hud = new Hud(hudOutput, poseStatus);
const boostTutorialVideo = new BoostTutorialVideo(boostTutorialShell, boostTutorialVideoElement);
const controlPanel = new ControlPanel(cameraSelect, cameraStatus);
const poseOverlay = new PoseOverlay(poseOverlayCanvas, video);
const selectedCameraStorageKey = "skiiing.web.selectedCamera";

let latestPoseMotion: MotionState = {
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
let selectedDeviceId: string | null = null;
let currentCameraLabel = "No camera selected";
let gameApp: GameApp | null = null;
let gameAppPromise: Promise<GameApp> | null = null;
let poseRuntime: PoseRuntime | null = null;
let poseRuntimePromise: Promise<PoseRuntime> | null = null;
let miniMap: MiniMap | null = null;

function syncPauseUi(paused: boolean, pickedText?: string): void {
  pauseButton.textContent = getPauseToggleLabel(paused);
  meshPickOutput.textContent = pickedText ?? buildPauseInspectorText(paused, null);
}

function showFatalStartupError(message: string): void {
  hudOutput.textContent = `Startup failed: ${message}`;
  poseStatus.textContent = `Startup failed: ${message}`;
  controlPanel.setStatus(`Startup failed: ${message}`);
  poseOverlay.clear();
}

async function ensureGameApp(): Promise<GameApp> {
  if (gameApp) {
    return gameApp;
  }

  if (!gameAppPromise) {
    gameAppPromise = import("./game/gameApp")
      .then(({ GameApp: GameAppModule }) => {
        const app = new GameAppModule(canvas);
        miniMap = new MiniMap(miniMapCanvas, app.getCourse());
        app.start((hudState) => {
          app.setMotionState(currentMotion());
          hud.render(hudState);
          boostTutorialVideo.render(hudState.motion);
          miniMap?.render(hudState);
        });
        app.setCameraLabel(currentCameraLabel);
        gameApp = app;
        return app;
      })
      .catch((error: unknown) => {
        gameAppPromise = null;
        const message = error instanceof Error ? error.message : String(error);
        showFatalStartupError(message);
        throw error;
      });
  }

  return gameAppPromise;
}

async function ensurePoseRuntime(): Promise<PoseRuntime> {
  if (poseRuntime) {
    return poseRuntime;
  }

  if (!poseRuntimePromise) {
    poseRuntimePromise = import("./pose/poseRuntime").then(({ PoseRuntime: PoseRuntimeModule }) => {
      poseRuntime = new PoseRuntimeModule();
      return poseRuntime;
    });
  }

  return poseRuntimePromise;
}

function currentMotion(): MotionState {
  if (latestPoseMotion.tracking && latestPoseMotion.confidence >= 0.6) {
    const motion = latestPoseMotion;
    latestPoseMotion = { ...latestPoseMotion, jumpTriggered: false, pumpTriggered: false };
    return motion;
  }

  return fallback.consumeState();
}

async function refreshCameraDevices(): Promise<void> {
  controlPanel.setStatus("Scanning cameras...");
  const devices = await cameraManager.enumerate();
  const preferred = cameraManager.selectPreferred(devices, "USB 2.0 Camera");
  const storedDeviceId = localStorage.getItem(selectedCameraStorageKey);
  const validStoredDeviceId = storedDeviceId && devices.some((item) => item.deviceId === storedDeviceId) ? storedDeviceId : null;
  const validSelectedDeviceId = selectedDeviceId && devices.some((item) => item.deviceId === selectedDeviceId) ? selectedDeviceId : null;
  selectedDeviceId = validSelectedDeviceId ?? validStoredDeviceId ?? preferred?.deviceId ?? null;
  currentCameraLabel = devices.find((item) => item.deviceId === selectedDeviceId)?.label ?? "No camera selected";
  controlPanel.setDevices(devices, selectedDeviceId);
  controlPanel.setStatus(devices.length > 0 ? `Found ${devices.length} camera(s)` : "No camera found");
  (await ensureGameApp()).setCameraLabel(currentCameraLabel);
}

function syncCameraSelectionFromActiveStream(): void {
  const activeDeviceId = cameraManager.getActiveDeviceId();
  const activeLabel = cameraManager.getActiveLabel();
  const options = Array.from(cameraSelect.options).map((option) => ({
    deviceId: option.value,
    label: option.textContent ?? option.value
  }));

  if (activeDeviceId && options.some((option) => option.deviceId === activeDeviceId)) {
    selectedDeviceId = activeDeviceId;
    cameraSelect.value = activeDeviceId;
  } else if (selectedDeviceId && options.some((option) => option.deviceId === selectedDeviceId)) {
    cameraSelect.value = selectedDeviceId;
  }

  currentCameraLabel =
    activeLabel ??
    options.find((option) => option.deviceId === selectedDeviceId)?.label ??
    currentCameraLabel;
}

async function startCameraAndPose(preferredDeviceId: string | null = selectedDeviceId): Promise<void> {
  controlPanel.setStatus(preferredDeviceId ? "Starting camera..." : "Starting default camera...");

  try {
    await cameraManager.start(preferredDeviceId ?? undefined);
  } catch (error) {
    if (!preferredDeviceId) {
      throw error;
    }

    controlPanel.setStatus("Selected camera unavailable, trying default camera...");
    await cameraManager.start();
  }

  try {
    await refreshCameraDevices();
  } catch {
    syncCameraSelectionFromActiveStream();
  }

  syncCameraSelectionFromActiveStream();
  const app = await ensureGameApp();
  app.setPoseStatus("Loading pose runtime...", 0, 0);
  const runtime = await ensurePoseRuntime();
  await runtime.initialize();
  runtime.start(
    video,
    (motion) => {
      latestPoseMotion = motion;
    },
    (status) => {
      app.setPoseStatus(status.message, status.fps, status.inferenceMs);
    },
    (overlayFrame) => {
      poseOverlay.draw(overlayFrame);
    }
  );
  app.setCameraLabel(currentCameraLabel);
  if (selectedDeviceId) {
    localStorage.setItem(selectedCameraStorageKey, selectedDeviceId);
  }
  controlPanel.setStatus(`Active: ${currentCameraLabel}`);
}

refreshButton.addEventListener("click", async () => {
  try {
    await refreshCameraDevices();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    controlPanel.setStatus(`Refresh failed: ${message}`);
  }
});

applyButton.addEventListener("click", async () => {
  try {
    selectedDeviceId = controlPanel.getSelectedDeviceId();
    await startCameraAndPose(selectedDeviceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    controlPanel.setStatus(`Camera start failed: ${message}`);
    gameApp?.setPoseStatus(`Camera start failed: ${message}`, 0, 0);
    poseOverlay.clear();
  }
});

restartButton.addEventListener("click", () => {
  gameApp?.restart();
});

pauseButton.addEventListener("click", async () => {
  const app = await ensureGameApp();
  const paused = app.togglePaused();
  syncPauseUi(paused);
});

canvas.addEventListener("click", async (event) => {
  const app = await ensureGameApp();
  if (!app.isPaused()) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const pickedMesh = app.pickMeshAtCanvasPoint(x, y);
  meshPickOutput.textContent = buildPauseInspectorText(true, pickedMesh);
});

void (async () => {
  const app = await ensureGameApp();
  syncPauseUi(app.isPaused());
  try {
    await refreshCameraDevices();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    controlPanel.setStatus(`Camera scan failed: ${message}`);
  }

  try {
    await startCameraAndPose(selectedDeviceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    controlPanel.setStatus(`Camera unavailable: ${message}`);
    app.setPoseStatus(`Camera unavailable: ${message}`, 0, 0);
    poseOverlay.clear();
  }
})().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  showFatalStartupError(message);
  gameApp?.setPoseStatus(`Startup failed: ${message}`, 0, 0);
});
