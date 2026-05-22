import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        cloudSea: resolve(__dirname, "cloud-sea.html"),
        modelPreview: resolve(__dirname, "model-preview.html"),
        animationDebugger: resolve(__dirname, "animation-debugger.html")
      },
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (!normalized.includes("/node_modules/")) {
            return;
          }

          if (normalized.includes("/@mediapipe/tasks-vision/")) {
            return "mediapipe";
          }

          if (normalized.includes("/@babylonjs/core/")) {
            return "babylon";
          }

          return "vendor";
        }
      }
    }
  },
  server: {
    fs: {
      allow: [resolve(__dirname, "..")]
    },
    host: "127.0.0.1",
    port: 5173
  }
});
