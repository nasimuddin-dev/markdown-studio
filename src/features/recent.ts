import { create } from "zustand";
import { backend } from "../services";
import { describeError } from "../services/errors";
import { notify } from "../stores/uiStore";

/** Bumped whenever the recent list changes here, so lists that show it reload. */
export const useRecentVersion = create<{ version: number; bump(): void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/** Removes one file or folder from the recent list (the item itself is untouched). */
export async function forgetRecent(path: string) {
  try {
    await backend().removeRecent(path);
  } catch (e) {
    notify("error", describeError(e, "update the recent list"));
  }
  useRecentVersion.getState().bump();
}

/** File → Clear Recent: empties the recent files and folders list. Nothing is deleted. */
export async function clearRecent() {
  try {
    const b = backend();
    for (const r of await b.listRecent()) await b.removeRecent(r.path);
    notify("success", "Recent files and folders cleared.");
  } catch (e) {
    notify("error", describeError(e, "clear the recent list"));
  }
  useRecentVersion.getState().bump();
}
