/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * Makes pdf.js's CMaps and standard font metrics available at /pdfjs/* (dev
 * server) and copies them into the build, so PDF import works offline.
 */
function pdfjsAssets(): Plugin {
  const src = resolve("node_modules/pdfjs-dist");
  const dirs = ["cmaps", "standard_fonts"];
  let outDir = "dist";
  return {
    name: "pdfjs-assets",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/pdfjs\/(cmaps|standard_fonts)\/([\w.-]+)$/.exec(req.url?.split("?")[0] ?? "");
        const file = m && join(src, m[1], m[2]);
        if (!file || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      for (const d of dirs) cpSync(join(src, d), join(outDir, "pdfjs", d), { recursive: true });
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react(), pdfjsAssets()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  // MathJax (PDF/Word math) is CommonJS: pre-bundle it at start-up, or the dev
  // server discovers it on the first export and reloads the page mid-export.
  optimizeDeps: {
    include: [
      "mathjax-full/js/mathjax.js",
      "mathjax-full/js/input/tex.js",
      "mathjax-full/js/output/svg.js",
      "mathjax-full/js/adaptors/liteAdaptor.js",
      "mathjax-full/js/handlers/html.js",
      "mathjax-full/js/input/tex/AllPackages.js",
    ],
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Tests that render the whole app can take several seconds when every file runs in parallel.
    testTimeout: 15_000,
  },
});
