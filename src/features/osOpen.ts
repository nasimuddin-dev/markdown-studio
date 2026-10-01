import { backend } from "../services";
import { isMarkdownPath } from "../services/paths";
import { useDocuments } from "../stores/documentsStore";
import { notify } from "../stores/uiStore";
import type { OpenPaths } from "../types";
import { newDocument, openPath } from "./documents";
import { setWorkspace } from "./workspace";

/**
 * Opens files/folders handed over by the OS (launch arguments, a second
 * launch, or a drop onto the window). The backend has already approved them.
 */
export async function handleOpenPaths({ files, folders }: OpenPaths) {
  if (folders.length > 0) await setWorkspace(folders[folders.length - 1]);
  let first: string | null = null;
  for (const f of files) {
    const id = await openPath(f, { activate: false });
    first ??= id;
  }
  if (first) useDocuments.getState().setActive(first);
}

const MAX_DROP_BYTES = 10 * 1024 * 1024;

/**
 * Browser demo only: dropped files have no filesystem path, so their text is
 * opened as new, unsaved documents. (The desktop app receives real paths
 * through the native drop handler instead.)
 */
export async function openDroppedFiles(files: File[]) {
  let opened = 0;
  for (const file of files) {
    if (!isMarkdownPath(file.name) && !/\.txt$/i.test(file.name)) continue;
    if (file.size > MAX_DROP_BYTES) {
      notify("error", `“${file.name}” is too large to open.`);
      continue;
    }
    const text = (await file.text()).replace(/\r\n/g, "\n");
    const id = newDocument(text);
    useDocuments.getState().update(id, { name: file.name });
    opened++;
  }
  if (opened === 0 && files.length > 0) notify("info", "Only Markdown (.md, .markdown) and text files can be opened.");
}

export async function installOsOpenHandlers() {
  const b = backend();
  // Listen first, then collect what arrived before: the native side queues
  // paths until this call, so a file opened while the app starts isn't lost.
  await b.onOpenPaths((p) => void handleOpenPaths(p));
  await handleOpenPaths(await b.takePendingOpens().catch(() => ({ files: [], folders: [] })));

  if (!b.capabilities.desktop) {
    window.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    });
    window.addEventListener("drop", (e) => {
      // The editor handles image drops itself.
      if (e.defaultPrevented || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      void openDroppedFiles([...e.dataTransfer.files]);
    });
  }
}
