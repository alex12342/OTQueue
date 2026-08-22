import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// Build-time identity, injected as compile-time constants via `define` below.
// Unset values (e.g. a bare `vite dev`) fall back to dev-safe placeholders.
const appVersion = process.env.VERSION || "dev";
const appGitSha = process.env.GIT_SHA || "dev";
const appBuildDate = process.env.BUILD_DATE || new Date().toISOString();

export default defineConfig({
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_GIT_SHA__: JSON.stringify(appGitSha),
    __APP_BUILD_DATE__: JSON.stringify(appBuildDate),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("node_modules/react-icons/") ||
            id.includes("node_modules/lucide-react/")
          ) {
            return "icons";
          }
          if (
            id.includes("node_modules/recharts/") ||
            id.includes("/d3-") ||
            id.includes("node_modules/d3/")
          ) {
            return "charts";
          }
          if (
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react";
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
