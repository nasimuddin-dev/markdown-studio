import { create } from "zustand";
import type { GitStatus } from "../types";

/** Compares paths from Git and from the file listing (separators, and case on Windows). */
export function pathKey(path: string): string {
  const p = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(p) || path.includes("\\") ? p.toLowerCase() : p;
}

interface GitState {
  status: GitStatus | null;
  /** Status letter per changed file, by `pathKey`. */
  files: Map<string, string>;
  /** Folders (by `pathKey`) that contain changed files. */
  changedDirs: Set<string>;
  set(status: GitStatus | null): void;
}

export const useGit = create<GitState>((set) => ({
  status: null,
  files: new Map(),
  changedDirs: new Set(),
  set(status) {
    const files = new Map<string, string>();
    const changedDirs = new Set<string>();
    for (const f of status?.files ?? []) {
      const key = pathKey(f.path);
      files.set(key, f.status);
      for (let i = key.lastIndexOf("/"); i > 0; i = key.lastIndexOf("/", i - 1)) {
        const dir = key.slice(0, i);
        if (changedDirs.has(dir)) break;
        changedDirs.add(dir);
      }
    }
    set({ status, files, changedDirs });
  },
}));
