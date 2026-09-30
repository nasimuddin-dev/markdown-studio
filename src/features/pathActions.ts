import { backend } from "../services";
import { describeError } from "../services/errors";
import { isInside, relativePath } from "../services/paths";
import { isDirty, useDocuments } from "../stores/documentsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { notify } from "../stores/uiStore";
import { isMac } from "./commands";
import { closeDocument, saveDocument } from "./documents";
import { openFolderDialog, renameEntry } from "./workspace";
import { basename, dirname } from "../services/paths";

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
