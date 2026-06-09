import type { PoseOverlayFrame } from "../pose/types";

const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32]
];

export class PoseOverlay {
  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly video: HTMLVideoElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to create pose overlay canvas context");
    }
    this.context = context;
  }

  draw(frame: PoseOverlayFrame): void {
    this.syncSize();

    const { context } = this;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (frame.landmarks.length === 0) {
      return;
    }

    context.lineWidth = 3;
    context.strokeStyle = "rgba(115, 255, 196, 0.95)";
    context.fillStyle = "rgba(255, 196, 61, 0.95)";
    context.shadowColor = "rgba(0, 0, 0, 0.35)";
    context.shadowBlur = 4;

    for (const [startIndex, endIndex] of CONNECTIONS) {
      const start = frame.landmarks[startIndex];
      const end = frame.landmarks[endIndex];
      if (!start?.visible || !end?.visible) {
        continue;
      }

      const startPoint = this.mapLandmarkToCanvas(start.x, start.y);
      const endPoint = this.mapLandmarkToCanvas(end.x, end.y);
      context.beginPath();
      context.moveTo(startPoint.x, startPoint.y);
      context.lineTo(endPoint.x, endPoint.y);
      context.stroke();
    }

    for (const landmark of frame.landmarks) {
      if (!landmark.visible) {
        continue;
      }

      const point = this.mapLandmarkToCanvas(landmark.x, landmark.y);
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        4.5,
        0,
        Math.PI * 2
      );
      context.fill();
    }
  }

  clear(): void {
    this.syncSize();
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private syncSize(): void {
    const width = Math.max(1, Math.round(this.video.clientWidth));
    const height = Math.max(1, Math.round(this.video.clientHeight));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private mapLandmarkToCanvas(x: number, y: number): { x: number; y: number } {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const videoWidth = this.video.videoWidth || canvasWidth;
    const videoHeight = this.video.videoHeight || canvasHeight;
    const videoAspect = videoWidth / Math.max(videoHeight, 1);
    const canvasAspect = canvasWidth / Math.max(canvasHeight, 1);
    const scale = canvasAspect > videoAspect
      ? canvasWidth / Math.max(videoWidth, 1)
      : canvasHeight / Math.max(videoHeight, 1);
    const drawnWidth = videoWidth * scale;
    const drawnHeight = videoHeight * scale;
    const offsetX = (canvasWidth - drawnWidth) * 0.5;
    const offsetY = (canvasHeight - drawnHeight) * 0.5;

    return {
      x: offsetX + x * drawnWidth,
      y: offsetY + y * drawnHeight
    };
  }
}
