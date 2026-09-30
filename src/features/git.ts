import { backend } from "../services";
import { refreshGitBase } from "./gitGutter";
import { useGit } from "../stores/gitStore";
import { useSettings } from "../stores/settingsStore";
import { useWorkspace } from "../stores/workspaceStore";

/**
 * Read-only Git status for the Explorer and status bar. Refreshed when a
 * folder opens, when files change on disk (saves included) and when the
 * window regains focus (commits made in another program).
 */

let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

export async function refreshGitStatus() {
  const root = useWorkspace.getState().root;
  const run = ++generation;
  void refreshGitBase();
  if (!root || !useSettings.getState().settings.showGitStatus) {
    useGit.getState().set(null);
    return;
  }
  let status = null;
  try {
    status = await backend().gitStatus(root);
  } catch {
    // No status is shown rather than an error: Git is optional.
  }
  // A newer refresh (or another folder) wins.
  if (run === generation && useWorkspace.getState().root === root) useGit.getState().set(status);
}

/** Refreshes after a short pause, so bursts of file changes cause one `git status`. */
export function scheduleGitRefresh(ms = 400) {
  clearTimeout(timer);
  timer = setTimeout(() => void refreshGitStatus(), ms);
}

let installed = false;

export function installGitStatus() {
  if (installed) return;
  installed = true;
  useWorkspace.subscribe((s, prev) => s.root !== prev.root && void refreshGitStatus());
  useSettings.subscribe((s, prev) => s.settings.showGitStatus !== prev.settings.showGitStatus && void refreshGitStatus());
  window.addEventListener("focus", () => scheduleGitRefresh(100));
  void refreshGitStatus();
}
