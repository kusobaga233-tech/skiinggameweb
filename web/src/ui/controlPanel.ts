import type { CameraDeviceOption } from "../camera/cameraManager";

export class ControlPanel {
  constructor(
    private readonly cameraSelect: HTMLSelectElement,
    private readonly cameraStatus: HTMLElement
  ) {}

  setDevices(devices: CameraDeviceOption[], selectedDeviceId: string | null): void {
    this.cameraSelect.innerHTML = "";
    for (const device of devices) {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label;
      option.selected = selectedDeviceId === device.deviceId;
      this.cameraSelect.append(option);
    }
  }

  getSelectedDeviceId(): string | null {
    return this.cameraSelect.value || null;
  }

  setStatus(message: string): void {
    this.cameraStatus.textContent = message;
  }
}
