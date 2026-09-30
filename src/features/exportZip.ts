import { backend } from "../services";
import { describeError } from "../services/errors";
import { basename } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { notify } from "../stores/uiStore";
import { findAllLinks, localTargets } from "./lint";

const IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

/** Bytes of a `data:` URL (what the backend returns for images). */
function dataUrlBytes(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * The document's text with its local images renamed into `images/` (unique
 * names), and which file each name comes from. Web images are left alone.
 */
export function planZipImages(text: string, docPath: string): { text: string; images: Array<{ name: string; path: string }> } {
  const byPath = new Map<string, string>();
  const taken = new Set<string>();
  const edits: Array<{ from: number; to: number; insert: string }> = [];
  for (const { link, path } of localTargets(findAllLinks(text), docPath)) {
    if (!path || link.wiki || !(link.image || IMAGE.test(path))) continue;
    let name = byPath.get(path);
    if (!name) {
      const file = basename(path);
      const dot = file.lastIndexOf(".");
      name = file;
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${file.slice(0, dot)}-${n}${file.slice(dot)}`;
      taken.add(name.toLowerCase());
      byPath.set(path, name);
    }
    const bracketed = text[link.targetFrom - 1] === "<";
    const target = `images/${bracketed ? name : encodeURI(name)}`;
    edits.push({ from: link.targetFrom, to: link.targetFrom + (link.sourceLength ?? link.target.length), insert: target });
  }
  let out = text;
  for (const e of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return { text: out, images: [...byPath].map(([path, name]) => ({ name, path })) };
}

/**
 * File → Export as Markdown with Images: a .zip with the document and the
 * local pictures it shows (in an `images` folder, links rewritten), so it can
 * be shared or moved as one file.
 */
export async function exportActiveAsZip() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const stem = doc.name.replace(/\.(md|markdown)$/i, "") || "document";
    const plan = doc.path ? planZipImages(doc.content, doc.path) : { text: doc.content, images: [] };
    const missing: string[] = [];
    for (const { name, path } of plan.images) {
      try {
        zip.file(`images/${name}`, dataUrlBytes(await backend().readImage(path)));
      } catch {
        missing.push(basename(path));
      }
    }
    zip.file(`${stem}.md`, plan.text);
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const saved = await backend().exportBinaryFile(`${stem}.zip`, bytesToBase64(bytes), "zip");
    if (!saved) return;
    if (missing.length) notify("warning", `Exported to ${saved}, without ${missing.length === 1 ? "an image that" : `${missing.length} images that`} couldn't be read: ${missing.slice(0, 3).join(", ")}.`);
    else notify("success", `Exported to ${saved}`);
  } catch (e) {
    notify("error", describeError(e, "export the document with its images"));
  }
}
