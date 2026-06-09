import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const repoRoot = resolve(__dirname, "..");
const runtimeConfigPath = resolve(repoRoot, "config.txt");

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "skiiing-runtime-config",
      configureServer(server) {
        server.middlewares.use("/config.txt", async (_req, res) => {
          try {
            const source = await readFile(runtimeConfigPath, "utf8");
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(source);
          } catch {
            res.statusCode = 404;
            res.end("config.txt not found");
          }
        });
      },
      async generateBundle() {
        const source = await readFile(runtimeConfigPath, "utf8");
        this.emitFile({
          type: "asset",
          fileName: "config.txt",
          source
        });
      }
    }
  ],
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
      allow: [repoRoot]
    },
    host: "localhost",
    port: 5173,
    strictPort: true
  }
});
