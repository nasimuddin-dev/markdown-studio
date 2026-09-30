import { backend } from "../services";
import { describeError } from "../services/errors";
import { isInside, relativePath } from "../services/paths";
import { activeDoc, isDirty, useDocuments } from "../stores/documentsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { notify } from "../stores/uiStore";
import { isMac } from "./commands";
import { closeDocument, saveDocument } from "./documents";
import { openFolderDialog, renameEntry } from "./workspace";
import { basename, dirname } from "../services/paths";
import { getEditorView } from "./editorBridge";
import { relativeImageMarkdown } from "./images";

export const revealLabel = isMac ? "Reveal in Finder" : /Win/i.test(navigator.platform) ? "Reveal in File Explorer" : "Open Containing Folder";

export async function revealInFolder(path: string) {
  try {
    await backend().revealInFolder(path);
  } catch (e) {
    notify("error", describeError(e, "show the file"));
  }
}

/**
 * Renames a document's file (from its tab or the File menu, with or without an
 * open folder). A document that was never saved is saved under a new name.
 */
export async function renameDocument(id: string) {
  const doc = useDocuments.getState().docs.find((d) => d.id === id);
  if (!doc) return;
  if (!doc.path) {
    await saveDocument(id, { saveAs: true });
    return;
  }
  await renameEntry({ name: basename(doc.path), path: doc.path, isDir: false });
}

/** Opens the folder that contains a document in the Explorer (the folder dialog starts there). */
export function openContainingFolder(path: string) {
  return openFolderDialog(dirname(path));
}

/** Copies text to the clipboard and confirms it with a toast. */
export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    notify("success", `${what} copied.`);
  } catch {
    notify("error", "Couldn't access the clipboard.");
  }
}

export const copyPath = (path: string) => copyText(path, "Path");

/** Copies the path relative to the open workspace (forward slashes). */
export function copyRelativePath(path: string) {
  const root = useWorkspace.getState().root;
  const rel = root && isInside(path, root) ? relativePath(root, path) : null;
  return copyText(rel ?? path, rel ? "Relative path" : "Path");
}

const docs = () => useDocuments.getState().docs;

/** Closes tabs one by one so dirty tabs still get the Save / Don't Save prompt. */
async function closeAll(ids: string[]) {
  for (const id of ids) if (!(await closeDocument(id))) return;
}

export const closeOthers = (keepId: string) => closeAll(docs().filter((d) => d.id !== keepId).map((d) => d.id));

export function closeToTheRight(id: string) {
  const list = docs();
  const idx = list.findIndex((d) => d.id === id);
  return closeAll(list.slice(idx + 1).map((d) => d.id));
}

export const closeSaved = () => closeAll(docs().filter((d) => !isDirty(d)).map((d) => d.id));

/** Closes every tab, asking about each one with unsaved changes. */
export const closeAllTabs = () => closeAll(docs().map((d) => d.id));

const IMAGE_PATH = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

/** Markdown linking to `path` from a document at `docPath` (an image link for pictures), or null when no relative path exists. */
export function fileLinkMarkdown(docPath: string, path: string): string | null {
  if (IMAGE_PATH.test(path)) return relativeImageMarkdown(docPath, path);
  const rel = relativePath(dirname(docPath), path);
  if (rel === null) return null;
  const text = basename(path).replace(/\.(md|markdown)$/i, "").replace(/[[\]]/g, "\\$&");
  return `[${text}](${encodeURI(rel).replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
}

/** Inserts a link to `path` at the cursor. */
export const insertFileLink = (path: string) => insertFileLinkAt(path, null, null);

/** Inserts a link to `path` where it was dropped in the editor (a file dragged from the Explorer), or at the cursor. */
export function insertFileLinkAt(path: string, x: number | null, y: number | null) {
  const view = getEditorView();
  const doc = activeDoc();
  if (!view || !doc) return;
  if (!doc.path) {
    notify("info", "Save the document first, so the link can point to the file from where the document is.");
    return;
  }
  const insert = fileLinkMarkdown(doc.path, path);
  if (!insert) {
    notify("info", "That file can't be reached from this document by a relative link.");
    return;
  }
  const pos = (x !== null && y !== null ? view.posAtCoords({ x, y }) : null) ?? view.state.selection.main.head;
  view.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length }, userEvent: "input.drop" });
  view.focus();
}
