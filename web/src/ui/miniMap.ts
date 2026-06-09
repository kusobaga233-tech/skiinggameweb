import type { HudState } from "../pose/types";
import type { TrackCourse } from "../game/trackCourse";

export class MiniMap {
  private readonly context: CanvasRenderingContext2D;
  private readonly trackPath: HTMLCanvasElement;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly minZ: number;
  private readonly maxZ: number;
  private readonly padding = 18;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly course: TrackCourse
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Mini map 2D context unavailable");
    }

    this.context = context;

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const sample of course.samples) {
      minX = Math.min(minX, sample.centerX);
      maxX = Math.max(maxX, sample.centerX);
      minZ = Math.min(minZ, sample.z);
      maxZ = Math.max(maxZ, sample.z);
    }

    this.minX = minX - course.courseHalfWidth * 1.35;
    this.maxX = maxX + course.courseHalfWidth * 1.35;
    this.minZ = minZ;
    this.maxZ = maxZ;
    this.trackPath = this.createTrackPathLayer();
  }

  render(state: HudState): void {
    const { width, height } = this.canvas;
    const ctx = this.context;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(this.trackPath, 0, 0, width, height);

    const player = this.project(state.playerX, state.playerZ);
    ctx.fillStyle = "#2f80ff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 8.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  private createTrackPathLayer(): HTMLCanvasElement {
    const layer = document.createElement("canvas");
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    const ctx = layer.getContext("2d");
    if (!ctx) {
      throw new Error("Mini map track layer context unavailable");
    }

    ctx.fillStyle = "#07101a";
    ctx.fillRect(0, 0, layer.width, layer.height);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, layer.width - 1, layer.height - 1);

    ctx.strokeStyle = "rgba(237, 244, 255, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.course.samples.forEach((sample, index) => {
      const point = this.project(sample.centerX, sample.z);
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    return layer;
  }

  private project(x: number, z: number): { x: number; y: number } {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const usableWidth = width - this.padding * 2;
    const usableHeight = height - this.padding * 2;
    const nx = (x - this.minX) / Math.max(1e-5, this.maxX - this.minX);
    const nz = (z - this.minZ) / Math.max(1e-5, this.maxZ - this.minZ);

    return {
      x: this.padding + nx * usableWidth,
      y: this.padding + (1 - nz) * usableHeight
    };
  }
}
