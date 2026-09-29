import { backend } from "../services";
import { useDocuments, isDirty, newDocId } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { ask } from "../stores/uiStore";
import type { RecoverySnapshot } from "../types";
import { applyKeybindings, handleGlobalKeydown } from "./commands";
import { checkExternalChanges, closeAllDocuments, openPath } from "./documents";
import { refreshWorkspace, setWorkspace } from "./workspace";
import { installOsOpenHandlers } from "./osOpen";
import { installAutoSave } from "./autosave";
import { installWorkspaceWatcher } from "./watch";

const RECOVERY_INTERVAL_MS = 5000;
const EXTERNAL_CHECK_INTERVAL_MS = 3000;

/** Applies the theme preference to the document root (FR-060). */
function applyTheme(pref: "system" | "light" | "dark") {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Offers to restore documents that were unsaved when the app last exited (FR-004). */
async function offerRecovery() {
  let snapshot: RecoverySnapshot | null = null;
  try {
    snapshot = await backend().loadRecovery();
  } catch {
    return;
  }
  const docs = snapshot?.docs?.filter((d) => typeof d?.content === "string") ?? [];
  if (docs.length === 0) return;
  const when = snapshot?.savedAt ? new Date(snapshot.savedAt).toLocaleString() : "the last session";
  const choice = await ask({
    title: "Recover unsaved changes?",
    message: `Markpion didn't close normally. ${docs.length} document${docs.length > 1 ? "s have" : " has"} unsaved changes from ${when}.`,
    detail: docs.map((d) => d.name).join(", "),
    buttons: [
      { id: "discard", label: "Discard", variant: "danger" },
      { id: "restore", label: "Restore", variant: "primary" },
    ],
    cancelId: "restore",
  });
  if (choice === "discard") {
    await backend().clearRecovery().catch(() => {});
    return;
  }
  const store = { get docs() { return useDocuments.getState().docs; }, add: useDocuments.getState().add };
  for (const r of docs) {
    const open = r.path ? store.docs.find((d) => d.path === r.path) : undefined;
    if (open) {
      useDocuments.getState().update(open.id, { content: r.content });
      continue;
    }
    let savedContent = "";
    let mtime: number | null = null;
    let path = r.path;
    if (path) {
      try {
        await backend().openRecent(path).catch(() => {});
        const onDisk = await backend().readTextFile(path);
        savedContent = onDisk.content;
        mtime = onDisk.mtime;
      } catch {
        // The file is gone or inaccessible; keep the text as an unsaved document.
        path = null;
      }
    }
    store.add({
      id: newDocId(),
      path,
      name: r.name,
      content: r.content,
      savedContent,
      lineEnding: r.lineEnding ?? "lf",
      bom: !!r.bom,
      mtime,
      // If the disk copy changed after the snapshot, saving must ask first.
      externalChange: null,
      saving: false,
    });
  }
}

async function restoreSession() {
  const { settings } = useSettings.getState();
  if (!settings.restoreSession) return;
  const { workspace, files } = settings.session;
  if (workspace) {
    try {
      await backend().openRecent(workspace);
      await setWorkspace(workspace);
    } catch {
      /* folder gone or not in the recent list */
    }
  }
  for (const f of files) {
    if (useDocuments.getState().docs.some((d) => d.path === f)) continue;
    // Files inside the restored workspace are already accessible; others need
    // to be re-approved through the recent list. The backend enforces the scope.
    await backend().openRecent(f).catch(() => {});
    await openPath(f, { activate: false, quiet: true });
  }
  const first = useDocuments.getState().docs[0];
  if (first && !useDocuments.getState().activeId) useDocuments.getState().setActive(first.id);
}

function snapshotDirtyDocs(): RecoverySnapshot {
  return {
    savedAt: Date.now(),
    docs: useDocuments
      .getState()
      .docs.filter(isDirty)
      .map(({ path, name, content, lineEnding, bom, mtime }) => ({ path, name, content, lineEnding, bom, mtime })),
  };
}

/**
 * Writes the recovery snapshot right away (instead of after the usual delay),
 * e.g. before reloading after an unexpected error.
 */
export async function saveRecoveryNow() {
  clearTimeout(recoveryTimer);
  const snap = snapshotDirtyDocs();
  if (snap.docs.length > 0) {
    await backend().saveRecovery(snap);
    hadRecovery = true;
  }
}

let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
let hadRecovery = false;

function scheduleRecoverySave() {
  clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(async () => {
    const snap = snapshotDirtyDocs();
    try {
      if (snap.docs.length > 0) {
        await backend().saveRecovery(snap);
        hadRecovery = true;
      } else if (hadRecovery) {
        await backend().clearRecovery();
        hadRecovery = false;
      }
    } catch (e) {
      backend().log("warn", "recovery.save", String((e as Error).message ?? e));
    }
  }, RECOVERY_INTERVAL_MS);
}

function persistSession() {
  const docs = useDocuments.getState().docs;
  const files = docs.map((d) => d.path).filter((p): p is string => !!p);
  const workspace = useWorkspace.getState().root;
  const { settings, update } = useSettings.getState();
  const same =
    settings.session.workspace === workspace &&
    settings.session.files.length === files.length &&
    settings.session.files.every((f, i) => f === files[i]);
  if (!same) update({ session: { workspace, files } });
}

function updateWindowTitle() {
  const { docs, activeId } = useDocuments.getState();
  const active = docs.find((d) => d.id === activeId);
  const title = active ? `${isDirty(active) ? "● " : ""}${active.name} — Markpion` : "Markpion";
  if (document.title === title) return;
  document.title = title;
  backend().setWindowTitle(title).catch(() => {});
}

/** Guards window close with the unsaved-changes prompt (Appendix A.3). */
async function installCloseGuard() {
  await backend().guardClose(
    async () => {
      if (!(await closeAllDocuments())) return false;
      await backend().clearRecovery().catch(() => {});
      return true;
    },
    () => useDocuments.getState().docs.some(isDirty),
  );
}

export async function startApp() {
  const started = performance.now();
  window.addEventListener("error", (e) => backend().log("error", "ui.uncaught", e.message));
  window.addEventListener("unhandledrejection", (e) =>
    backend().log("error", "ui.unhandledRejection", String(e.reason?.message ?? e.reason)),
  );

  await useSettings.getState().load();
  // The user's own keyboard shortcuts, now and whenever they change.
  applyKeybindings(useSettings.getState().settings.keybindings);
  useSettings.subscribe((s, prev) => {
    if (s.settings.keybindings !== prev.settings.keybindings) applyKeybindings(s.settings.keybindings);
  });
  applyTheme(useSettings.getState().settings.theme);
  useSettings.subscribe((s, prev) => {
    if (s.settings.theme !== prev.settings.theme) applyTheme(s.settings.theme);
  });
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    applyTheme(useSettings.getState().settings.theme);
  });

  window.addEventListener("keydown", handleGlobalKeydown);
  await installCloseGuard();

  await restoreSession();
  await offerRecovery();
  await installOsOpenHandlers();
  installAutoSave();
  await installWorkspaceWatcher();
  void import("./updates").then((m) => m.scheduleUpdateCheck());

  useDocuments.subscribe((s, prev) => {
    if (s.docs !== prev.docs) scheduleRecoverySave();
    updateWindowTitle();
    persistSession();
  });
  useWorkspace.subscribe((s, prev) => {
    if (s.root !== prev.root) persistSession();
  });
  updateWindowTitle();

  const onFocus = () => {
    void checkExternalChanges();
    void refreshWorkspace();
  };
  window.addEventListener("focus", onFocus);
  setInterval(() => {
    if (document.visibilityState === "visible") void checkExternalChanges();
  }, EXTERNAL_CHECK_INTERVAL_MS);

  backend().log("info", "app.ready", `startup ${Math.round(performance.now() - started)}ms`);
}
