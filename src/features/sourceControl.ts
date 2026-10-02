import { backend } from "../services";
import { describeError } from "../services/errors";
import type { GitChange } from "../types";
import { notify } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { scheduleGitRefresh } from "./git";

/**
 * Source Control: the open folder's changed files, staged or not, and
 * staging, unstaging and committing through the user's Git. After each change
 * the Explorer's Git markers and the editor's change bars refresh.
 */

export type ChangesResult = { changes: GitChange[] } | { error: string };

/** The open folder's changes, or why there are none to show (no repository, no Git). */
export async function loadChanges(): Promise<ChangesResult | null> {
  const root = useWorkspace.getState().root;
  if (!root) return null;
  try {
    return { changes: await backend().gitChanges(root) };
  } catch (e) {
    return { error: describeError(e, "read the folder's Git changes") };
  }
}

/** Runs a Git action on the open folder; refreshes the markers; false (after telling the user) when it failed. */
async function act(action: string, run: (root: string) => Promise<unknown>): Promise<boolean> {
  const root = useWorkspace.getState().root;
  if (!root) return false;
  try {
    await run(root);
    return true;
  } catch (e) {
    notify("error", describeError(e, action));
    return false;
  } finally {
    scheduleGitRefresh(50);
  }
}

export const stage = (paths: string[]) => act("stage the changes", (root) => backend().gitStage(root, paths));
export const unstage = (paths: string[]) => act("unstage the changes", (root) => backend().gitUnstage(root, paths));

/** Commits what's staged; true when it worked. */
export async function commit(message: string): Promise<boolean> {
  let hash = "";
  const ok = await act("commit", async (root) => (hash = await backend().gitCommit(root, message)));
  if (ok) notify("success", `Committed (${hash}): ${message.trim().split("\n")[0]}`);
  return ok;
}

/** What a change letter means, for labels and screen readers. */
export function changeLabel(letter: string | null): string {
  return { M: "Modified", A: "Added", D: "Deleted", R: "Renamed", U: "Untracked", C: "Copied" }[letter ?? ""] ?? "Changed";
}
