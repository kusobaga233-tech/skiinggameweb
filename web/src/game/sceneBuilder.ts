import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Path3D } from "@babylonjs/core/Maths/math.path";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Scene } from "@babylonjs/core/scene";
import { createInactiveSnowTrailState, type SnowTrailState } from "./snowTrail";
import { evaluateCourseCenterX, evaluateCourseElevation, evaluateCourseTangent, evaluateTurnEntryHint, sampleCoursePoint, type RampData, type TrackCourse } from "./trackCourse";

const ENABLE_DYNAMIC_BACKDROP = false;

export interface BuiltScene {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  skier: Mesh;
  skierAvatarRig: SkierAvatarRig;
  snowTrailEffect: SkierSnowTrailEffect;
  ground: Mesh;
}

export interface SkierSnowTrailEffect {
  update(state: SnowTrailState): void;
}

function material(scene: Scene, name: string, diffuse: Color3): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = diffuse;
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  return mat;
}

interface SkierMaterials {
  suit: StandardMaterial;
  trim: StandardMaterial;
  skin: StandardMaterial;
  pole: StandardMaterial;
  ski: StandardMaterial;
  goggle: StandardMaterial;
}

interface PosePart {
  mesh: Mesh;
  basePosition: Vector3;
  tuckPosition: Vector3;
  baseRotation: Vector3;
  tuckRotation: Vector3;
}

export interface SkierAvatarRig {
  applyPose(
    tuck: number,
    glide?: number,
    carve?: number,
    turnBlend?: number,
    lateralLean?: number,
    pumpBlend?: number,
    brakeBlend?: number,
    edgeHold?: number,
    driftSlip?: number
  ): void;
}

export const SKIER_BODY_ROOT_OFFSET_Y = 1.08;

export function buildScene(canvas: HTMLCanvasElement, course: TrackCourse): BuiltScene {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor.set(0.84, 0.93, 1.0, 1.0);
  ensureCloudSeaShader();

  const sun = new DirectionalLight("sun", new Vector3(-0.3, -1, 0.5), scene);
  sun.position = new Vector3(10, 18, -10);
  sun.intensity = 1.1;

  const camera = new ArcRotateCamera("follow-camera", -Math.PI / 2, 1.05, 11, new Vector3(0, evaluateCourseElevation(0) + 1.4, 6), scene);
  scene.activeCamera = camera;
  camera.fov = 0.8;
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 14;
  camera.wheelDeltaPercentage = 0.01;

  const snowMaterial = material(scene, "snow", Color3.FromHexString("#f3f7fb"));
  const trackMaterial = material(scene, "track", Color3.FromHexString("#d9ddd9"));
  const leftGateMaterial = material(scene, "left-gate", Color3.FromHexString("#1d6cff"));
  const rightGateMaterial = material(scene, "right-gate", Color3.FromHexString("#ef562f"));
  const bannerMaterial = material(scene, "banner", Color3.FromHexString("#fff4d6"));
  const rampMaterial = material(scene, "ramp", Color3.FromHexString("#d58c24"));
  const boundMaterial = material(scene, "bound", Color3.FromHexString("#b7223b"));
  const markerMaterial = material(scene, "marker", Color3.FromHexString("#b8f2e6"));
  const skierMaterials: SkierMaterials = {
    suit: material(scene, "skier-suit", Color3.FromHexString("#ffb703")),
    trim: material(scene, "skier-trim", Color3.FromHexString("#1f3c88")),
    skin: material(scene, "skier-skin", Color3.FromHexString("#f2c6a8")),
    pole: material(scene, "skier-pole", Color3.FromHexString("#4f4f58")),
    ski: material(scene, "skier-ski", Color3.FromHexString("#2a9d8f")),
    goggle: material(scene, "skier-goggle", Color3.FromHexString("#2b2d42"))
  };

  const pathPoints = course.samples.map((sample) => new Vector3(sample.centerX, sample.elevationY - 0.45, sample.z));
  const trackPath = new Path3D(pathPoints);
  const ground = MeshBuilder.CreateRibbon("ground", {
    pathArray: createTrackRibbons(course, course.courseHalfWidth * 1.25),
    closeArray: false,
    closePath: false,
    sideOrientation: Mesh.DOUBLESIDE
  }, scene);
  ground.material = trackMaterial;

  const { root: skier, rig: skierAvatarRig } = createSkierAvatar(scene, skierMaterials);
  skier.position = new Vector3(course.samples[0]?.centerX ?? 0, course.samples[0]?.elevationY ?? 0, 0);
  const snowTrailEffect = createSafeSnowTrailEffect(scene, skier);

  const leftBoundary = MeshBuilder.CreateRibbon("left-boundary", {
    pathArray: createBoundaryRibbon(course, -1, course.courseHalfWidth + 0.45),
    closeArray: false,
    closePath: false,
    sideOrientation: Mesh.DOUBLESIDE
  }, scene);
  leftBoundary.material = boundMaterial;

  const rightBoundary = MeshBuilder.CreateRibbon("right-boundary", {
    pathArray: createBoundaryRibbon(course, 1, course.courseHalfWidth + 0.45),
    closeArray: false,
    closePath: false,
    sideOrientation: Mesh.DOUBLESIDE
  }, scene);
  rightBoundary.material = boundMaterial;

  for (const gate of course.gates) {
    const gateY = sampleHeight(course, gate.z);
    const tangent = evaluateCourseTangent(gate.z);
    const yaw = Math.atan2(tangent.x, tangent.z);
    const pitch = Math.atan2(-tangent.y, Math.hypot(tangent.x, tangent.z));
    const leftPole = MeshBuilder.CreateBox(`gate-left-${gate.index}`, {
      width: 0.18,
      height: 4.8,
      depth: 0.18
    }, scene);
    leftPole.position = new Vector3(gate.centerX - gate.halfWidth, gateY + 2.4, gate.z);
    leftPole.rotation.y = yaw;
    leftPole.rotation.x = pitch;
    leftPole.material = leftGateMaterial;

    const rightPole = MeshBuilder.CreateBox(`gate-right-${gate.index}`, {
      width: 0.18,
      height: 4.8,
      depth: 0.18
    }, scene);
    rightPole.position = new Vector3(gate.centerX + gate.halfWidth, gateY + 2.4, gate.z);
    rightPole.rotation.y = yaw;
    rightPole.rotation.x = pitch;
    rightPole.material = rightGateMaterial;

    const banner = MeshBuilder.CreateBox(`gate-banner-${gate.index}`, {
      width: gate.halfWidth * 2,
      height: 0.12,
      depth: 0.08
    }, scene);
    banner.position = new Vector3(gate.centerX, gateY + 3.35, gate.z);
    banner.rotation.x = pitch;
    banner.rotation.y = yaw;
    banner.material = bannerMaterial;
  }

  for (const ramp of course.ramps) {
    const rampY = sampleHeight(course, ramp.centerZ);
    if (ramp.kind === "large" && ramp.halfWidth >= course.courseHalfWidth - 0.6) {
      const rampMesh = MeshBuilder.CreateRibbon(`ramp-${ramp.index}`, {
        pathArray: createTrackWideRampRibbon(ramp),
        closeArray: false,
        closePath: false,
        sideOrientation: Mesh.DOUBLESIDE
      }, scene);
      rampMesh.material = rampMaterial;
      continue;
    }

    const tangent = evaluateCourseTangent(ramp.centerZ);
    const yaw = Math.atan2(tangent.x, tangent.z);
    const rampHeight = ramp.kind === "large" ? 1.1 : 0.75;
    const rampMesh = MeshBuilder.CreateBox(`ramp-${ramp.index}`, {
      width: ramp.halfWidth * 2,
      height: rampHeight,
      depth: ramp.length
    }, scene);
    rampMesh.position = new Vector3(ramp.centerX, rampY + rampHeight * 0.5, ramp.centerZ);
    rampMesh.rotation.x = ramp.kind === "large" ? -0.29 : -0.24;
    rampMesh.rotation.y = yaw;
    rampMesh.material = rampMaterial;
  }

  for (let markerZ = 36; markerZ < course.length; markerZ += 56) {
    const sample = sampleCoursePoint(markerZ);
    for (const side of [-1, 1] as const) {
      const marker = MeshBuilder.CreateCylinder(`marker-${side}-${markerZ}`, {
        height: 2.4,
        diameter: 0.18
      }, scene);
      marker.position = new Vector3(
        sample.centerX + side * (course.courseHalfWidth + 0.15),
        sample.elevationY + 1.2,
        sample.z
      );
      marker.material = markerMaterial;
    }
  }

  createStartMarker(scene, course);
  createTurnMarkerSigns(scene, course);
  createTurnEntryArrowSigns(scene, course);

  const snowPlane = MeshBuilder.CreateGround("snow-backdrop", {
    width: course.courseHalfWidth * 16,
    height: course.length * 1.3
  }, scene);
  snowPlane.position = new Vector3(0, sampleHeight(course, course.length * 0.4) - 2.2, course.length * 0.45);
  snowPlane.material = snowMaterial;

  if (ENABLE_DYNAMIC_BACKDROP) {
    tryCreateDynamicBackdrop(scene, camera);
  }

  return { engine, scene, camera, skier, skierAvatarRig, snowTrailEffect, ground };
}

function tryCreateDynamicBackdrop(scene: Scene, camera: ArcRotateCamera): void {
  try {
    createDynamicBackdrop(scene, camera);
  } catch (error) {
    console.warn("Dynamic backdrop disabled after initialization failure.", error);
  }
}

function createSafeSnowTrailEffect(scene: Scene, skier: Mesh): SkierSnowTrailEffect {
  try {
    const effect = createSkierSnowTrailEffect(scene, skier);
    let disabled = false;
    return {
      update(state: SnowTrailState): void {
        if (disabled) {
          return;
        }

        try {
          effect.update(state);
        } catch (error) {
          disabled = true;
          console.warn("Snow trail effect disabled after runtime update failure.", error);
        }
      }
    };
  } catch (error) {
    console.warn("Snow trail effect disabled after initialization failure.", error);
    return {
      update(): void {
        // Graceful fallback: keep gameplay rendering even if particles cannot initialize.
      }
    };
  }
}

function createSkierSnowTrailEffect(scene: Scene, skier: Mesh): SkierSnowTrailEffect {
  const particleTexture = new DynamicTexture("skier-snow-trail-tex", {
    width: 64,
    height: 64
  }, scene, true);
  particleTexture.hasAlpha = true;
  const context = particleTexture.getContext() as unknown as CanvasRenderingContext2D;
  if (!context) {
    throw new Error("DynamicTexture 2D context is unavailable");
  }
  const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255,255,255,0.96)");
  gradient.addColorStop(0.48, "rgba(237,244,250,0.78)");
  gradient.addColorStop(1, "rgba(237,244,250,0)");
  context.clearRect(0, 0, 64, 64);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  particleTexture.update();

  const emitterAnchor = MeshBuilder.CreateBox("skier-snow-trail-anchor", {
    width: 0.01,
    height: 0.01,
    depth: 0.01
  }, scene);
  emitterAnchor.parent = skier;
  emitterAnchor.position = new Vector3(0, -1.1, 0.12);
  emitterAnchor.isVisible = false;
  emitterAnchor.isPickable = false;

  const skidMarkMaterial = new StandardMaterial("skier-skid-mark-mat", scene);
  skidMarkMaterial.diffuseColor = new Color3(0.05, 0.05, 0.05);
  skidMarkMaterial.emissiveColor = new Color3(0.02, 0.02, 0.02);
  skidMarkMaterial.specularColor = new Color3(0, 0, 0);
  skidMarkMaterial.alpha = 0;

  const leftSkidMark = MeshBuilder.CreateGround("skier-skid-mark-left", {
    width: 0.18,
    height: 1.18
  }, scene);
  leftSkidMark.parent = skier;
  leftSkidMark.position = new Vector3(-0.2, -1.155, 0.02);
  leftSkidMark.material = skidMarkMaterial;
  leftSkidMark.isPickable = false;
  leftSkidMark.renderingGroupId = 1;

  const rightSkidMark = MeshBuilder.CreateGround("skier-skid-mark-right", {
    width: 0.18,
    height: 1.18
  }, scene);
  rightSkidMark.parent = skier;
  rightSkidMark.position = new Vector3(0.2, -1.155, 0.02);
  rightSkidMark.material = skidMarkMaterial;
  rightSkidMark.isPickable = false;
  rightSkidMark.renderingGroupId = 1;

  const system = new ParticleSystem("skier-snow-trail", 320, scene);
  system.particleTexture = particleTexture;
  system.emitter = emitterAnchor;
  system.minEmitBox = new Vector3(-0.26, -0.03, -0.08);
  system.maxEmitBox = new Vector3(0.26, 0.04, 0.16);
  system.color1 = new Color4(0.98, 0.99, 1, 0.72);
  system.color2 = new Color4(0.92, 0.97, 1, 0.38);
  system.colorDead = new Color4(0.92, 0.97, 1, 0);
  system.gravity = new Vector3(0, -2.2, 0);
  system.emitRate = 0;
  system.minSize = 0.055;
  system.maxSize = 0.11;
  system.minLifeTime = 0.08;
  system.maxLifeTime = 0.16;
  system.minEmitPower = 0.08;
  system.maxEmitPower = 0.2;
  system.minAngularSpeed = -2.4;
  system.maxAngularSpeed = 2.4;
  system.updateSpeed = 1 / 60;
  system.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  system.direction1 = new Vector3(-0.12, 0.14, -0.6);
  system.direction2 = new Vector3(0.12, 0.22, -0.38);
  system.renderingGroupId = 1;
  system.start();

  const idleState = createInactiveSnowTrailState();

  return {
    update(state: SnowTrailState): void {
      const resolved = state.active ? state : idleState;
      const drift = resolved.driftX;
      const lift = resolved.liftY;

      system.emitRate = resolved.emissionRate;
      system.minSize = resolved.minSize;
      system.maxSize = resolved.maxSize;
      system.minLifeTime = resolved.minLifeTime;
      system.maxLifeTime = resolved.maxLifeTime;
      system.minEmitPower = resolved.minEmitPower;
      system.maxEmitPower = resolved.maxEmitPower;
      system.direction1 = new Vector3(drift - 0.14, lift * 0.75, -0.62);
      system.direction2 = new Vector3(drift + 0.14, lift + 0.08, -0.36);
      const skidAlpha = resolved.brakeBlend * 0.42;
      skidMarkMaterial.alpha = skidAlpha;
      leftSkidMark.isVisible = skidAlpha > 0.01;
      rightSkidMark.isVisible = skidAlpha > 0.01;
    }
  };
}

function createDynamicBackdrop(scene: Scene, camera: ArcRotateCamera): void {
  const backdrop = MeshBuilder.CreatePlane("cloud-sea-backdrop", {
    width: 520,
    height: 300
  }, scene);
  backdrop.parent = camera;
  backdrop.position = new Vector3(0, 26, 220);
  backdrop.isPickable = false;
  backdrop.infiniteDistance = true;
  backdrop.alwaysSelectAsActiveMesh = true;
  backdrop.renderingGroupId = 0;

  const backdropMaterial = new ShaderMaterial("cloud-sea-material", scene, {
    vertex: "cloudSeaBackdrop",
    fragment: "cloudSeaBackdrop"
  }, {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "iTime", "iResolution"]
  });
  backdropMaterial.backFaceCulling = false;
  backdropMaterial.disableDepthWrite = true;
  backdropMaterial.setVector3("iResolution", new Vector3(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight(), 1));
  backdrop.material = backdropMaterial;

  scene.onBeforeRenderObservable.add(() => {
    backdropMaterial.setFloat("iTime", performance.now() * 0.001);
    backdropMaterial.setVector3(
      "iResolution",
      new Vector3(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight(), 1)
    );
  });
}

function createTurnMarkerSigns(scene: Scene, course: TrackCourse): void {
  for (const turn of course.turnMarkers) {
    const directionSign = turn.direction === "left" ? -1 : 1;
    const baseY = sampleHeight(course, turn.apexZ);
    const anchorX = turn.centerX + directionSign * (course.courseHalfWidth + 3.6);

    const post = MeshBuilder.CreateCylinder(`turn-marker-post-${turn.index}`, {
      height: 4.8,
      diameter: 0.18
    }, scene);
    post.position = new Vector3(anchorX, baseY + 2.4, turn.apexZ);

    const postMaterial = new StandardMaterial(`turn-marker-post-mat-${turn.index}`, scene);
    postMaterial.diffuseColor = turn.direction === "left"
      ? Color3.FromHexString("#1d5fd1")
      : Color3.FromHexString("#d85b2a");
    postMaterial.emissiveColor = turn.direction === "left"
      ? Color3.FromHexString("#244f97")
      : Color3.FromHexString("#8f3d22");
    post.material = postMaterial;

    const sign = MeshBuilder.CreatePlane(`turn-marker-sign-${turn.index}`, {
      width: 3.1,
      height: 1.1
    }, scene);
    sign.position = new Vector3(anchorX, baseY + 4.9, turn.apexZ);
    sign.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const texture = new DynamicTexture(`turn-marker-tex-${turn.index}`, {
      width: 768,
      height: 272
    }, scene, true);
    texture.hasAlpha = true;
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    context.clearRect(0, 0, 768, 272);
    context.fillStyle = turn.direction === "left" ? "rgba(20, 61, 140, 0.92)" : "rgba(153, 72, 31, 0.92)";
    context.fillRect(0, 0, 768, 272);
    context.strokeStyle = "rgba(255,255,255,0.95)";
    context.lineWidth = 16;
    context.strokeRect(18, 18, 732, 236);
    context.fillStyle = "white";
    context.font = "bold 118px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(turn.label, 384, 136);
    texture.update();

    const signMaterial = new StandardMaterial(`turn-marker-sign-mat-${turn.index}`, scene);
    signMaterial.diffuseTexture = texture;
    signMaterial.emissiveTexture = texture;
    signMaterial.opacityTexture = texture;
    signMaterial.disableLighting = true;
    signMaterial.backFaceCulling = false;
    sign.material = signMaterial;
  }
}

function createTurnEntryArrowSigns(scene: Scene, course: TrackCourse): void {
  for (const turn of course.turnMarkers) {
    const entryHint = evaluateTurnEntryHint(turn, course.courseHalfWidth);
    const entryMidZ = turn.start - 58;
    const baseY = sampleHeight(course, entryMidZ);
    const edgeSign = entryHint.direction === "left" ? 1 : -1;
    const centerX = evaluateCourseCenterX(entryMidZ) + edgeSign * (course.courseHalfWidth + 3.2);

    const post = MeshBuilder.CreateCylinder(`turn-entry-arrow-post-${turn.index}`, {
      height: 5.8,
      diameter: 0.22
    }, scene);
    post.position = new Vector3(centerX, baseY + 2.9, entryMidZ);

    const postMaterial = new StandardMaterial(`turn-entry-arrow-post-mat-${turn.index}`, scene);
    postMaterial.diffuseColor = Color3.FromHexString("#143d8c");
    postMaterial.emissiveColor = Color3.FromHexString("#0d2552");
    post.material = postMaterial;

    const sign = MeshBuilder.CreatePlane(`turn-entry-arrow-sign-${turn.index}`, {
      width: 5.8,
      height: 2
    }, scene);
    sign.position = new Vector3(centerX, baseY + 5.45, entryMidZ);
    sign.billboardMode = Mesh.BILLBOARDMODE_ALL;
    sign.renderingGroupId = 1;

    const texture = new DynamicTexture(`turn-entry-arrow-tex-${turn.index}`, {
      width: 1024,
      height: 384
    }, scene, true);
    texture.hasAlpha = true;
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    context.clearRect(0, 0, 1024, 384);
    context.fillStyle = entryHint.direction === "left" ? "rgba(16, 48, 112, 0.94)" : "rgba(143, 61, 26, 0.94)";
    context.fillRect(0, 0, 1024, 384);
    context.strokeStyle = "rgba(255,255,255,0.96)";
    context.lineWidth = 20;
    context.strokeRect(20, 20, 984, 344);
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "bold 224px sans-serif";
    context.fillText(entryHint.arrowText, 512, 176);
    context.font = "bold 72px sans-serif";
    context.fillText(turn.label, 512, 306);
    texture.update();

    const signMaterial = new StandardMaterial(`turn-entry-arrow-sign-mat-${turn.index}`, scene);
    signMaterial.diffuseTexture = texture;
    signMaterial.emissiveTexture = texture;
    signMaterial.opacityTexture = texture;
    signMaterial.disableLighting = true;
    signMaterial.backFaceCulling = false;
    sign.material = signMaterial;
  }
}

function createStartMarker(scene: Scene, course: TrackCourse): void {
  const startZ = 18;
  const baseY = sampleHeight(course, startZ);
  const centerX = evaluateCourseCenterX(startZ);

  const leftPost = MeshBuilder.CreateCylinder("start-post-left", {
    height: 5.4,
    diameter: 0.24
  }, scene);
  leftPost.position = new Vector3(centerX - 4.6, baseY + 2.7, startZ);
  const leftPostMaterial = new StandardMaterial("start-post-left-mat", scene);
  leftPostMaterial.diffuseColor = Color3.FromHexString("#1d6cff");
  leftPost.material = leftPostMaterial;

  const rightPost = MeshBuilder.CreateCylinder("start-post-right", {
    height: 5.4,
    diameter: 0.24
  }, scene);
  rightPost.position = new Vector3(centerX + 4.6, baseY + 2.7, startZ);
  const rightPostMaterial = new StandardMaterial("start-post-right-mat", scene);
  rightPostMaterial.diffuseColor = Color3.FromHexString("#ef562f");
  rightPost.material = rightPostMaterial;

  const banner = MeshBuilder.CreatePlane("start-banner", {
    width: 8.8,
    height: 1.5
  }, scene);
  banner.position = new Vector3(centerX, baseY + 4.9, startZ);

  const texture = new DynamicTexture("start-banner-tex", {
    width: 1024,
    height: 256
  }, scene, true);
  texture.hasAlpha = true;
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  context.clearRect(0, 0, 1024, 256);
  context.fillStyle = "rgba(10, 31, 68, 0.96)";
  context.fillRect(0, 0, 1024, 256);
  context.strokeStyle = "rgba(255,255,255,0.96)";
  context.lineWidth = 18;
  context.strokeRect(18, 18, 988, 220);
  context.fillStyle = "#ffffff";
  context.font = "bold 148px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("START", 512, 132);
  texture.update();

  const bannerMaterial = new StandardMaterial("start-banner-mat", scene);
  bannerMaterial.diffuseTexture = texture;
  bannerMaterial.emissiveTexture = texture;
  bannerMaterial.opacityTexture = texture;
  bannerMaterial.disableLighting = true;
  bannerMaterial.backFaceCulling = false;
  banner.material = bannerMaterial;

  const stripe = MeshBuilder.CreateGround("start-line-stripe", {
    width: 10.4,
    height: 1.4
  }, scene);
  stripe.position = new Vector3(centerX, baseY + 0.03, startZ - 1.2);
  stripe.rotation.x = 0;
  const stripeMaterial = new StandardMaterial("start-line-stripe-mat", scene);
  stripeMaterial.diffuseColor = Color3.FromHexString("#f8fbff");
  stripeMaterial.emissiveColor = Color3.FromHexString("#d9e8ff");
  stripe.material = stripeMaterial;
}

function createSkierAvatar(scene: Scene, materials: SkierMaterials): { root: Mesh; rig: SkierAvatarRig } {
  const root = MeshBuilder.CreateBox("skier-root", {
    width: 0.3,
    height: 0.3,
    depth: 0.3
  }, scene);
  root.isVisible = false;
  root.isPickable = false;

  const poseRoot = MeshBuilder.CreateBox("skier-pose-root", {
    width: 0.2,
    height: 0.2,
    depth: 0.2
  }, scene);
  poseRoot.parent = root;
  poseRoot.position.y = SKIER_BODY_ROOT_OFFSET_Y;
  poseRoot.isVisible = false;
  poseRoot.isPickable = false;

  const parts: PosePart[] = [];

  const pelvis = MeshBuilder.CreateBox("skier-pelvis", {
    width: 0.54,
    height: 0.22,
    depth: 0.26
  }, scene);
  pelvis.parent = poseRoot;
  pelvis.material = materials.trim;
  registerPose(parts, pelvis, [0, -0.08, 0.02], [0, -0.18, 0.08], [0.02, 0, 0], [0.08, 0, 0]);

  const torso = MeshBuilder.CreateBox("skier-torso", {
    width: 0.5,
    height: 0.72,
    depth: 0.28
  }, scene);
  torso.parent = poseRoot;
  torso.material = materials.suit;
  registerPose(parts, torso, [0, 0.32, 0.08], [0, 0.12, 0.22], [-0.24, 0, 0], [-0.54, 0, 0]);

  const chest = MeshBuilder.CreateBox("skier-chest", {
    width: 0.38,
    height: 0.2,
    depth: 0.3
  }, scene);
  chest.parent = poseRoot;
  chest.material = materials.trim;
  registerPose(parts, chest, [0, 0.48, 0.16], [0, 0.22, 0.31], [-0.18, 0, 0], [-0.42, 0, 0]);

  const neck = MeshBuilder.CreateCylinder("skier-neck", {
    height: 0.1,
    diameter: 0.12
  }, scene);
  neck.parent = poseRoot;
  neck.material = materials.skin;
  registerPose(parts, neck, [0, 0.74, 0.14], [0, 0.44, 0.28], [-0.12, 0, 0], [-0.28, 0, 0]);

  const head = MeshBuilder.CreateSphere("skier-head", {
    diameter: 0.34
  }, scene);
  head.parent = poseRoot;
  head.material = materials.skin;
  registerPose(parts, head, [0, 0.94, 0.17], [0, 0.63, 0.31], [-0.1, 0, 0], [-0.24, 0, 0]);

  const helmet = MeshBuilder.CreateSphere("skier-helmet", {
    diameter: 0.38
  }, scene);
  helmet.parent = poseRoot;
  helmet.scaling.y = 0.72;
  helmet.material = materials.trim;
  registerPose(parts, helmet, [0, 0.99, 0.16], [0, 0.67, 0.3], [-0.08, 0, 0], [-0.2, 0, 0]);

  const goggle = MeshBuilder.CreateBox("skier-goggle", {
    width: 0.26,
    height: 0.08,
    depth: 0.12
  }, scene);
  goggle.parent = poseRoot;
  goggle.material = materials.goggle;
  registerPose(parts, goggle, [0, 0.93, 0.29], [0, 0.62, 0.42], [-0.08, 0, 0], [-0.22, 0, 0]);

  for (const side of [-1, 1] as const) {
    createArm(poseRoot, scene, materials, parts, side);
    createLeg(poseRoot, scene, materials, parts, side);
  }

  const rig: SkierAvatarRig = {
    applyPose(tuck: number, glide = 0, carve = 0, turnBlend = 0, lateralLean = 0, pumpBlend = 0, brakeBlend = 0, edgeHold = 0, driftSlip = 0): void {
      const blend = clamp01(tuck);
      const glideBaseBlend = clamp01(glide) * 0.5;
      const brakeCrouchBlend = clamp01(brakeBlend) * 0.24;
      const poseBlend = clamp01(Math.max(glideBaseBlend, blend, glideBaseBlend + brakeCrouchBlend));
      const carveClamped = clampSigned(carve);
      const carveBlend = clamp01(Math.abs(carveClamped) * 0.95 + clamp01(turnBlend) * 0.45);
      const carveGripBlend = carveBlend * clamp01(0.3 + edgeHold * 0.85) * clamp01(1 - driftSlip * 0.78);
      const driftWashBlend = carveBlend * driftSlip;
      const lateralLeanClamped = clampSigned(lateralLean);
      const lateralLeanBlend = clamp01(Math.abs(lateralLeanClamped));
      const polePlantBlend = clamp01(pumpBlend);
      const brakePoseBlend = clamp01(brakeBlend * 1.35);
      for (const part of parts) {
        const position = Vector3.Lerp(part.basePosition, part.tuckPosition, poseBlend);
        const rotation = Vector3.Lerp(part.baseRotation, part.tuckRotation, poseBlend);
        applyForwardCrouchAdjustments(part.mesh, position, rotation, poseBlend, brakePoseBlend);
        applyCarveAdjustments(part.mesh, position, rotation, carveClamped, carveGripBlend, driftWashBlend);
        applyLateralLeanAdjustments(part.mesh, position, rotation, lateralLeanClamped, lateralLeanBlend);
        applyPumpAdjustments(part.mesh, position, rotation, polePlantBlend);
        applyBrakeAdjustments(part.mesh, position, rotation, brakePoseBlend);
        part.mesh.position.copyFrom(position);
        part.mesh.rotation.copyFrom(rotation);
      }
    }
  };
  rig.applyPose(0);

  return { root, rig };
}

function createArm(root: Mesh, scene: Scene, materials: SkierMaterials, parts: PosePart[], side: -1 | 1): void {
  const shoulder = MeshBuilder.CreateSphere(`skier-shoulder-${side}`, {
    diameter: 0.13
  }, scene);
  shoulder.parent = root;
  shoulder.material = materials.trim;
  registerPose(
    parts,
    shoulder,
    [side * 0.31, 0.63, 0.08],
    [side * 0.21, 0.43, 0.22],
    [0, 0, 0],
    [0.08, 0, side * -0.18]
  );

  const upperArm = MeshBuilder.CreateBox(`skier-upper-arm-${side}`, {
    width: 0.13,
    height: 0.38,
    depth: 0.13
  }, scene);
  upperArm.parent = root;
  upperArm.material = materials.suit;
  registerPose(
    parts,
    upperArm,
    [side * 0.4, 0.47, 0.16],
    [side * 0.25, 0.36, 0.28],
    [-0.32, 0, side * 0.58],
    [-1.1, 0, side * 0.92]
  );

  const elbow = MeshBuilder.CreateSphere(`skier-elbow-${side}`, {
    diameter: 0.11
  }, scene);
  elbow.parent = root;
  elbow.material = materials.trim;
  registerPose(
    parts,
    elbow,
    [side * 0.47, 0.34, 0.23],
    [side * 0.19, 0.29, 0.4],
    [0, 0, 0],
    [-0.1, 0, side * 0.08]
  );

  const lowerArm = MeshBuilder.CreateBox(`skier-lower-arm-${side}`, {
    width: 0.11,
    height: 0.34,
    depth: 0.11
  }, scene);
  lowerArm.parent = root;
  lowerArm.material = materials.suit;
  registerPose(
    parts,
    lowerArm,
    [side * 0.47, 0.19, 0.34],
    [side * 0.16, 0.25, 0.48],
    [-0.92, 0, side * 0.18],
    [-1.54, 0, side * 0.16]
  );

  const hand = MeshBuilder.CreateSphere(`skier-hand-${side}`, {
    diameter: 0.1
  }, scene);
  hand.parent = root;
  hand.material = materials.skin;
  registerPose(
    parts,
    hand,
    [side * 0.41, 0.06, 0.49],
    [side * 0.14, 0.22, 0.52],
    [0, 0, 0],
    [0, 0, 0]
  );

  const pole = MeshBuilder.CreateCylinder(`skier-pole-${side}`, {
    height: 1.34,
    diameter: 0.035
  }, scene);
  pole.parent = root;
  pole.material = materials.pole;
  registerPose(
    parts,
    pole,
    [side * 0.46, -0.18, 0.49],
    [side * 0.13, 0.24, 0.06],
    [0.08, 0, side * 0.08],
    [1.34, 0, side * 0.22]
  );

  const basket = MeshBuilder.CreateCylinder(`skier-pole-basket-${side}`, {
    height: 0.02,
    diameterTop: 0.1,
    diameterBottom: 0.1
  }, scene);
  basket.parent = root;
  basket.material = materials.trim;
  registerPose(
    parts,
    basket,
    [side * 0.54, -0.77, 0.56],
    [side * 0.07, 0.58, -0.53],
    [0, 0, 0],
    [1.34, 0, side * 0.22]
  );
}

function createLeg(root: Mesh, scene: Scene, materials: SkierMaterials, parts: PosePart[], side: -1 | 1): void {
  const hip = MeshBuilder.CreateSphere(`skier-hip-${side}`, {
    diameter: 0.13
  }, scene);
  hip.parent = root;
  hip.material = materials.trim;
  registerPose(
    parts,
    hip,
    [side * 0.18, -0.14, 0.04],
    [side * 0.12, -0.24, 0.12],
    [0, 0, 0],
    [0, 0, 0]
  );

  const upperLeg = MeshBuilder.CreateBox(`skier-upper-leg-${side}`, {
    width: 0.15,
    height: 0.44,
    depth: 0.15
  }, scene);
  upperLeg.parent = root;
  upperLeg.material = materials.suit;
  registerPose(
    parts,
    upperLeg,
    [side * 0.18, -0.41, 0.17],
    [side * 0.11, -0.5, 0.28],
    [0.54, 0, side * 0.03],
    [0.98, 0, side * 0.02]
  );

  const knee = MeshBuilder.CreateSphere(`skier-knee-${side}`, {
    diameter: 0.12
  }, scene);
  knee.parent = root;
  knee.material = materials.trim;
  registerPose(
    parts,
    knee,
    [side * 0.16, -0.63, 0.28],
    [side * 0.08, -0.73, 0.38],
    [0, 0, 0],
    [0, 0, 0]
  );

  const lowerLeg = MeshBuilder.CreateBox(`skier-lower-leg-${side}`, {
    width: 0.13,
    height: 0.42,
    depth: 0.13
  }, scene);
  lowerLeg.parent = root;
  lowerLeg.material = materials.trim;
  registerPose(
    parts,
    lowerLeg,
    [side * 0.16, -0.85, 0.18],
    [side * 0.08, -0.92, 0.28],
    [-0.12, 0, side * 0.02],
    [-0.42, 0, side * 0.01]
  );

  const ankle = MeshBuilder.CreateSphere(`skier-ankle-${side}`, {
    diameter: 0.11
  }, scene);
  ankle.parent = root;
  ankle.material = materials.trim;
  registerPose(
    parts,
    ankle,
    [side * 0.16, -1.03, 0.11],
    [side * 0.09, -1.08, 0.19],
    [0, 0, 0],
    [0, 0, 0]
  );

  const boot = MeshBuilder.CreateBox(`skier-boot-${side}`, {
    width: 0.17,
    height: 0.11,
    depth: 0.36
  }, scene);
  boot.parent = root;
  boot.material = materials.goggle;
  registerPose(
    parts,
    boot,
    [side * 0.16, -1.08, 0.17],
    [side * 0.09, -1.1, 0.23],
    [0.08, 0, 0],
    [0.14, 0, 0]
  );

  const ski = MeshBuilder.CreateBox(`skier-ski-${side}`, {
    width: 0.14,
    height: 0.05,
    depth: 1.52
  }, scene);
  ski.parent = root;
  ski.material = materials.ski;
  registerPose(
    parts,
    ski,
    [side * 0.2, -1.14, 0.26],
    [side * 0.11, -1.15, 0.29],
    [0.03, 0, 0],
    [0.04, 0, 0]
  );

  const skiTip = MeshBuilder.CreateBox(`skier-ski-tip-${side}`, {
    width: 0.14,
    height: 0.08,
    depth: 0.18
  }, scene);
  skiTip.parent = root;
  skiTip.material = materials.ski;
  registerPose(
    parts,
    skiTip,
    [side * 0.2, -1.1, 0.99],
    [side * 0.11, -1.11, 1.02],
    [-0.42, 0, 0],
    [-0.38, 0, 0]
  );
}

function registerPose(
  parts: PosePart[],
  mesh: Mesh,
  basePosition: [number, number, number],
  tuckPosition: [number, number, number],
  baseRotation: [number, number, number],
  tuckRotation: [number, number, number]
): void {
  parts.push({
    mesh,
    basePosition: new Vector3(...basePosition),
    tuckPosition: new Vector3(...tuckPosition),
    baseRotation: new Vector3(...baseRotation),
    tuckRotation: new Vector3(...tuckRotation)
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function applyCarveAdjustments(
  mesh: Mesh,
  position: Vector3,
  rotation: Vector3,
  carve: number,
  carveBlend: number,
  driftWashBlend: number
): void {
  if (carveBlend <= 0.001) {
    return;
  }

  const side = detectPartSide(mesh.name);
  const carveSign = Math.sign(carve) || 1;
  const inside = side !== 0 && side === carveSign;
  const outside = side !== 0 && side === -carveSign;
  const carveAbs = Math.abs(carve);
  const stableEdgeBlend = clamp01(carveBlend * (1 - driftWashBlend * 0.55));
  const washedEdgeBlend = clamp01(driftWashBlend);

  if (mesh.name === "skier-pelvis") {
    position.x += carve * 0.05 * stableEdgeBlend;
    position.y -= stableEdgeBlend * 0.04;
    rotation.y += carve * 0.16 * stableEdgeBlend;
    rotation.z += carve * 0.1 * stableEdgeBlend;
    rotation.y -= carve * 0.08 * washedEdgeBlend;
    return;
  }

  if (mesh.name === "skier-torso" || mesh.name === "skier-chest") {
    position.x += carve * 0.06 * stableEdgeBlend;
    rotation.y += carve * 0.08 * stableEdgeBlend;
    rotation.z += carve * 0.16 * stableEdgeBlend;
    rotation.x -= stableEdgeBlend * 0.05;
    rotation.y -= carve * 0.09 * washedEdgeBlend;
    return;
  }

  if (mesh.name === "skier-neck" || mesh.name === "skier-head" || mesh.name === "skier-helmet" || mesh.name === "skier-goggle") {
    position.x += carve * 0.04 * stableEdgeBlend;
    rotation.y += carve * 0.04 * stableEdgeBlend;
    rotation.z += carve * 0.1 * stableEdgeBlend;
    return;
  }

  if (mesh.name.includes("shoulder") || mesh.name.includes("upper-arm") || mesh.name.includes("elbow") || mesh.name.includes("lower-arm") || mesh.name.includes("hand")) {
    if (inside) {
      position.x += carve * 0.02 * carveBlend;
      position.y += 0.03 * carveBlend;
      rotation.y += carve * 0.08 * carveBlend;
      rotation.z += carve * 0.12 * carveBlend;
    } else if (outside) {
      position.x -= carve * 0.015 * carveBlend;
      position.z -= 0.04 * carveBlend;
      rotation.y -= carve * 0.06 * carveBlend;
      rotation.z += carve * 0.05 * carveBlend;
    }
    return;
  }

  if (mesh.name.includes("pole") || mesh.name.includes("basket")) {
    if (inside) {
      position.x += carve * 0.03 * carveBlend;
      position.y += 0.06 * carveBlend;
      rotation.z += carve * 0.14 * carveBlend;
    } else if (outside) {
      position.x -= carve * 0.02 * carveBlend;
      position.z -= 0.06 * carveBlend;
      rotation.z += carve * 0.08 * carveBlend;
      rotation.x -= 0.04 * carveBlend;
    }
    return;
  }

  if (mesh.name.includes("hip")) {
    position.x += carve * 0.05 * carveBlend;
    position.z -= carveAbs * 0.015 * carveBlend;
    position.y += inside ? 0.015 * carveBlend : -0.025 * carveBlend;
    rotation.y += carve * 0.08 * carveBlend;
    rotation.z += carve * (inside ? 0.12 : 0.08) * carveBlend;
    return;
  }

  if (mesh.name.includes("upper-leg")) {
    if (inside) {
      position.x += carve * 0.09 * stableEdgeBlend;
      position.y += 0.12 * stableEdgeBlend;
      position.z -= 0.06 * stableEdgeBlend;
      rotation.x += 0.48 * stableEdgeBlend;
      rotation.y += carve * 0.14 * stableEdgeBlend;
      rotation.z += carve * 0.34 * stableEdgeBlend;
    } else if (outside) {
      position.x += carve * 0.085 * stableEdgeBlend;
      position.y -= 0.08 * stableEdgeBlend;
      position.z += 0.05 * stableEdgeBlend;
      rotation.x -= 0.22 * stableEdgeBlend;
      rotation.y += carve * 0.18 * stableEdgeBlend;
      rotation.z += carve * 0.28 * stableEdgeBlend;
    }
    return;
  }

  if (mesh.name.includes("knee")) {
    if (inside) {
      position.x += carve * 0.12 * stableEdgeBlend;
      position.y += 0.16 * stableEdgeBlend;
      position.z -= 0.05 * stableEdgeBlend;
    } else if (outside) {
      position.x += carve * 0.13 * stableEdgeBlend;
      position.y -= 0.07 * stableEdgeBlend;
      position.z += 0.06 * stableEdgeBlend;
    }
    return;
  }

  if (mesh.name.includes("lower-leg")) {
    if (inside) {
      position.x += carve * 0.12 * stableEdgeBlend;
      position.y += 0.16 * stableEdgeBlend;
      position.z -= 0.08 * stableEdgeBlend;
      rotation.x -= 0.44 * stableEdgeBlend;
      rotation.y += carve * 0.12 * stableEdgeBlend;
      rotation.z += carve * (inside ? 0.52 : 0.42) * stableEdgeBlend;
    } else if (outside) {
      position.x += carve * 0.13 * stableEdgeBlend;
      position.y -= 0.06 * stableEdgeBlend;
      position.z += 0.08 * stableEdgeBlend;
      rotation.x += 0.22 * stableEdgeBlend;
      rotation.y += carve * 0.16 * stableEdgeBlend;
      rotation.z += carve * (inside ? 0.52 : 0.42) * stableEdgeBlend;
    }
    return;
  }

  if (mesh.name.includes("ankle") || mesh.name.includes("boot")) {
    if (inside) {
      position.x += carve * 0.14 * stableEdgeBlend;
      position.y += 0.04 * stableEdgeBlend;
      position.z -= 0.04 * stableEdgeBlend;
      rotation.y += carve * 0.12 * stableEdgeBlend;
      rotation.z += carve * (inside ? 0.32 : 0.24) * stableEdgeBlend;
    } else if (outside) {
      position.x += carve * 0.14 * stableEdgeBlend;
      position.y -= 0.03 * stableEdgeBlend;
      position.z += 0.04 * stableEdgeBlend;
      rotation.y += carve * 0.18 * stableEdgeBlend;
      rotation.z += carve * (inside ? 0.32 : 0.24) * stableEdgeBlend;
    }
    return;
  }

  if (mesh.name.includes("ski-tip") || mesh.name.includes("ski-")) {
    const edgeTilt = inside ? 0.42 : 0.34;
    position.x += carve * 0.17 * stableEdgeBlend;
    position.z += (outside ? 0.04 : -0.015) * stableEdgeBlend;
    rotation.z += carve * edgeTilt * stableEdgeBlend;
    rotation.z -= carve * 0.14 * washedEdgeBlend;
    rotation.y += carve * (inside ? 0.06 : 0.1) * stableEdgeBlend;
    rotation.y -= carve * 0.08 * washedEdgeBlend;
    if (mesh.name.includes("ski-")) {
      position.y += inside ? -0.045 * stableEdgeBlend : -0.03 * stableEdgeBlend;
      position.y += 0.02 * washedEdgeBlend;
    }
    if (mesh.name.includes("ski-tip")) {
      position.z += carveAbs * 0.03 * stableEdgeBlend;
    }
  }
}

function applyPumpAdjustments(
  mesh: Mesh,
  position: Vector3,
  rotation: Vector3,
  pumpBlend: number
): void {
  if (pumpBlend <= 0.001) {
    return;
  }

  if (mesh.name === "skier-pelvis") {
    position.y -= 0.03 * pumpBlend;
    rotation.x += 0.05 * pumpBlend;
    return;
  }

  if (mesh.name === "skier-torso" || mesh.name === "skier-chest") {
    position.y -= 0.04 * pumpBlend;
    position.z -= 0.03 * pumpBlend;
    rotation.x += 0.12 * pumpBlend;
    return;
  }

  if (mesh.name.includes("shoulder")) {
    position.y -= 0.03 * pumpBlend;
    position.z -= 0.05 * pumpBlend;
    rotation.x += 0.1 * pumpBlend;
    return;
  }

  if (mesh.name.includes("upper-arm")) {
    position.y -= 0.05 * pumpBlend;
    position.z -= 0.08 * pumpBlend;
    rotation.x += 0.46 * pumpBlend;
    return;
  }

  if (mesh.name.includes("elbow")) {
    position.y -= 0.07 * pumpBlend;
    position.z -= 0.1 * pumpBlend;
    return;
  }

  if (mesh.name.includes("lower-arm")) {
    position.y -= 0.09 * pumpBlend;
    position.z -= 0.14 * pumpBlend;
    rotation.x += 0.62 * pumpBlend;
    return;
  }

  if (mesh.name.includes("hand")) {
    position.y -= 0.14 * pumpBlend;
    position.z -= 0.2 * pumpBlend;
    return;
  }

  if (mesh.name.includes("pole-basket")) {
    position.y -= 0.24 * pumpBlend;
    position.z -= 0.26 * pumpBlend;
    rotation.x += 0.38 * pumpBlend;
    return;
  }

  if (mesh.name.includes("pole")) {
    position.y -= 0.18 * pumpBlend;
    position.z -= 0.24 * pumpBlend;
    rotation.x += 0.34 * pumpBlend;
  }
}

function applyForwardCrouchAdjustments(
  mesh: Mesh,
  position: Vector3,
  rotation: Vector3,
  poseBlend: number,
  brakeBlend: number
): void {
  const forwardLeanBlend = clamp01(poseBlend * 0.8 + brakeBlend * 0.35);
  if (forwardLeanBlend <= 0.001) {
    return;
  }

  if (mesh.name === "skier-pelvis") {
    position.z += forwardLeanBlend * 0.025;
    rotation.x -= forwardLeanBlend * 0.05;
    return;
  }

  if (mesh.name === "skier-torso" || mesh.name === "skier-chest") {
    position.z += forwardLeanBlend * 0.06;
    position.y -= forwardLeanBlend * 0.02;
    rotation.x -= forwardLeanBlend * 0.12;
    return;
  }

  if (mesh.name === "skier-neck" || mesh.name === "skier-head" || mesh.name === "skier-helmet" || mesh.name === "skier-goggle") {
    position.z += forwardLeanBlend * 0.05;
    rotation.x -= forwardLeanBlend * 0.08;
    return;
  }

  if (mesh.name.includes("shoulder") || mesh.name.includes("upper-arm") || mesh.name.includes("elbow") || mesh.name.includes("lower-arm") || mesh.name.includes("hand")) {
    position.z += forwardLeanBlend * 0.04;
    rotation.x -= forwardLeanBlend * 0.07;
    return;
  }
}

function applyLateralLeanAdjustments(
  mesh: Mesh,
  position: Vector3,
  rotation: Vector3,
  lateralLean: number,
  lateralLeanBlend: number
): void {
  if (lateralLeanBlend <= 0.001) {
    return;
  }

  const side = detectPartSide(mesh.name);

  if (mesh.name === "skier-pelvis") {
    position.x += lateralLean * 0.04 * lateralLeanBlend;
    rotation.z += lateralLean * 0.18 * lateralLeanBlend;
    return;
  }

  if (mesh.name === "skier-torso" || mesh.name === "skier-chest") {
    position.x += lateralLean * 0.08 * lateralLeanBlend;
    rotation.z += lateralLean * 0.3490658503988659 * lateralLeanBlend;
    return;
  }

  if (mesh.name === "skier-neck" || mesh.name === "skier-head" || mesh.name === "skier-helmet" || mesh.name === "skier-goggle") {
    position.x += lateralLean * 0.06 * lateralLeanBlend;
    rotation.z += lateralLean * 0.3490658503988659 * lateralLeanBlend;
    return;
  }

  if (mesh.name.includes("shoulder") || mesh.name.includes("upper-arm") || mesh.name.includes("elbow") || mesh.name.includes("lower-arm") || mesh.name.includes("hand")) {
    position.x += lateralLean * 0.05 * lateralLeanBlend;
    rotation.z += lateralLean * 0.26 * lateralLeanBlend;
    return;
  }

  if (mesh.name.includes("pole") || mesh.name.includes("basket")) {
    position.x += lateralLean * 0.04 * lateralLeanBlend;
    rotation.z += lateralLean * 0.18 * lateralLeanBlend;
    return;
  }

  if (mesh.name.includes("hip")) {
    position.x += lateralLean * 0.03 * lateralLeanBlend;
    rotation.z += lateralLean * 0.16 * lateralLeanBlend;
    return;
  }

  if (mesh.name.includes("upper-leg")) {
    position.x += lateralLean * 0.03 * lateralLeanBlend;
    rotation.z += lateralLean * 0.14 * lateralLeanBlend;
    return;
  }

  if (mesh.name.includes("knee")) {
    position.x += lateralLean * 0.02 * lateralLeanBlend;
    position.y += side === Math.sign(lateralLean) ? 0.04 * lateralLeanBlend : -0.02 * lateralLeanBlend;
    return;
  }

  if (mesh.name.includes("lower-leg")) {
    position.x += lateralLean * 0.02 * lateralLeanBlend;
    rotation.z += lateralLean * 0.1 * lateralLeanBlend;
    return;
  }
}

function applyBrakeAdjustments(
  mesh: Mesh,
  position: Vector3,
  rotation: Vector3,
  brakeBlend: number
): void {
  if (brakeBlend <= 0.001) {
    return;
  }

  const side = detectPartSide(mesh.name);

  if (mesh.name === "skier-pelvis") {
    position.y -= 0.08 * brakeBlend;
    position.z -= 0.04 * brakeBlend;
    rotation.x += 0.08 * brakeBlend;
    return;
  }

  if (mesh.name === "skier-torso" || mesh.name === "skier-chest") {
    position.y -= 0.05 * brakeBlend;
    position.z += 0.02 * brakeBlend;
    rotation.x += 0.18 * brakeBlend;
    return;
  }

  if (mesh.name === "skier-neck" || mesh.name === "skier-head" || mesh.name === "skier-helmet" || mesh.name === "skier-goggle") {
    position.y -= 0.03 * brakeBlend;
    rotation.x += 0.08 * brakeBlend;
    return;
  }

  if (mesh.name.includes("shoulder")) {
    position.x += side * 0.04 * brakeBlend;
    position.y -= 0.03 * brakeBlend;
    rotation.z += side * 0.12 * brakeBlend;
    return;
  }

  if (mesh.name.includes("upper-arm")) {
    position.x += side * 0.08 * brakeBlend;
    position.y -= 0.08 * brakeBlend;
    rotation.x += 0.42 * brakeBlend;
    rotation.z += side * 0.58 * brakeBlend;
    return;
  }

  if (mesh.name.includes("elbow")) {
    position.x += side * 0.12 * brakeBlend;
    position.y -= 0.1 * brakeBlend;
    return;
  }

  if (mesh.name.includes("lower-arm")) {
    position.x += side * 0.14 * brakeBlend;
    position.y -= 0.14 * brakeBlend;
    rotation.x += 0.5 * brakeBlend;
    rotation.z += side * 0.24 * brakeBlend;
    return;
  }

  if (mesh.name.includes("hand")) {
    position.x += side * 0.18 * brakeBlend;
    position.y -= 0.18 * brakeBlend;
    return;
  }

  if (mesh.name.includes("pole-basket")) {
    position.x += side * 0.2 * brakeBlend;
    position.y -= 0.22 * brakeBlend;
    rotation.x += 0.22 * brakeBlend;
    return;
  }

  if (mesh.name.includes("pole")) {
    position.x += side * 0.16 * brakeBlend;
    position.y -= 0.18 * brakeBlend;
    rotation.x += 0.18 * brakeBlend;
    rotation.z += side * 0.12 * brakeBlend;
    return;
  }

  if (mesh.name.includes("hip")) {
    position.x += side * 0.03 * brakeBlend;
    position.y -= 0.05 * brakeBlend;
    return;
  }

  if (mesh.name.includes("upper-leg")) {
    position.x += side * 0.02 * brakeBlend;
    position.y -= 0.08 * brakeBlend;
    rotation.x += 0.22 * brakeBlend;
    return;
  }

  if (mesh.name.includes("knee")) {
    position.x += side * -0.025 * brakeBlend;
    position.y -= 0.06 * brakeBlend;
    return;
  }

  if (mesh.name.includes("lower-leg")) {
    position.x += side * 0.03 * brakeBlend;
    position.y -= 0.03 * brakeBlend;
    rotation.x -= 0.16 * brakeBlend;
    return;
  }

  if (mesh.name.includes("ankle") || mesh.name.includes("boot")) {
    position.x += side * 0.04 * brakeBlend;
    rotation.y += side * 0.08 * brakeBlend;
    return;
  }

  if (mesh.name.includes("ski-tip")) {
    rotation.y += side * 0.34 * brakeBlend;
    position.x += side * 0.06 * brakeBlend;
    return;
  }

  if (mesh.name.includes("ski-")) {
    rotation.y += side * 0.22 * brakeBlend;
    position.x += side * 0.05 * brakeBlend;
    return;
  }
}

function detectPartSide(name: string): -1 | 0 | 1 {
  if (name.endsWith("--1")) {
    return -1;
  }

  if (name.endsWith("-1")) {
    return 1;
  }

  return 0;
}

function ensureCloudSeaShader(): void {
  if (Effect.ShadersStore.cloudSeaBackdropVertexShader && Effect.ShadersStore.cloudSeaBackdropFragmentShader) {
    return;
  }

  Effect.ShadersStore.cloudSeaBackdropVertexShader = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    varying vec2 vUV;

    void main(void) {
      vUV = uv;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;

  Effect.ShadersStore.cloudSeaBackdropFragmentShader = `
    precision highp float;

    varying vec2 vUV;
    uniform float iTime;
    uniform vec3 iResolution;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 x) {
      vec2 i = floor(x);
      vec2 f = fract(x);
      vec2 u = f * f * (3.0 - 2.0 * f);

      float a = hash(i + vec2(0.0, 0.0));
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.55;
      for (int i = 0; i < 6; i++) {
        value += amplitude * noise(p);
        p = p * 2.0 + vec2(12.3, 7.1);
        amplitude *= 0.58;
      }
      return value;
    }

    float layerDrift(float seed, float speed) {
      return sin(iTime * speed + seed) * 0.012 + cos(iTime * speed * 0.63 + seed * 1.7) * 0.008;
    }

    vec3 layerColor(float index) {
      if (index < 0.5) return vec3(0.94, 0.97, 1.0);
      if (index < 1.5) return vec3(0.83, 0.90, 0.98);
      if (index < 2.5) return vec3(0.68, 0.79, 0.91);
      return vec3(0.54, 0.68, 0.83);
    }

    float cloudBand(vec2 uv, float midlevel, float displacement, float speed, float seed) {
      float drift = layerDrift(seed, speed * 120.0);
      vec2 p = vec2(uv.x * 2.4 + seed + iTime * speed * 1.8, uv.y * 1.15 + seed * 0.37 + drift);
      float h = (fbm(p) - 0.5) * displacement;
      float edge = midlevel + h + drift * 0.7;
      return smoothstep(edge + 0.045, edge - 0.028, uv.y);
    }

    float ridgeBand(vec2 uv, float midlevel, float displacement, float speed, float seed, float sharpness) {
      float drift = layerDrift(seed + 5.0, speed * 90.0);
      vec2 p = vec2(uv.x * 2.9 + seed + iTime * speed * 1.55, uv.y * 0.9 + seed * 0.21 + drift * 0.45);
      float h = (fbm(p) - 0.5) * displacement;
      float edge = midlevel + h + drift * 0.35;
      float band = smoothstep(edge + 0.018, edge - 0.004, uv.y);
      return pow(band, sharpness);
    }

    float snowCapMask(vec2 uv, float ridgeMask, float seed, float cutoff, float softness) {
      float breakup = fbm(vec2(uv.x * 4.4 + seed, uv.y * 3.2 + seed * 0.73));
      float snowline = smoothstep(cutoff + softness, cutoff - softness, uv.y - breakup * 0.06);
      return ridgeMask * snowline;
    }

    void main(void) {
      vec2 uv = vUV;
      vec2 centered = uv * 2.0 - 1.0;

      vec3 skyTop = vec3(0.33, 0.50, 0.77);
      vec3 skyMid = vec3(0.62, 0.76, 0.92);
      vec3 skyLow = vec3(0.86, 0.92, 0.98);
      vec3 col = mix(skyLow, skyMid, smoothstep(0.02, 0.45, uv.y));
      col = mix(col, skyTop, smoothstep(0.45, 1.0, uv.y));
      col += vec3(0.016, 0.018, 0.022) * sin(iTime * 0.18 + centered.x * 1.8 + uv.y * 2.4);

      float glow = smoothstep(0.15, 0.8, uv.y) * (1.0 - smoothstep(0.58, 1.0, abs(centered.x) + uv.y * 0.12));
      col += vec3(0.08, 0.07, 0.05) * glow;

      float farRidge0 = ridgeBand(uv, 0.78, 0.08, 0.00045, 3.0, 1.95);
      float farRidge1 = ridgeBand(uv, 0.70, 0.11, 0.0007, 6.5, 2.0);
      float midRidge0 = ridgeBand(uv, 0.61, 0.18, 0.001, 9.5, 2.08);
      float mainPeak0 = ridgeBand(uv, 0.53, 0.28, 0.0012, 13.8, 2.25);
      float mainPeak1 = ridgeBand(uv, 0.47, 0.31, 0.0015, 18.2, 2.35);
      float nearRidge0 = ridgeBand(uv, 0.40, 0.22, 0.0018, 22.0, 2.45);
      float cloudLayer0 = cloudBand(uv, 0.20, 0.075, 0.0034, 26.0);
      float cloudLayer1 = cloudBand(uv, 0.145, 0.055, 0.0046, 31.0);

      float farSnow0 = snowCapMask(uv, farRidge0, 2.5, 0.73, 0.014);
      float farSnow1 = snowCapMask(uv, farRidge1, 5.4, 0.66, 0.016);
      float midSnow0 = snowCapMask(uv, midRidge0, 8.9, 0.58, 0.018);
      float mainSnow0 = snowCapMask(uv, mainPeak0, 12.8, 0.50, 0.022);
      float mainSnow1 = snowCapMask(uv, mainPeak1, 17.4, 0.43, 0.024);
      float nearSnow0 = snowCapMask(uv, nearRidge0, 21.3, 0.36, 0.02);

      col = mix(col, vec3(0.26, 0.36, 0.53), farRidge0 * 0.86);
      col = mix(col, vec3(0.22, 0.31, 0.47), farRidge1 * 0.9);
      col = mix(col, vec3(0.18, 0.26, 0.41), midRidge0 * 0.92);
      col = mix(col, vec3(0.14, 0.22, 0.36), mainPeak0 * 0.96);
      col = mix(col, vec3(0.11, 0.18, 0.30), mainPeak1 * 0.98);
      col = mix(col, vec3(0.20, 0.28, 0.42), nearRidge0 * 0.9);

      col = mix(col, vec3(0.83, 0.90, 0.97), farSnow0 * 0.26);
      col = mix(col, vec3(0.86, 0.93, 0.99), farSnow1 * 0.3);
      col = mix(col, vec3(0.90, 0.95, 1.0), midSnow0 * 0.34);
      col = mix(col, vec3(0.96, 0.98, 1.0), mainSnow0 * 0.42);
      col = mix(col, vec3(0.98, 0.99, 1.0), mainSnow1 * 0.46);
      col = mix(col, vec3(0.91, 0.96, 1.0), nearSnow0 * 0.32);

      float ridgeLight = smoothstep(0.48, 1.0, centered.x + uv.y * 0.22);
      col += vec3(0.03, 0.04, 0.05) * farRidge1 * ridgeLight * 0.35;
      col += vec3(0.04, 0.05, 0.06) * mainPeak0 * ridgeLight * 0.42;
      col += vec3(0.05, 0.06, 0.07) * mainPeak1 * ridgeLight * 0.52;

      col = mix(col, vec3(0.90, 0.95, 0.99), cloudLayer0 * 0.12);
      col = mix(col, vec3(0.97, 0.99, 1.0), cloudLayer1 * 0.24);

      float horizonMistCore = smoothstep(0.0, 0.16, uv.y) * (0.62 + 0.38 * fbm(vec2(uv.x * 1.6 - iTime * 0.005, uv.y * 3.0)));
      float horizonMistWide = smoothstep(0.0, 0.24, uv.y) * (0.50 + 0.50 * fbm(vec2(uv.x * 0.95 - iTime * 0.0025, uv.y * 1.7 + 8.0)));
      float mist = max(horizonMistCore * 0.44, horizonMistWide * 0.08);
      col = mix(col, vec3(0.96, 0.985, 1.0), mist * 0.12);

      float valleyLight = smoothstep(0.0, 0.28, uv.y) * (1.0 - smoothstep(0.24, 0.86, abs(centered.x)));
      col += vec3(0.015, 0.02, 0.025) * valleyLight;
      float movingHighlight = smoothstep(-0.35, 0.15, sin(iTime * 0.22 + uv.x * 5.8)) * smoothstep(0.18, 0.72, uv.y);
      col += vec3(0.01, 0.012, 0.016) * movingHighlight * (1.0 - abs(centered.x) * 0.6);

      float vignette = 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
      vignette = 0.76 + 0.24 * pow(clamp(vignette, 0.0, 1.0), 0.2);
      col *= vignette;

      gl_FragColor = vec4(col, 1.0);
    }
  `;
}

function createTrackRibbons(course: TrackCourse, width: number): Vector3[][] {
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (const sample of course.samples) {
    left.push(new Vector3(sample.centerX - width, sample.elevationY, sample.z));
    right.push(new Vector3(sample.centerX + width, sample.elevationY, sample.z));
  }
  return [left, right];
}

function createBoundaryRibbon(course: TrackCourse, side: -1 | 1, offset: number): Vector3[][] {
  const base: Vector3[] = [];
  const top: Vector3[] = [];
  for (const sample of course.samples) {
    const x = sample.centerX + side * offset;
    base.push(new Vector3(x, sample.elevationY - 0.1, sample.z));
    top.push(new Vector3(x, sample.elevationY + 1.1, sample.z));
  }
  return [base, top];
}

function createTrackWideRampRibbon(ramp: RampData): Vector3[][] {
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  const segments = 12;
  const startZ = ramp.centerZ - ramp.length * 0.5;
  const endZ = ramp.centerZ + ramp.length * 0.5;

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const z = startZ + (endZ - startZ) * t;
    const y = evaluateCourseElevation(z) + t * ramp.surfaceRise + 0.02;
    left.push(new Vector3(ramp.centerX - ramp.halfWidth, y, z));
    right.push(new Vector3(ramp.centerX + ramp.halfWidth, y, z));
  }

  return [left, right];
}

function sampleHeight(course: TrackCourse, z: number): number {
  const samples = course.samples;
  if (samples.length === 0) {
    return 0;
  }

  if (z <= samples[0].z) {
    return samples[0].elevationY;
  }

  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index];
    const previous = samples[index - 1];
    if (z <= current.z) {
      const t = (z - previous.z) / Math.max(1e-5, current.z - previous.z);
      return previous.elevationY + (current.elevationY - previous.elevationY) * t;
    }
  }

  return samples[samples.length - 1].elevationY;
}
