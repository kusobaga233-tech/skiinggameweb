import "./styles.css";
import { CloudSeaRenderer } from "./runtime/cloudSeaRenderer";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

const canvas = requiredElement<HTMLCanvasElement>("cloud-sea-canvas");
const fallbackMessage = requiredElement<HTMLElement>("fallback-message");

try {
  const renderer = new CloudSeaRenderer(canvas);
  renderer.start();
} catch (error: unknown) {
  fallbackMessage.hidden = false;
  fallbackMessage.textContent = error instanceof Error ? error.message : String(error);
}
