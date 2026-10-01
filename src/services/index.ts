import type { Backend } from "./backend";
import { tauriBackend } from "./tauriBackend";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let current: Backend | null = null;

/** Returns the active backend: native Tauri commands, or the browser demo (after `loadBackend()`). */
export function backend(): Backend {
  if (!current) {
    if (!isTauri) throw new Error("The browser backend isn't loaded yet: await loadBackend() first.");
    current = tauriBackend;
  }
  return current;
}

/** Loads the in-browser demo backend when not running in Tauri; it stays out of the desktop app's start-up code. */
export async function loadBackend(): Promise<void> {
  if (current || isTauri) return;
  const { createDemoBackend } = await import("./memoryBackend");
  current ??= createDemoBackend();
}

/** Test hook to inject a backend. */
export function setBackend(b: Backend) {
  current = b;
}
