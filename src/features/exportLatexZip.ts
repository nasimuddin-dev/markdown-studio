import { backend } from "../services";
import { describeError } from "../services/errors";
import { basename } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { notify } from "../stores/uiStore";
import { dataUrlBytes, planZipImages } from "./exportZip";

/**
 * File → Export → LaTeX with Pictures (.zip): the .tex file and an images/
 * folder that compile as they are. Local pictures are copied (SVG converted to
 * PNG, which pdfLaTeX can read) and Mermaid diagrams are drawn as PNG figures.
 */

/** An SVG picture drawn on a white canvas at twice its size, as PNG bytes. */
async function svgToPng(dataUrl: string): Promise<Uint8Array> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const width = img.naturalWidth || 800;
  const height = img.naturalHeight || 600;
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture couldn't be converted");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportActiveAsLatexZip() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const [{ default: JSZip }, { markdownToLatex }] = await Promise.all([import("jszip"), import("../services/convert/toLatex")]);
    const settings = useSettings.getState().settings;
    const zip = new JSZip();
    const stem = doc.name.replace(/\.(md|markdown)$/i, "") || "document";
    const plan = doc.path ? planZipImages(doc.content, doc.path) : { text: doc.content, images: [] };
    const missing: string[] = [];
    for (const { name, path } of plan.images) {
      try {
        const url = await backend().readImage(path);
        // pdfLaTeX can't read SVG: the .tex refers to a PNG of it (see svgAsPng).
        if (/\.svg$/i.test(name)) zip.file(`images/${name.replace(/\.svg$/i, ".png")}`, await svgToPng(url));
        else zip.file(`images/${name}`, dataUrlBytes(url));
      } catch {
        missing.push(basename(path));
      }
    }

    // Mermaid diagrams: collect them in document order, draw each, and include the ones that worked.
    const codes: string[] = [];
    if (settings.renderDiagrams) markdownToLatex(plan.text, { math: settings.renderMath, diagram: (code) => (codes.push(code), null) });
    const drawn = new Map<string, string>();
    if (codes.length) {
      const { mermaidToPng } = await import("../services/mermaid");
      for (const [i, code] of codes.entries()) {
        if (drawn.has(code)) continue;
        try {
          const file = `images/diagram-${i + 1}.png`;
          zip.file(file, (await mermaidToPng(code)).data);
          drawn.set(code, file);
        } catch {
          missing.push(`diagram ${i + 1}`);
        }
      }
    }
    const tex = markdownToLatex(plan.text, { name: doc.name, math: settings.renderMath, svgAsPng: true, diagram: (code) => drawn.get(code) ?? null });
    zip.file(`${stem}.tex`, tex);
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const saved = await backend().exportBinaryFile(`${stem}.zip`, bytes, "zip");
    if (!saved) return;
    if (missing.length) notify("warning", `Exported to ${saved}, without ${missing.length === 1 ? "a picture" : `${missing.length} pictures`} that couldn't be read or drawn: ${missing.slice(0, 3).join(", ")}.`);
    else notify("success", `Exported to ${saved}`);
  } catch (e) {
    notify("error", describeError(e, "export to LaTeX"));
  }
}
