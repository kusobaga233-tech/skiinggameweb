export interface PickedMeshInfo {
  meshName: string;
  parentName: string;
  materialName: string;
}

export function getPauseToggleLabel(paused: boolean): string {
  return paused ? "Resume Game" : "Pause Game";
}

export function buildPauseInspectorText(paused: boolean, pickedMesh: PickedMeshInfo | null): string {
  if (!paused) {
    return "Pause the game to inspect scene meshes.";
  }

  if (!pickedMesh) {
    return "Paused. Click a mesh in the scene to inspect its resource name.";
  }

  return (
    `Mesh: ${pickedMesh.meshName}\n` +
    `Parent: ${pickedMesh.parentName}\n` +
    `Material: ${pickedMesh.materialName}`
  );
}
