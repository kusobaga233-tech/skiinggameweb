export interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

export class CameraManager {
  private readonly video: HTMLVideoElement;
  private stream: MediaStream | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async enumerate(): Promise<CameraDeviceOption[]> {
    this.ensureSupported();
    await this.ensurePermissionSeed();
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((item) => item.kind === "videoinput")
      .map((item, index) => ({
        deviceId: item.deviceId,
        label: item.label || `Camera ${index + 1}`
      }));
  }

  selectPreferred(devices: CameraDeviceOption[], preferredLabel = "USB 2.0 Camera"): CameraDeviceOption | null {
    const exact = devices.find((item) => item.label.toLowerCase().includes(preferredLabel.toLowerCase()));
    return exact ?? devices[0] ?? null;
  }

  async start(deviceId?: string): Promise<MediaStream> {
    this.ensureSupported();
    this.stop();

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId
        ? {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    return stream;
  }

  getActiveDeviceId(): string | null {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) {
      return null;
    }

    const settings = track.getSettings();
    return typeof settings.deviceId === "string" && settings.deviceId.length > 0 ? settings.deviceId : null;
  }

  getActiveLabel(): string | null {
    const track = this.stream?.getVideoTracks()[0];
    return track?.label || null;
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  private async ensurePermissionSeed(): Promise<void> {
    try {
      const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      for (const track of temp.getTracks()) {
        track.stop();
      }
    } catch {
      // Enumeration can still work partially without labels. Keep going.
    }
  }

  private ensureSupported(): void {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices.enumerateDevices) {
      throw new Error("This browser does not support camera access.");
    }
  }
}
