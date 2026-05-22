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

      context.beginPath();
      context.moveTo(start.x * this.canvas.width, start.y * this.canvas.height);
      context.lineTo(end.x * this.canvas.width, end.y * this.canvas.height);
      context.stroke();
    }

    for (const landmark of frame.landmarks) {
      if (!landmark.visible) {
        continue;
      }

      context.beginPath();
      context.arc(
        landmark.x * this.canvas.width,
        landmark.y * this.canvas.height,
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
}
