import { backend } from "../services";
import { describeError } from "../services/errors";
import { basename, dirname, isInside } from "../services/paths";
import type { ConversionResult } from "../services/convert/docx";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { notify } from "../stores/uiStore";
import { newDocument, openPath } from "./documents";
import { defaultLineEnding } from "./saveTransforms";
import { refreshDir } from "./workspace";

export type ImportKind = "docx" | "html" | "pdf" | "csv";

const ACCEPT: Record<ImportKind, string> = {
  docx: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: ".html,.htm,text/html",
  pdf: ".pdf,application/pdf",
  csv: ".csv,.tsv,text/csv,text/tab-separated-values",
};
const LABEL: Record<ImportKind, string> = { docx: "Word document", html: "web page", pdf: "PDF", csv: "CSV file" };

interface Source {
  name: string;
  data: ArrayBuffer;
  /** Folder of the source file (native only), used as the default save location. */
  dir: string | null;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Browser file picker; resolves `null` when cancelled. */
function pickBrowserFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

async function chooseSource(kind: ImportKind): Promise<Source | null> {
  const b = backend();
  if (b.capabilities.nativeImport) {
    const path = await b.pickImportFile(kind);
    if (!path) return null;
    return { name: basename(path), data: base64ToBuffer(await b.readBinaryFile(path)), dir: dirname(path) };
  }
  const file = await pickBrowserFile(ACCEPT[kind]);
  return file ? { name: file.name, data: await file.arrayBuffer(), dir: null } : null;
}

/** Converts a source file with the right converter (loaded on demand). */
export async function convertSource(kind: ImportKind, data: ArrayBuffer, name: string): Promise<ConversionResult> {
  const stem = name.replace(/\.[^.]+$/, "");
  switch (kind) {
    case "docx":
      return (await import("../services/convert/docx")).docxToMarkdown(data, stem);
    case "html":
      return (await import("../services/convert/docx")).htmlFileToMarkdown(new TextDecoder().decode(data), stem);
    case "pdf":
      return (await import("../services/convert/pdf")).pdfToMarkdown(data);
    case "csv": {
      const { csvToMarkdownTable } = await import("../services/convert/csv");
      const table = csvToMarkdownTable(new TextDecoder().decode(data));
      return { markdown: table ? `# ${stem}\n\n${table}\n` : "", images: [], warnings: [] };
    }
  }
}

/** Import kind for a file name, by extension. */
export function kindForPath(path: string): ImportKind | null {
  const ext = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase();
  if (ext === "docx" || ext === "pdf" || ext === "csv") return ext;
  if (ext === "tsv") return "csv";
  if (ext === "html" || ext === "htm") return "html";
  return null;
}

/** Writes a conversion result to `dest`, saving its images to assets/ beside it. */
export async function writeConverted(dest: string, result: ConversionResult) {
  const b = backend();
  let markdown = result.markdown;
  for (const img of result.images) {
    const saved = await b.saveImageAsset(dest, img.name, img.base64);
    const savedName = basename(saved);
    if (savedName !== img.name) markdown = markdown.split(`assets/${img.name}`).join(`assets/${encodeURI(savedName)}`);
  }
  await b.writeTextFile({
    path: dest,
    content: markdown,
    lineEnding: defaultLineEnding(useSettings.getState().settings.newFileLineEnding),
    bom: false,
    expectedMtime: null,
    force: true,
  });
}

export function base64ToArrayBuffer(b64: string) {
  return base64ToBuffer(b64);
}

/** Inlines extracted images as data: URIs (for an import that wasn't saved yet). */
function inlineImages(result: ConversionResult) {
  let md = result.markdown;
  for (const img of result.images) {
    md = md.split(`assets/${img.name}`).join(`data:${img.contentType};base64,${img.base64}`);
  }
  return md;
}

/**
 * Import → Markdown: converts a Word document, web page or PDF, asks where to
 * save the new .md file (images go to an assets/ folder beside it) and opens
 * it. Cancelling the save dialog opens the result as an unsaved document.
 */
export async function importDocument(kind: ImportKind) {
  let source: Source | null;
  try {
    source = await chooseSource(kind);
  } catch (e) {
    notify("error", describeError(e, `open the ${LABEL[kind]}`));
    return;
  }
  if (!source) return;

  let result: ConversionResult;
  try {
    result = await convertSource(kind, source.data, source.name);
  } catch (e) {
    backend().log("warn", "import.convert", `${kind}: ${(e as Error).message}`);
    notify("error", `Couldn't convert “${source.name}”. The file may be damaged, password-protected, or not a valid ${LABEL[kind]}.`);
    return;
  }

  if (!result.markdown.trim()) {
    notify("error", result.warnings[0] ?? `“${source.name}” doesn't contain any text to import.`);
    return;
  }

  const b = backend();
  const suggested = source.name.replace(/\.[^.]+$/, "") + ".md";
  let dest: string | null = null;
  try {
    dest = await b.pickSavePath(suggested, source.dir ?? useWorkspace.getState().root);
  } catch (e) {
    notify("error", describeError(e, "choose where to save"));
  }

  if (!dest) {
    const id = newDocument(inlineImages(result));
    useDocuments.getState().update(id, { name: suggested });
    notify("info", `Imported “${source.name}” as an unsaved document.`);
    return;
  }

  try {
    await writeConverted(dest, result); // the Save dialog already confirmed any overwrite
  } catch (e) {
    notify("error", describeError(e, `save “${basename(dest)}”`));
    return;
  }

  const root = useWorkspace.getState().root;
  if (root && isInside(dest, root)) await refreshDir(dirname(dest));
  await openPath(dest);
  const extras = [
    result.images.length ? `${result.images.length} image${result.images.length === 1 ? "" : "s"} saved to assets/` : "",
    result.warnings.length ? `${result.warnings.length} formatting note${result.warnings.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  notify("success", `Imported “${source.name}”${extras.length ? ` (${extras.join(", ")})` : ""}.`);
}
