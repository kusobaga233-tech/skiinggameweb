import "@babylonjs/loaders/glTF";
import {
  AnimationGroup,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3
} from "@babylonjs/core";

const MODEL_URL = "/character/skiing_lady.glb";
const HIDDEN_NAME_PATTERNS = [/ground/i, /floor/i];

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

const canvas = requiredElement<HTMLCanvasElement>("model-preview-canvas");
const statusLine = requiredElement<HTMLElement>("preview-status");
const hiddenMeshesOutput = requiredElement<HTMLElement>("hidden-meshes");
const animationStateOutput = requiredElement<HTMLElement>("animation-state");
const animationSelect = requiredElement<HTMLSelectElement>("animation-select");
const toggleAnimationButton = requiredElement<HTMLButtonElement>("toggle-animation");

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

const scene = new Scene(engine);
scene.clearColor = new Color4(0.78, 0.88, 0.98, 1);

const camera = new ArcRotateCamera("preview-camera", -Math.PI / 2, 1.05, 8, Vector3.Zero(), scene);
camera.wheelDeltaPercentage = 0.02;
camera.lowerRadiusLimit = 1.5;
camera.upperRadiusLimit = 16;
camera.panningSensibility = 120;
camera.attachControl(canvas, true);

const hemiLight = new HemisphericLight("preview-hemi", new Vector3(0, 1, 0), scene);
hemiLight.intensity = 1.05;
hemiLight.groundColor = new Color3(0.72, 0.8, 0.92);

const keyLight = new DirectionalLight("preview-key", new Vector3(-0.3, -1, 0.35), scene);
keyLight.position = new Vector3(6, 10, -8);
keyLight.intensity = 1.35;

let activeAnimationGroup: AnimationGroup | null = null;
let animationGroups: AnimationGroup[] = [];
let animationPlaying = true;

function setStatus(message: string): void {
  statusLine.textContent = message;
}

function setAnimationState(message: string): void {
  animationStateOutput.textContent = message;
}

function hideIrrelevantMeshes(nodes: TransformNode[]): string[] {
  const hiddenNames: string[] = [];

  for (const node of nodes) {
    const lowerName = node.name.toLowerCase();
    if (!HIDDEN_NAME_PATTERNS.some((pattern) => pattern.test(lowerName))) {
      continue;
    }

    node.setEnabled(false);
    hiddenNames.push(node.name);
  }

  return hiddenNames;
}

function collectTopLevelNodes(result: Awaited<ReturnType<typeof SceneLoader.ImportMeshAsync>>): TransformNode[] {
  const meshNodes = result.meshes.filter((mesh) => mesh.parent === null);
  const transformNodes = result.transformNodes.filter((node) => node.parent === null);
  return [...meshNodes, ...transformNodes];
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
  const radius = Math.max(size.length() * 0.72, 2.8);

  const offsetRoot = new TransformNode("preview-offset-root", scene);
  offsetRoot.position = new Vector3(-center.x, -min.y, -center.z);

  for (const node of collectTopLevelNodes(result)) {
    node.parent = offsetRoot;
  }

  camera.target = new Vector3(0, size.y * 0.48, 0);
  camera.radius = radius;
  camera.lowerRadiusLimit = Math.max(radius * 0.45, 1.4);
  camera.upperRadiusLimit = Math.max(radius * 2.2, radius + 3);
}

function stopAllAnimations(): void {
  for (const group of animationGroups) {
    group.stop();
  }
}

function playAnimation(group: AnimationGroup | null): void {
  stopAllAnimations();
  activeAnimationGroup = group;

  if (!group) {
    animationPlaying = false;
    setAnimationState("模型未提供动画");
    toggleAnimationButton.disabled = true;
    return;
  }

  group.start(true, 1);
  animationPlaying = true;
  toggleAnimationButton.disabled = false;
  toggleAnimationButton.textContent = "暂停动画";
  setAnimationState(`正在循环播放: ${group.name || "Unnamed Animation"}`);
}

function bindAnimationControls(): void {
  animationSelect.addEventListener("change", () => {
    const next = animationGroups[animationSelect.selectedIndex] ?? null;
    playAnimation(next);
  });

  toggleAnimationButton.addEventListener("click", () => {
    if (!activeAnimationGroup) {
      return;
    }

    if (animationPlaying) {
      activeAnimationGroup.pause();
      animationPlaying = false;
      toggleAnimationButton.textContent = "继续动画";
      setAnimationState(`已暂停: ${activeAnimationGroup.name || "Unnamed Animation"}`);
      return;
    }

    activeAnimationGroup.play(true);
    animationPlaying = true;
    toggleAnimationButton.textContent = "暂停动画";
    setAnimationState(`正在循环播放: ${activeAnimationGroup.name || "Unnamed Animation"}`);
  });
}

async function loadModel(): Promise<void> {
  setStatus("正在加载 GLB 模型...");

  const result = await SceneLoader.ImportMeshAsync("", "", MODEL_URL, scene);

  const hiddenNames = hideIrrelevantMeshes(result.meshes);
  hiddenMeshesOutput.textContent = hiddenNames.length > 0 ? hiddenNames.join(", ") : "未隐藏";

  frameVisibleModel(result);

  animationGroups = result.animationGroups;
  animationSelect.replaceChildren();

  if (animationGroups.length === 0) {
    const option = document.createElement("option");
    option.textContent = "无动画";
    animationSelect.append(option);
    animationSelect.disabled = true;
    playAnimation(null);
  } else {
    animationSelect.disabled = false;
    animationGroups.forEach((group, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = group.name || `Animation ${index + 1}`;
      animationSelect.append(option);
    });
    playAnimation(animationGroups[0] ?? null);
  }

  const meshCount = result.meshes.filter((mesh) => mesh.getTotalVertices() > 0 && mesh.isEnabled()).length;
  setStatus(`加载完成: ${meshCount} 个可见 mesh, ${animationGroups.length} 段动画`);
}

bindAnimationControls();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});

window.addEventListener("beforeunload", () => {
  scene.dispose();
  engine.dispose();
});

void loadModel().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(`加载失败: ${message}`);
  setAnimationState("动画未播放");
  hiddenMeshesOutput.textContent = "未完成检测";
  toggleAnimationButton.disabled = true;
  animationSelect.disabled = true;
  console.error(error);
});
