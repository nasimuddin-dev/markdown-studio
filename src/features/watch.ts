import { backend } from "../services";
import { scheduleGitRefresh } from "./git";
import { dirname, isInside } from "../services/paths";
import { useDocuments } from "../stores/documentsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { invalidateWorkspaceFiles } from "./completion";
import { checkExternalChanges } from "./documents";
import { refreshDir } from "./workspace";

/**
 * Applies file-system change notifications: re-lists the affected folders
 * that are shown in the explorer and re-checks open documents, so changes
 * made by other programs appear immediately (FR-012, FR-018).
 */
export async function applyFsChanges(paths: string[]) {
  const { root, children } = useWorkspace.getState();
  if (!root) return;
  invalidateWorkspaceFiles();
  const dirs = new Set<string>();
  for (const p of paths) {
    if (!isInside(p, root)) continue;
    const parent = dirname(p);
    if (children[parent]) dirs.add(parent);
    if (children[p]) dirs.add(p); // a listed folder changed itself
  }
  await Promise.all([...dirs].map(refreshDir));
  scheduleGitRefresh();
  const open = useDocuments.getState().docs;
  if (open.some((d) => d.path && paths.some((p) => p === d.path || isInside(d.path!, p)))) {
    await checkExternalChanges();
  }
}

let installed = false;

/** Keeps the backend watcher pointed at the current workspace folder. */
export async function installWorkspaceWatcher() {
  if (installed) return;
  installed = true;
  const b = backend();
  let pending: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  await b.onFsChanged((paths) => {
    pending.push(...paths);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const batch = pending;
      pending = [];
      void applyFsChanges(batch);
    }, 100);
  });
  const follow = (root: string | null) =>
    b.watchWorkspace(root).catch((e) => b.log("warn", "watch", String((e as Error).message ?? e)));
  void follow(useWorkspace.getState().root);
  useWorkspace.subscribe((s, prev) => {
    if (s.root !== prev.root) void follow(s.root);
  });
}
