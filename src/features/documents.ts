import { backend } from "../services";
import { describeError, toAppError } from "../services/errors";
import { basename, dirname, isInside } from "../services/paths";
import { isDirty, newDocId, useDocuments } from "../stores/documentsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { ask, notify } from "../stores/uiStore";
import type { Doc, FileContent } from "../types";
import { refreshDir } from "./workspace";
import { useSettings } from "../stores/settingsStore";
import { applySaveTransforms, defaultLineEnding } from "./saveTransforms";

const docs = () => useDocuments.getState();
const findDoc = (id: string) => docs().docs.find((d) => d.id === id);
const findByPath = (path: string) => docs().docs.find((d) => d.path === path);

function untitledName(): string {
  const used = new Set(docs().docs.map((d) => d.name));
  for (let i = 1; ; i++) {
    const name = `Untitled-${i}.md`;
    if (!used.has(name)) return name;
  }
}

function docFromFile(file: FileContent): Doc {
  return {
    id: newDocId(),
    path: file.path,
    name: basename(file.path),
    content: file.content,
    savedContent: file.content,
    lineEnding: file.lineEnding,
    bom: file.bom,
    mtime: file.mtime,
    externalChange: null,
    saving: false,
    ...(file.readOnly && { readOnly: "file" as const }),
  };
}

/** FR-013 */
export function newDocument(content = ""): string {
  const doc: Doc = {
    id: newDocId(),
    path: null,
    name: untitledName(),
    content,
    savedContent: "",
    lineEnding: defaultLineEnding(useSettings.getState().settings.newFileLineEnding),
    bom: false,
    mtime: null,
    externalChange: null,
    saving: false,
  };
  docs().add(doc);
  return doc.id;
}

/** Opens a document by path, or focuses its tab if already open (FR-010, FR-040). */
export async function openPath(path: string, { activate = true, quiet = false } = {}): Promise<string | null> {
  const existing = findByPath(path);
  if (existing) {
    if (activate) docs().setActive(existing.id);
    return existing.id;
  }
  try {
    const file = await backend().readTextFile(path);
    const doc = docFromFile(file);
    // Replace a pristine, empty Untitled tab instead of piling up tabs.
    const active = docs().docs.find((d) => d.id === docs().activeId);
    if (active && active.path === null && active.content === "" && docs().docs.length === 1) {
      docs().remove(active.id);
    }
    docs().add(doc, activate);
    return doc.id;
  } catch (e) {
    const err = toAppError(e);
    backend().log("warn", "doc.open", err.kind);
    if (!quiet) notify("error", describeError(err, `open “${basename(path)}”`));
    return null;
  }
}

export async function openFileDialog() {
  try {
    const path = await backend().pickOpenFile();
    if (path) await openPath(path);
  } catch (e) {
    notify("error", describeError(e, "open the file"));
  }
}

/** Opens an entry from the recent list, re-granting access to it (FR-044). */
export async function openRecentFile(path: string) {
  try {
    await backend().openRecent(path);
    await openPath(path);
  } catch (e) {
    const err = toAppError(e);
    if (err.kind === "notFound") {
      const choice = await ask({
        title: "File not found",
        message: `“${basename(path)}” could not be found. It may have been moved, renamed or deleted.`,
        detail: path,
        buttons: [
          { id: "remove", label: "Remove from Recent" },
          { id: "locate", label: "Locate…", variant: "primary" },
        ],
        cancelId: "remove",
      });
      await backend().removeRecent(path).catch(() => {});
      if (choice === "locate") await openFileDialog();
    } else notify("error", describeError(err, `open “${basename(path)}”`));
  }
}

/** Documents that were saved again while a save was in flight. */
const resaveRequested = new Set<string>();

type SaveOptions = {
  saveAs?: boolean;
  force?: boolean;
  /** Auto-save: never opens dialogs; conflicts are surfaced by the change banner. */
  auto?: boolean;
};

/**
 * Saves a document (FR-014, FR-015, SRS §10.2). Resolves `true` on success.
 * On failure the document stays dirty and the editor content is untouched.
 */
export async function saveDocument(id: string, opts: SaveOptions = {}): Promise<boolean> {
  const doc = findDoc(id);
  if (!doc) return false;
  if (doc.saving) {
    // Don't drop the request: save again once the current write finishes,
    // so edits typed during a slow save are not left unsaved.
    if (!opts.saveAs) resaveRequested.add(id);
    return false;
  }
  // Auto-save never picks a location or overwrites around a conflict/deletion.
  if (opts.auto && (!doc.path || doc.externalChange)) return false;

  let path = doc.path;
  const isNewPath = opts.saveAs || !path;
  if (isNewPath) {
    const dir = doc.path ? dirname(doc.path) : useWorkspace.getState().root;
    try {
      path = await backend().pickSavePath(doc.name, dir);
    } catch (e) {
      notify("error", describeError(e, "choose a location"));
      return false;
    }
    if (!path) return false;
    const other = findByPath(path);
    if (other && other.id !== id) {
      notify("error", `“${basename(path)}” is open in another tab. Close it first, then try again.`);
      return false;
    }
  }

  // On-save cleanups (trim whitespace, final newline) are applied to the
  // editor too, so what is shown is exactly what was written.
  const content = applySaveTransforms(doc.content, useSettings.getState().settings);
  docs().update(id, content === doc.content ? { saving: true } : { saving: true, content });
  try {
    const mtime = await backend().writeTextFile({
      path: path!,
      content,
      lineEnding: doc.lineEnding,
      bom: doc.bom,
      expectedMtime: isNewPath ? null : doc.mtime,
      force: !!opts.force || doc.externalChange === "deleted",
    });
    // Only content that was actually written is marked as saved, so typing
    // during a slow save still leaves the document dirty.
    docs().update(id, {
      path: path!,
      name: basename(path!),
      savedContent: content,
      mtime,
      externalChange: null,
      saving: false,
    });
    const root = useWorkspace.getState().root;
    if (isNewPath && root && isInside(path!, root)) void refreshDir(dirname(path!));
    if (resaveRequested.delete(id)) {
      const latest = findDoc(id);
      if (latest && isDirty(latest)) void saveDocument(id, { auto: opts.auto });
    }
    return true;
  } catch (e) {
    docs().update(id, { saving: false });
    resaveRequested.delete(id);
    return handleSaveError(id, path!, e, !!opts.auto);
  }
}

async function handleSaveError(id: string, path: string, e: unknown, auto = false): Promise<boolean> {
  const err = toAppError(e);
  backend().log("error", auto ? "doc.autosave" : "doc.save", err.kind);
  const name = basename(path);
  if (auto) {
    if (err.kind === "conflict") docs().update(id, { externalChange: "modified" });
    else notify("error", describeError(err, `auto-save “${name}”`) + " Auto-save will retry after your next edit.");
    return false;
  }
  switch (err.kind) {
    case "conflict": {
      const choice = await ask({
        title: "File changed on disk",
        message: `“${name}” was changed by another program since you opened it. Saving now would overwrite those changes.`,
        buttons: [
          { id: "cancel", label: "Cancel" },
          { id: "compare", label: "Compare" },
          { id: "reload", label: "Discard Mine & Reload" },
          { id: "overwrite", label: "Overwrite", variant: "danger" },
        ],
        cancelId: "cancel",
      });
      if (choice === "overwrite") return saveDocument(id, { force: true });
      if (choice === "reload") await reloadDocument(id);
      if (choice === "compare") await openDiskVersion(id);
      return false;
    }
    case "permissionDenied":
    case "notFound":
    case "outOfScope": {
      const choice = await ask({
        title: "Couldn't save",
        message: describeError(err, `save “${name}”`),
        buttons: [
          { id: "cancel", label: "Cancel" },
          { id: "saveAs", label: "Save As…", variant: "primary" },
        ],
        cancelId: "cancel",
      });
      return choice === "saveAs" ? saveDocument(id, { saveAs: true }) : false;
    }
    default:
      notify("error", describeError(err, `save “${name}”`));
      return false;
  }
}

export async function saveAll(): Promise<boolean> {
  let ok = true;
  for (const d of docs().docs.filter(isDirty)) {
    docs().setActive(d.id);
    ok = (await saveDocument(d.id)) && ok;
  }
  return ok;
}

/** Asks Save / Don't Save / Cancel for a dirty document (FR-042, Appendix A.3). */
async function confirmDiscard(doc: Doc): Promise<boolean> {
  if (!isDirty(doc)) return true;
  docs().setActive(doc.id);
  const choice = await ask({
    title: "Unsaved changes",
    message: `Do you want to save the changes you made to “${doc.name}”?`,
    detail: "Your changes will be lost if you don't save them.",
    buttons: [
      { id: "discard", label: "Don't Save", variant: "danger" },
      { id: "cancel", label: "Cancel" },
      { id: "save", label: "Save", variant: "primary" },
    ],
    cancelId: "cancel",
  });
  if (choice === "cancel") return false;
  if (choice === "save") return saveDocument(doc.id);
  return true;
}

/** Paths of recently closed tabs, most recent last (for Reopen Closed Tab). */
const closedPaths: string[] = [];
const MAX_CLOSED = 20;

export async function closeDocument(id: string): Promise<boolean> {
  const doc = findDoc(id);
  if (!doc) return true;
  if (!(await confirmDiscard(doc))) return false;
  docs().remove(id);
  if (doc.path) {
    const at = closedPaths.indexOf(doc.path);
    if (at >= 0) closedPaths.splice(at, 1);
    closedPaths.push(doc.path);
    if (closedPaths.length > MAX_CLOSED) closedPaths.shift();
  }
  return true;
}

/**
 * Reopens the most recently closed file (Ctrl/Cmd+Shift+T), skipping files
 * that are open again or can no longer be read. Untitled tabs aren't kept.
 */
export async function reopenClosedDocument(): Promise<boolean> {
  while (closedPaths.length > 0) {
    const path = closedPaths.pop()!;
    if (findByPath(path)) continue;
    if (await openPath(path, { quiet: true })) return true;
  }
  notify("info", "There are no closed files to reopen.");
  return false;
}

export const hasClosedDocuments = () => closedPaths.length > 0;

/** Used before closing the window: every dirty document must be resolved. */
export async function closeAllDocuments(): Promise<boolean> {
  for (const doc of [...docs().docs]) {
    const current = findDoc(doc.id);
    if (current && !(await confirmDiscard(current))) return false;
  }
  for (const doc of [...docs().docs]) docs().remove(doc.id);
  return true;
}

export async function reloadDocument(id: string) {
  const doc = findDoc(id);
  if (!doc?.path) return;
  try {
    const file = await backend().readTextFile(doc.path);
    docs().update(id, {
      content: file.content,
      savedContent: file.content,
      mtime: file.mtime,
      lineEnding: file.lineEnding,
      bom: file.bom,
      externalChange: null,
      readOnly: file.readOnly ? "file" : doc.readOnly === "user" ? "user" : undefined,
    });
  } catch (e) {
    notify("error", describeError(e, `reload “${doc.name}”`));
  }
}

/**
 * Locks or unlocks editing of a document. Unlocking a file that's read-only
 * on disk allows editing, but saving it needs Save As (or the file's
 * permissions changed).
 */
export function setReadOnly(id: string, on: boolean) {
  const doc = findDoc(id);
  if (!doc) return;
  docs().update(id, { readOnly: on ? "user" : undefined });
}

/** Keeps the editor's version; the next save will overwrite the disk version. */
export async function keepMine(id: string) {
  const doc = findDoc(id);
  if (!doc?.path) return;
  const mtime = await backend().fileMtime(doc.path).catch(() => null);
  if (mtime !== null) docs().update(id, { externalChange: null, mtime });
}

/** Opens the on-disk version in a new, unsaved tab so the user can compare. */
export async function openDiskVersion(id: string) {
  const doc = findDoc(id);
  if (!doc?.path) return;
  try {
    const file = await backend().readTextFile(doc.path);
    const newId = newDocument(file.content);
    docs().update(newId, { name: `${doc.name} (on disk)`, savedContent: file.content });
  } catch (e) {
    notify("error", describeError(e, `read “${doc.name}”`));
  }
}

/**
 * Detects files changed or deleted by other programs (FR-018). Clean documents
 * are reloaded automatically; dirty ones are flagged so the user can choose.
 */
export async function checkExternalChanges() {
  for (const doc of docs().docs) {
    if (!doc.path || doc.saving || doc.mtime === null) continue;
    let mtime: number | null;
    try {
      mtime = await backend().fileMtime(doc.path);
    } catch {
      continue;
    }
    const current = findDoc(doc.id);
    if (!current || current.saving) continue;
    if (mtime === null) {
      if (current.externalChange !== "deleted") {
        docs().update(doc.id, { externalChange: "deleted" });
      }
    } else if (mtime !== current.mtime) {
      if (!isDirty(current)) {
        await reloadDocument(doc.id);
      } else if (current.externalChange !== "modified") {
        docs().update(doc.id, { externalChange: "modified" });
      }
    } else if (current.externalChange === "deleted") {
      docs().update(doc.id, { externalChange: null });
    }
  }
}

/** Keeps open tabs in sync after a rename in the file explorer. */
export function onPathRenamed(from: string, to: string) {
  for (const d of docs().docs) {
    if (!d.path) continue;
    if (d.path === from) docs().update(d.id, { path: to, name: basename(to) });
    else if (isInside(d.path, from)) {
      const newPath = to + d.path.slice(from.length);
      docs().update(d.id, { path: newPath, name: basename(newPath) });
    }
  }
}

export function onPathDeleted(path: string) {
  for (const d of docs().docs) {
    if (d.path && isInside(d.path, path)) docs().update(d.id, { externalChange: "deleted" });
  }
}
