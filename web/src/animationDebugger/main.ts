import "@babylonjs/loaders/glTF";
import {
  AbstractMesh,
  AnimationGroup,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  SceneLoader,
  Skeleton,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";

const MODEL_URL = "/character/skiing_lady.glb";
const GROUND_PATTERNS = [/ground/i, /floor/i, /shadow/i];

type FocusPreset = "all" | "spine" | "arms" | "legs" | "head" | "props";
type ToggleGroupKey = "ground" | "body" | "headGear" | "leftPole" | "rightPole" | "skis";

type StructureEntry = {
  detail: string;
  enabled: boolean;
  keywords: string;
  label: string;
  order: number;
};

const FOCUS_PATTERNS: Record<FocusPreset, RegExp[]> = {
  all: [],
  arms: [/arm/i, /shoulder/i, /hand/i, /pole/i],
  head: [/head/i, /face/i, /helmet/i, /goggle/i, /mask/i, /neck/i],
  legs: [/leg/i, /thigh/i, /shin/i, /foot/i, /toe/i, /ski/i, /pelvis/i],
  props: [/pole/i, /ski/i],
  spine: [/spine/i, /pelvis/i, /torso/i, /chest/i]
};

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(2)}s`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function uniqueNodes(nodes: TransformNode[]): TransformNode[] {
  return Array.from(new Set(nodes));
}

const canvas = requiredElement<HTMLCanvasElement>("animation-debugger-canvas");
const statusLine = requiredElement<HTMLElement>("debug-status");
const playbackStatePill = requiredElement<HTMLElement>("playback-state-pill");
const animationSelect = requiredElement<HTMLSelectElement>("animation-select");
const togglePlaybackButton = requiredElement<HTMLButtonElement>("toggle-playback");
const replayAnimationButton = requiredElement<HTMLButtonElement>("replay-animation");
const speedInput = requiredElement<HTMLInputElement>("playback-speed");
const speedReadout = requiredElement<HTMLElement>("speed-readout");
const loopInput = requiredElement<HTMLInputElement>("loop-animation");
const timelineScrubber = requiredElement<HTMLInputElement>("timeline-scrubber");
const timelineReadout = requiredElement<HTMLElement>("timeline-readout");
const currentAnimationName = requiredElement<HTMLElement>("current-animation-name");
const animationDuration = requiredElement<HTMLElement>("animation-duration");
const animationProgress = requiredElement<HTMLElement>("animation-progress");
const animationFrame = requiredElement<HTMLElement>("animation-frame");
const modelSummary = requiredElement<HTMLElement>("model-summary");
const structureSummary = requiredElement<HTMLElement>("structure-summary");
const focusPresetSelect = requiredElement<HTMLSelectElement>("focus-preset");
const structureSearchInput = requiredElement<HTMLInputElement>("structure-search");
const nodeList = requiredElement<HTMLUListElement>("node-list");
const boneList = requiredElement<HTMLUListElement>("bone-list");
const nodeCountPill = requiredElement<HTMLElement>("node-count-pill");
const boneCountPill = requiredElement<HTMLElement>("bone-count-pill");
const showSkeletonInput = requiredElement<HTMLInputElement>("show-skeleton");
const showGroundInput = requiredElement<HTMLInputElement>("show-ground");
const showBodyInput = requiredElement<HTMLInputElement>("show-body");
const showHeadGearInput = requiredElement<HTMLInputElement>("show-head-gear");
const showLeftPoleInput = requiredElement<HTMLInputElement>("show-left-pole");
const showRightPoleInput = requiredElement<HTMLInputElement>("show-right-pole");
const showSkisInput = requiredElement<HTMLInputElement>("show-skis");

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

const scene = new Scene(engine);
scene.clearColor = new Color4(0.04, 0.08, 0.12, 1);

const camera = new ArcRotateCamera("animation-debugger-camera", -Math.PI / 2, 1.08, 7.6, Vector3.Zero(), scene);
camera.wheelDeltaPercentage = 0.02;
camera.lowerRadiusLimit = 1.5;
camera.upperRadiusLimit = 18;
camera.panningSensibility = 100;
camera.attachControl(canvas, true);

const hemiLight = new HemisphericLight("animation-debugger-hemi", new Vector3(0, 1, 0), scene);
hemiLight.intensity = 1.05;
hemiLight.groundColor = new Color3(0.12, 0.2, 0.3);

const keyLight = new DirectionalLight("animation-debugger-key", new Vector3(-0.35, -1, 0.25), scene);
keyLight.position = new Vector3(6, 10, -8);
keyLight.intensity = 1.4;

let activeAnimationGroup: AnimationGroup | null = null;
let animationGroups: AnimationGroup[] = [];
let animationPlaying = true;
let isScrubbing = false;
let currentFocusPreset: FocusPreset = "all";
let primarySkeleton: Skeleton | null = null;
let primarySkinnedMesh: AbstractMesh | null = null;
let skeletonViewer: SkeletonViewer | null = null;
let nodeEntries: StructureEntry[] = [];
let boneEntries: StructureEntry[] = [];
let toggleGroups: Record<ToggleGroupKey, TransformNode[]> = {
  body: [],
  ground: [],
  headGear: [],
  leftPole: [],
  rightPole: [],
  skis: []
};

function setStatus(message: string): void {
  statusLine.textContent = message;
}

function getPlaybackSpeed(): number {
  return Number(speedInput.value);
}

function setPlaybackPill(message: string): void {
  playbackStatePill.textContent = message;
}

function setPlaybackUiEnabled(enabled: boolean): void {
  animationSelect.disabled = !enabled;
  togglePlaybackButton.disabled = !enabled;
  replayAnimationButton.disabled = !enabled;
  speedInput.disabled = !enabled;
  loopInput.disabled = !enabled;
  timelineScrubber.disabled = !enabled;
}

function stopAllAnimations(): void {
  for (const group of animationGroups) {
    group.stop();
  }
}

function buildStructureItem(entry: StructureEntry): HTMLLIElement {
  const item = document.createElement("li");
  const title = document.createElement("div");
  title.className = "structure-item-title";

  const name = document.createElement("span");
  name.textContent = entry.label;
  title.append(name);

  const state = document.createElement("span");
  state.className = entry.enabled ? "" : "muted";
  state.textContent = entry.enabled ? "shown" : "hidden";
  title.append(state);

  const meta = document.createElement("div");
  meta.className = "structure-item-meta";
  meta.textContent = entry.detail;

  item.append(title, meta);
  return item;
}

function matchesFocusPreset(value: string, preset: FocusPreset): boolean {
  const patterns = FOCUS_PATTERNS[preset];
  if (patterns.length === 0) {
    return true;
  }

  return patterns.some((pattern) => pattern.test(value));
}

function refreshStructureLists(): void {
  const search = structureSearchInput.value.trim().toLowerCase();
  const applyFilters = (entries: StructureEntry[]) =>
    entries.filter((entry) => {
      const matchesPreset = matchesFocusPreset(entry.keywords, currentFocusPreset);
      const matchesSearch = search.length === 0 || entry.keywords.includes(search);
      return matchesPreset && matchesSearch;
    });

  const filteredNodes = applyFilters(nodeEntries);
  const filteredBones = applyFilters(boneEntries);

  nodeList.replaceChildren(...filteredNodes.map(buildStructureItem));
  boneList.replaceChildren(...filteredBones.map(buildStructureItem));
  nodeCountPill.textContent = String(filteredNodes.length);
  boneCountPill.textContent = String(filteredBones.length);

  const nodeTotal = nodeEntries.length;
  const boneTotal = boneEntries.length;
  structureSummary.textContent =
    `Showing ${filteredNodes.length}/${nodeTotal} nodes and ${filteredBones.length}/${boneTotal} bones` +
    (currentFocusPreset === "all" ? "" : ` for ${currentFocusPreset}`);
}

function frameVisibleModel(result: Awaited<ReturnType<typeof SceneLoader.ImportMeshAsync>>): void {
  const visibleMeshes = result.meshes.filter((mesh) => mesh.isEnabled() && mesh.getTotalVertices() > 0);
  if (visibleMeshes.length === 0) {
    return;
  }

  let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const mesh of visibleMeshes) {
    const info = mesh.getBoundingInfo();
    min = Vector3.Minimize(min, info.boundingBox.minimumWorld);
    max = Vector3.Maximize(max, info.boundingBox.maximumWorld);
  }

  const center = min.add(max).scale(0.5);
  const size = max.subtract(min);
  const radius = Math.max(size.length() * 0.74, 2.7);
  const offsetRoot = new TransformNode("animation-debugger-offset-root", scene);
  offsetRoot.position = new Vector3(-center.x, -min.y, -center.z);

  const topLevelNodes = [
    ...result.meshes.filter((mesh) => mesh.parent === null),
    ...result.transformNodes.filter((node) => node.parent === null)
  ];

  for (const node of topLevelNodes) {
    node.parent = offsetRoot;
  }

  camera.target = new Vector3(0, size.y * 0.5, 0);
  camera.radius = radius;
  camera.lowerRadiusLimit = Math.max(radius * 0.4, 1.3);
  camera.upperRadiusLimit = Math.max(radius * 2.3, radius + 4);
}

function syncToggleAvailability(): void {
  const bindings: Array<[HTMLInputElement, ToggleGroupKey]> = [
    [showGroundInput, "ground"],
    [showBodyInput, "body"],
    [showHeadGearInput, "headGear"],
    [showLeftPoleInput, "leftPole"],
    [showRightPoleInput, "rightPole"],
    [showSkisInput, "skis"]
  ];

  for (const [input, key] of bindings) {
    input.disabled = toggleGroups[key].length === 0;
  }

  showSkeletonInput.disabled = primarySkeleton === null || primarySkinnedMesh === null;
}

function setGroupVisibility(key: ToggleGroupKey, visible: boolean): void {
  for (const node of toggleGroups[key]) {
    node.setEnabled(visible);
  }

  nodeEntries = nodeEntries.map((entry) => {
    const related = toggleGroups[key].some((node) => node.name === entry.label);
    return related ? { ...entry, enabled: visible } : entry;
  });

  refreshStructureLists();
}

function syncSkeletonViewer(): void {
  if (!showSkeletonInput.checked) {
    skeletonViewer?.dispose();
    skeletonViewer = null;
    return;
  }

  if (!primarySkeleton || !primarySkinnedMesh) {
    showSkeletonInput.checked = false;
    return;
  }

  if (!skeletonViewer) {
    skeletonViewer = new SkeletonViewer(primarySkeleton, primarySkinnedMesh, scene, true, 2, {
      displayMode: SkeletonViewer.DISPLAY_LINES,
      displayOptions: {
        showLocalAxes: false
      }
    });
    skeletonViewer.color = new Color3(0.96, 0.8, 0.36);
  }

  skeletonViewer.isEnabled = true;
}

function updatePlaybackTelemetry(): void {
  if (!activeAnimationGroup) {
    currentAnimationName.textContent = "--";
    animationDuration.textContent = "--";
    animationProgress.textContent = "--";
    animationFrame.textContent = "--";
    timelineReadout.textContent = "0%";
    timelineScrubber.value = "0";
    return;
  }

  const group = activeAnimationGroup;
  const from = group.from;
  const to = group.to;
  const frameRange = Math.max(to - from, 0.0001);
  const currentFrame = clamp(group.getCurrentFrame(), from, to);
  const progress = clamp((currentFrame - from) / frameRange, 0, 1);
  const durationSeconds = group.getLength(from, to);
  const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 1;
  const elapsedSeconds = (currentFrame - from) / Math.max(fps * group.speedRatio, 0.0001);

  currentAnimationName.textContent = group.name || "Unnamed clip";
  animationDuration.textContent = `${formatSeconds(durationSeconds)} · ${Math.round(group.targetedAnimations.length)} channels`;
  animationProgress.textContent = `${formatSeconds(elapsedSeconds)} / ${formatSeconds(durationSeconds)}`;
  animationFrame.textContent = `${currentFrame.toFixed(1)} / ${to.toFixed(1)}`;
  timelineReadout.textContent = formatPercent(progress);

  if (!isScrubbing) {
    timelineScrubber.value = String(Math.round(progress * 1000));
  }
}

function startAnimation(group: AnimationGroup | null): void {
  stopAllAnimations();
  activeAnimationGroup = group;

  if (!group) {
    animationPlaying = false;
    setPlaybackUiEnabled(false);
    setPlaybackPill("No Clip");
    currentAnimationName.textContent = "No animation clip";
    animationDuration.textContent = "--";
    animationProgress.textContent = "--";
    animationFrame.textContent = "--";
    togglePlaybackButton.textContent = "Pause";
    return;
  }

  group.start(loopInput.checked, getPlaybackSpeed(), group.from, group.to);
  group.loopAnimation = loopInput.checked;
  animationPlaying = true;
  setPlaybackUiEnabled(true);
  setPlaybackPill(loopInput.checked ? "Playing Loop" : "Playing");
  togglePlaybackButton.textContent = "Pause";
  updatePlaybackTelemetry();
}

function replayActiveAnimation(): void {
  if (!activeAnimationGroup) {
    return;
  }

  startAnimation(activeAnimationGroup);
}

function bindControls(): void {
  animationSelect.addEventListener("change", () => {
    const next = animationGroups[animationSelect.selectedIndex] ?? null;
    startAnimation(next);
  });

  togglePlaybackButton.addEventListener("click", () => {
    if (!activeAnimationGroup) {
      return;
    }

    if (animationPlaying) {
      activeAnimationGroup.pause();
      animationPlaying = false;
      togglePlaybackButton.textContent = "Resume";
      setPlaybackPill("Paused");
      return;
    }

    activeAnimationGroup.play(loopInput.checked);
    activeAnimationGroup.loopAnimation = loopInput.checked;
    animationPlaying = true;
    togglePlaybackButton.textContent = "Pause";
    setPlaybackPill(loopInput.checked ? "Playing Loop" : "Playing");
  });

  replayAnimationButton.addEventListener("click", () => {
    replayActiveAnimation();
  });

  speedInput.addEventListener("input", () => {
    const speed = getPlaybackSpeed();
    speedReadout.textContent = `${speed.toFixed(2)}x`;
    if (activeAnimationGroup) {
      activeAnimationGroup.speedRatio = speed;
      updatePlaybackTelemetry();
    }
  });

  loopInput.addEventListener("change", () => {
    if (!activeAnimationGroup) {
      return;
    }

    activeAnimationGroup.loopAnimation = loopInput.checked;
    setPlaybackPill(animationPlaying ? (loopInput.checked ? "Playing Loop" : "Playing") : "Paused");
  });

  timelineScrubber.addEventListener("pointerdown", () => {
    isScrubbing = true;
  });

  timelineScrubber.addEventListener("input", () => {
    if (!activeAnimationGroup) {
      return;
    }

    const progress = Number(timelineScrubber.value) / 1000;
    const frame = activeAnimationGroup.from + (activeAnimationGroup.to - activeAnimationGroup.from) * progress;
    activeAnimationGroup.goToFrame(frame);
    timelineReadout.textContent = formatPercent(progress);
    updatePlaybackTelemetry();
  });

  const endScrub = () => {
    isScrubbing = false;
    updatePlaybackTelemetry();
  };
  timelineScrubber.addEventListener("change", endScrub);
  timelineScrubber.addEventListener("pointerup", endScrub);
  timelineScrubber.addEventListener("pointercancel", endScrub);

  focusPresetSelect.addEventListener("change", () => {
    currentFocusPreset = focusPresetSelect.value as FocusPreset;
    refreshStructureLists();
  });

  structureSearchInput.addEventListener("input", () => {
    refreshStructureLists();
  });

  showSkeletonInput.addEventListener("change", () => {
    syncSkeletonViewer();
  });

  const visibilityBindings: Array<[HTMLInputElement, ToggleGroupKey]> = [
    [showGroundInput, "ground"],
    [showBodyInput, "body"],
    [showHeadGearInput, "headGear"],
    [showLeftPoleInput, "leftPole"],
    [showRightPoleInput, "rightPole"],
    [showSkisInput, "skis"]
  ];

  for (const [input, key] of visibilityBindings) {
    input.addEventListener("change", () => {
      setGroupVisibility(key, input.checked);
    });
  }
}

function createNodeEntries(result: Awaited<ReturnType<typeof SceneLoader.ImportMeshAsync>>): StructureEntry[] {
  const sceneNodes = [...result.transformNodes, ...result.meshes];
  return sceneNodes
    .filter((node) => Boolean(node.name))
    .map((node, index) => {
      const mesh = node instanceof AbstractMesh ? node : null;
      const meshDescriptor =
        mesh === null
          ? "transform"
          : mesh.skeleton
            ? `skinned mesh · ${mesh.getTotalVertices()} verts`
            : `mesh · ${mesh.getTotalVertices()} verts`;
      return {
        detail: `${meshDescriptor}${node.parent ? ` · parent ${node.parent.name}` : ""}`,
        enabled: node.isEnabled(),
        keywords: `${node.name.toLowerCase()} ${meshDescriptor.toLowerCase()}`,
        label: node.name,
        order: index
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label) || a.order - b.order);
}

function createBoneEntries(skeleton: Skeleton | null): StructureEntry[] {
  if (!skeleton) {
    return [];
  }

  return skeleton.bones.map((bone, index) => ({
    detail: `bone ${index}${bone.children.length > 0 ? ` · ${bone.children.length} children` : ""}`,
    enabled: true,
    keywords: `${bone.name.toLowerCase()} bone ${index}`,
    label: bone.name || `bone-${index}`,
    order: index
  }));
}

function assignToggleGroups(result: Awaited<ReturnType<typeof SceneLoader.ImportMeshAsync>>): void {
  const allNodes = [...result.transformNodes, ...result.meshes];
  const namedNodes = allNodes.filter((node) => Boolean(node.name));

  const namedMatches = (pattern: RegExp) => namedNodes.filter((node) => pattern.test(node.name));

  toggleGroups = {
    body: uniqueNodes(result.meshes.filter((mesh) => mesh.skeleton !== null)),
    ground: uniqueNodes(namedNodes.filter((node) => GROUND_PATTERNS.some((pattern) => pattern.test(node.name)))),
    headGear: uniqueNodes(namedNodes.filter((node) => /helmet|goggle|facemask|face/i.test(node.name))),
    leftPole: uniqueNodes(namedMatches(/pole\.l/i)),
    rightPole: uniqueNodes(namedMatches(/pole\.r/i)),
    skis: uniqueNodes(namedNodes.filter((node) => /ski\.[lr]/i.test(node.name)))
  };

  showGroundInput.checked = false;
  showBodyInput.checked = true;
  showHeadGearInput.checked = true;
  showLeftPoleInput.checked = true;
  showRightPoleInput.checked = true;
  showSkisInput.checked = true;

  setGroupVisibility("ground", false);
  setGroupVisibility("body", true);
  setGroupVisibility("headGear", true);
  setGroupVisibility("leftPole", true);
  setGroupVisibility("rightPole", true);
  setGroupVisibility("skis", true);
  syncToggleAvailability();
}

async function loadModel(): Promise<void> {
  setStatus("Loading skiing_lady.glb into the animation debugger...");

  const result = await SceneLoader.ImportMeshAsync("", "", MODEL_URL, scene);
  frameVisibleModel(result);

  primarySkeleton = result.skeletons[0] ?? null;
  primarySkinnedMesh =
    result.meshes.find((mesh) => mesh.skeleton === primarySkeleton && mesh.getTotalVertices() > 0) ?? null;

  nodeEntries = createNodeEntries(result);
  boneEntries = createBoneEntries(primarySkeleton);

  assignToggleGroups(result);
  refreshStructureLists();

  animationGroups = result.animationGroups;
  animationSelect.replaceChildren();

  if (animationGroups.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No clip found";
    animationSelect.append(option);
    startAnimation(null);
  } else {
    for (const [index, group] of animationGroups.entries()) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = group.name || `Animation ${index + 1}`;
      animationSelect.append(option);
    }

    startAnimation(animationGroups[0] ?? null);
  }

  const visibleMeshCount = result.meshes.filter((mesh) => mesh.isEnabled() && mesh.getTotalVertices() > 0).length;
  const clipNote =
    animationGroups.length === 1 && animationGroups[0]?.name === "Scene"
      ? "single imported clip"
      : `${animationGroups.length} clips`;
  modelSummary.textContent =
    `${visibleMeshCount} visible meshes · ${result.skeletons.length} skeletons · ${primarySkeleton?.bones.length ?? 0} bones`;
  setStatus(
    `Ready: ${clipNote}, ${visibleMeshCount} visible meshes, ${primarySkeleton?.bones.length ?? 0} bones to inspect`
  );
  syncToggleAvailability();
  updatePlaybackTelemetry();
}

bindControls();
setPlaybackUiEnabled(false);
speedReadout.textContent = `${getPlaybackSpeed().toFixed(2)}x`;

scene.onBeforeRenderObservable.add(() => {
  updatePlaybackTelemetry();
});

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});

window.addEventListener("beforeunload", () => {
  skeletonViewer?.dispose();
  scene.dispose();
  engine.dispose();
});

void loadModel().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(`Failed to load model: ${message}`);
  setPlaybackPill("Load Error");
  setPlaybackUiEnabled(false);
  syncToggleAvailability();
  console.error(error);
});
