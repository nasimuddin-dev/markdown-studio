import { backend } from "../services";
import { describeError } from "../services/errors";
import { basename, dirname, isInside, relativePath } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { notify, promptText } from "../stores/uiStore";
import { imageFolderName, useSettings } from "../stores/settingsStore";
import { getEditorView } from "./editorBridge";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
};

export const isImageFile = (f: File) => f.type in IMAGE_TYPES || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name);

export async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Clipboard screenshots arrive as a generic "image.png"; give them a
 * timestamped, URL-friendly name instead.
 */
export function assetFileName(file: File, now = new Date()): string {
  const ext = IMAGE_TYPES[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "png";
  const generic = !file.name || /^image\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
  if (generic) {
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `image-${stamp}.${ext}`;
  }
  const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "image";
  return `${stem}.${ext}`;
}

/** A name typed for a pasted picture, made file-safe, keeping the picture's type. */
export function namedImageFile(typed: string, suggested: string): string {
  const ext = suggested.split(".").pop()!;
  const stem = typed.trim().replace(/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i, "").replace(/[^\p{L}\p{N}._ -]+/gu, "-").replace(/\s+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return stem ? `${stem}.${ext}` : suggested;
}

/** Markdown for an image stored at `<folder>/<name>` next to the document. */
export function imageMarkdown(savedPath: string, folder = "assets"): string {
  const name = basename(savedPath);
  const alt = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  return `![${alt}](${encodeURI(folder)}/${encodeURI(name)})`;
}

/** The folder for new images, from Settings. */
const imageFolder = () => imageFolderName(useSettings.getState().settings.imageFolder);

/**
 * Saves pasted/dropped images next to the active document and inserts
 * Markdown image links at the cursor. Returns `true` if the event was handled.
 */
export async function insertImageFiles(files: File[]): Promise<boolean> {
  const images = files.filter(isImageFile);
  if (images.length === 0) return false;
  const doc = activeDoc();
  if (!doc) return false;
  if (!doc.path) {
    notify("info", `Save the document first. Pasted images are stored in an “${imageFolder()}” folder next to it.`);
    return true;
  }
  const links: string[] = [];
  for (const file of images) {
    try {
      let name = assetFileName(file);
      // Screenshots from the clipboard have no name of their own: ask for one when the setting is on.
      if (name.startsWith("image-") && useSettings.getState().settings.askImageName) {
        const typed = await promptText({ title: "Name the Picture", message: `The picture is saved in “${imageFolder()}” next to the document.`, value: name.replace(/\.[^.]+$/, ""), okLabel: "Save" });
        if (typed === null) continue;
        name = namedImageFile(typed, name);
      }
      const saved = await backend().saveImageAsset(doc.path, name, await toBase64(file), imageFolder());
      links.push(imageMarkdown(saved, imageFolder()));
    } catch (e) {
      const msg = describeError(e, `add “${file.name || "the image"}”`);
      notify("error", /outOfScope|access/i.test(msg) ? msg + " Open the document's folder to allow adding images." : msg);
    }
  }
  insertImageLinks(links);
  return true;
}

/** Inserts image links at the cursor, each on its own line. */
function insertImageLinks(links: string[]) {
  const view = getEditorView();
  if (links.length && view) {
    const { from, to } = view.state.selection.main;
    // Keep images on their own line(s).
    const before = view.state.doc.lineAt(from);
    const after = view.state.doc.lineAt(to);
    const lead = from > before.from ? "\n" : "";
    const trail = to < after.to ? "\n" : "";
    const insert = lead + links.join("\n") + trail;
    view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: "input.paste" });
    view.focus();
  }
}

/** Markdown for an image file the document can reach by a relative path. */
export function relativeImageMarkdown(docPath: string, imagePath: string): string | null {
  const rel = relativePath(dirname(docPath), imagePath);
  if (rel === null) return null;
  const alt = basename(imagePath).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  return `![${alt}](${encodeURI(rel).replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
}

/**
 * Format → Insert Image…: asks for an image file and links it at the cursor.
 * An image inside the document's folder is linked where it is; any other is
 * copied into the images folder next to the document first ("assets", or the one set in Settings).
 */
export async function insertImageFromFile() {
  const doc = activeDoc();
  if (!doc) return;
  if (!doc.path) {
    notify("info", "Save the document first. Inserted images are linked relative to it.");
    return;
  }
  const b = backend();
  if (!b.capabilities.nativeImport) {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
      input.addEventListener("cancel", () => resolve(null), { once: true });
      input.click();
    });
    if (file) await insertImageFiles([file]);
    return;
  }
  try {
    const path = await b.pickImportFile("image");
    if (!path) return;
    const local = isInside(path, dirname(doc.path)) ? relativeImageMarkdown(doc.path, path) : null;
    if (local) return insertImageLinks([local]);
    const name = assetFileName(new File([], basename(path)));
    const saved = await b.saveImageAsset(doc.path, name, await toBase64(new Blob([await b.readBinaryFile(path)])), imageFolder());
    insertImageLinks([imageMarkdown(saved, imageFolder())]);
  } catch (e) {
    notify("error", describeError(e, "insert the image"));
  }
}
