import { backend } from "../services";
import { describeError, toAppError } from "../services/errors";
import { basename, dirname, isInside, isMarkdownPath, join, relativePath } from "../services/paths";
import { useWorkspace } from "../stores/workspaceStore";
import { useDocuments } from "../stores/documentsStore";
import { ask, notify, promptText } from "../stores/uiStore";
import type { DirEntry } from "../types";
import { onPathDeleted, onPathRenamed, openPath } from "./documents";
import { invalidateWorkspaceFiles } from "./completion";
import { extractHeadings, type Heading } from "./outline";

const ws = () => useWorkspace.getState();

export async function refreshDir(dir: string) {
  invalidateWorkspaceFiles();
  try {
    ws().setChildren(dir, await backend().listDir(dir));
  } catch (e) {
    backend().log("warn", "workspace.list", String((e as Error).message ?? e));
    ws().setChildren(dir, []);
  }
}

/** Opens a folder as the workspace (FR-011). */
export async function setWorkspace(root: string) {
  ws().setRoot(root);
  await refreshDir(root);
}

/** Asks for a folder and opens it; `startDir` is where the dialog starts (for example the current file's folder). */
export async function openFolderDialog(startDir?: string) {
  try {
    const path = await backend().pickOpenFolder(startDir);
    if (path) await setWorkspace(path);
  } catch (e) {
    notify("error", describeError(e, "open the folder"));
  }
}

export async function openRecentFolder(path: string) {
  try {
    await backend().openRecent(path);
    await setWorkspace(path);
  } catch (e) {
    notify("error", describeError(e, `open “${basename(path)}”`));
    await backend().removeRecent(path).catch(() => {});
  }
}

export function closeWorkspace() {
  ws().setRoot(null);
}

export async function toggleDir(dir: string) {
  const expanded = !ws().expanded[dir];
  ws().setExpanded(dir, expanded);
  if (expanded && !ws().children[dir]) await refreshDir(dir);
}

/** Re-lists every loaded folder, e.g. after the window regains focus. */
export async function refreshWorkspace() {
  const loaded = Object.keys(ws().children);
  await Promise.all(loaded.map(refreshDir));
}

export async function createFileIn(dir: string) {
  const name = await promptText({
    title: "New File",
    message: `Create a Markdown file in “${basename(dir)}”`,
    value: "untitled.md",
    okLabel: "Create",
    selectUntil: "untitled".length,
  });
  if (!name) return;
  try {
    const path = await backend().createFile(dir, name);
    ws().setExpanded(dir, true);
    await refreshDir(dir);
    ws().select(path);
    await openPath(path);
  } catch (e) {
    notify("error", describeError(e, `create “${name}”`));
  }
}

export async function createFolderIn(dir: string) {
  const name = await promptText({ title: "New Folder", message: `Create a folder in “${basename(dir)}”`, value: "", okLabel: "Create" });
  if (!name) return;
  try {
    await backend().createFolder(dir, name);
    ws().setExpanded(dir, true);
    await refreshDir(dir);
  } catch (e) {
    notify("error", describeError(e, `create “${name}”`));
  }
}

/** FR-016 */
export async function renameEntry(entry: DirEntry) {
  const dot = entry.isDir ? -1 : entry.name.lastIndexOf(".");
  const name = await promptText({
    title: "Rename",
    message: `New name for “${entry.name}”`,
    value: entry.name,
    okLabel: "Rename",
    selectUntil: dot > 0 ? dot : entry.name.length,
  });
  if (!name || name === entry.name) return;
  let to: string;
  try {
    to = await backend().renamePath(entry.path, name);
    onPathRenamed(entry.path, to);
    const parent = dirname(entry.path);
    // Move cached expansion/children for renamed folders.
    if (entry.isDir) {
      const { children, expanded } = ws();
      for (const key of Object.keys(children)) if (isInside(key, entry.path)) delete children[key];
      if (expanded[entry.path]) ws().setExpanded(to, true);
    }
    invalidateWorkspaceFiles();
    // Files renamed from a tab may be outside the open folder.
    const root = ws().root;
    if (root && isInside(parent, root)) {
      await refreshDir(parent);
      ws().select(to);
    }
  } catch (e) {
    notify("error", describeError(e, `rename “${entry.name}”`));
    return;
  }
  await offerLinkUpdate(entry.path, to);
}

/** Offers to fix links that pointed to a renamed or moved item (only Markdown and linkable files are affected). */
async function offerLinkUpdate(from: string, to: string) {
  const root = ws().root;
  if (!root || !isInside(to, root)) return;
  try {
    await (await import("./linkUpdate")).updateLinksAfterMove(root, from, to);
  } catch (e) {
    notify("error", describeError(e, "update links"));
  }
}

/**
 * Moves a file or folder into another folder of the workspace (drag and drop
 * in the explorer, or Move To…). Open tabs follow the move, and links that
 * pointed to it (or from it) can be updated.
 */
export async function moveEntry(entry: DirEntry, targetDir: string) {
  const from = entry.path;
  if (dirname(from) === targetDir) return;
  try {
    const to = await backend().movePath(from, targetDir);
    onPathRenamed(from, to);
    if (entry.isDir) {
      const { children } = ws();
      for (const key of Object.keys(children)) if (isInside(key, from)) delete children[key];
    }
    invalidateWorkspaceFiles();
    await refreshDir(dirname(from));
    await refreshDir(targetDir);
    if (targetDir !== ws().root) ws().setExpanded(targetDir, true);
    ws().select(to);
    notify("success", `Moved “${entry.name}” to “${basename(targetDir)}”.`);
    await offerLinkUpdate(from, to);
  } catch (e) {
    notify("error", describeError(e, `move “${entry.name}”`));
  }
}

/** Keyboard-friendly move: asks for the destination folder, relative to the workspace. */
export async function moveEntryTo(entry: DirEntry) {
  const root = ws().root;
  if (!root) return;
  const current = relativePath(root, dirname(entry.path)) ?? "";
  const answer = await promptText({
    title: "Move To",
    message: `Folder to move “${entry.name}” into, relative to “${basename(root)}” (/ for the top level)`,
    value: current || "/",
    okLabel: "Move",
  });
  if (answer === null || answer === undefined) return;
  // "", "." and "/" mean the top level; separators may be / or \.
  const parts = answer.trim().split(/[/\\]+/).filter((p) => p && p !== ".");
  if (parts.includes("..")) {
    notify("error", "Choose a folder inside the open folder.");
    return;
  }
  const target = parts.reduce((dir, part) => join(dir, part), root);
  await moveEntry(entry, target);
}

/** FR-017: deletes after confirmation; the item goes to the OS trash. */
export async function deleteEntry(entry: DirEntry) {
  const openDirty = useDocuments
    .getState()
    .docs.some((d) => d.path && isInside(d.path, entry.path) && d.content !== d.savedContent);
  const choice = await ask({
    title: entry.isDir ? "Delete folder" : "Delete file",
    message: `Are you sure you want to delete “${entry.name}”${entry.isDir ? " and everything in it" : ""}?`,
    detail:
      (backend().capabilities.trash ? "It will be moved to the Trash / Recycle Bin." : "This cannot be undone in the browser demo.") +
      (openDirty ? " It has unsaved changes in an open tab." : ""),
    buttons: [
      { id: "cancel", label: "Cancel" },
      { id: "delete", label: "Delete", variant: "danger" },
    ],
    cancelId: "cancel",
  });
  if (choice !== "delete") return;
  try {
    await backend().deletePath(entry.path);
    onPathDeleted(entry.path);
    await refreshDir(dirname(entry.path));
  } catch (e) {
    notify("error", describeError(e, `delete “${entry.name}”`));
  }
}

/** "notes.md" -> "notes copy.md", then "notes copy 2.md", … */
export function copyName(name: string, n: number): string {
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  return `${stem} copy${n > 1 ? ` ${n}` : ""}${ext}`;
}

/**
 * Explorer → Duplicate: copies a file next to itself under the first free
 * "name copy.md" name (never overwriting anything), keeping its line endings
 * and BOM, then opens the copy. It copies the saved file on disk.
 */
export async function duplicateFile(path: string): Promise<string | null> {
  const b = backend();
  const dir = dirname(path);
  try {
    const original = await b.readTextFile(path);
    let copy: string | null = null;
    for (let n = 1; n <= 50 && !copy; n++) {
      try {
        copy = await b.createFile(dir, copyName(basename(path), n));
      } catch (e) {
        if (toAppError(e).kind !== "alreadyExists") throw e;
      }
    }
    if (!copy) throw new Error("There are already too many copies of this file.");
    await b.writeTextFile({ path: copy, content: original.content, lineEnding: original.lineEnding, bom: original.bom, expectedMtime: null, force: true });
    await refreshDir(dir);
    ws().select(copy);
    await openPath(copy);
    return copy;
  } catch (e) {
    notify("error", describeError(e, `duplicate “${basename(path)}”`));
    return null;
  }
}

export interface FolderHeading {
  path: string;
  heading: Heading;
}

/**
 * Every heading of every Markdown file in the folder, in folder order (open
 * documents as they are in their tab, unsaved changes included).
 */
export async function collectFolderHeadings(root: string): Promise<FolderHeading[]> {
  const b = backend();
  let paths: string[];
  try {
    paths = (await b.listWorkspaceFiles(root)).filter(isMarkdownPath);
  } catch {
    return [];
  }
  const open = new Map(useDocuments.getState().docs.filter((d) => d.path).map((d) => [d.path!, d.content]));
  const texts = await Promise.all(paths.map((path) => (open.has(path) ? Promise.resolve(open.get(path)!) : b.readTextFile(path).then((f) => f.content, () => ""))));
  return paths.flatMap((path, i) => extractHeadings(texts[i]).map((heading) => ({ path, heading })));
}
