import { backend } from "../services";
import { describeError } from "../services/errors";
import { scopeCustomCss } from "../services/customCss";
import { buildHtmlDocument, exportFileName, printPageStyle, renderHtml } from "../services/exportHtml";
import { activeDoc } from "../stores/documentsStore";
import { editorDocId, getEditorView } from "./editorBridge";
import { notify } from "../stores/uiStore";
import { useSettings } from "../stores/settingsStore";
import { basename } from "../services/paths";
import { resolvePageSize } from "../services/convert/pageSize";
import { frontMatterMetadata } from "../services/frontMatter";

const features = () => {
  const s = useSettings.getState().settings;
  return { math: s.renderMath, diagrams: s.renderDiagrams };
};

/** Paper size for PDF and Word, from the setting and the system language. */
const pageSize = () => resolvePageSize(useSettings.getState().settings.exportPageSize, navigator.language);

const loadImage = (path: string) => backend().readImage(path);

/** Draws display formulas as pictures in PDF, when math is enabled and the document has any. */
async function mathRenderer(markdown: string) {
  if (!features().math || !markdown.includes("$$")) return undefined;
  const { mathToPng } = await import("../services/mathImage");
  return mathToPng;
}

/** Draws Mermaid diagrams as pictures in PDF and Word, when diagrams are enabled and the document has any. */
async function diagramRenderer(markdown: string) {
  if (!features().diagrams || !/^\s{0,3}(```|~~~)\s*mermaid/m.test(markdown)) return undefined;
  const { mermaidToPng } = await import("../services/mermaid");
  return mermaidToPng;
}

/** Exports the active document as a standalone HTML file. */
export async function exportActiveAsHtml() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const html = await buildHtmlDocument({ markdown: doc.content, name: doc.name, docPath: doc.path, loadImage, features: features(), css: scopeCustomCss(useSettings.getState().settings.customCss) });
    const saved = await backend().exportFile(exportFileName(doc.name, "html"), html, "html");
    if (saved) notify("success", `Exported to ${saved}`);
  } catch (e) {
    notify("error", describeError(e, "export the document"));
  }
}

/** Exports the active document as an EPUB e-book. */
export async function exportActiveAsEpub() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const { markdownToEpub } = await import("../services/convert/toEpub");
    const bytes = await markdownToEpub(doc.content, { name: doc.name, docPath: doc.path, loadImage, features: features(), css: scopeCustomCss(useSettings.getState().settings.customCss) });
    const saved = await backend().exportBinaryFile(exportFileName(doc.name, "epub"), bytes, "epub");
    if (saved) notify("success", `Exported to ${saved}`);
  } catch (e) {
    notify("error", describeError(e, "export as an e-book"));
  }
}

/** Markdown to export: a document, or a folder combined in memory. */
interface ExportSource {
  content: string;
  /** Used for the default file name and title. */
  name: string;
  /** Where relative image paths are resolved from. */
  path: string | null;
}

const fromDoc = (doc: { content: string; name: string; path: string | null }): ExportSource => ({ content: doc.content, name: doc.name, path: doc.path });

async function exportAsDocx(src: ExportSource) {
  try {
    const { markdownToDocx, makeImageLoader } = await import("../services/convert/toDocx");
    const { documentTitle } = await import("../services/exportHtml");
    const bytes = await markdownToDocx(src.content, {
      title: documentTitle(src.content, src.name),
      loadImage: makeImageLoader(src.path, loadImage),
      renderDiagram: await diagramRenderer(src.content),
      math: features().math,
      pageSize: pageSize(),
      pageBreakBeforeH1: useSettings.getState().settings.pageBreakBeforeH1,
      ...frontMatterMetadata(src.content),
      renderMath: await mathRenderer(src.content),
    });
    const saved = await backend().exportBinaryFile(exportFileName(src.name, "docx"), bytes, "docx");
    if (saved) notify("success", `Exported to ${saved}`);
  } catch (e) {
    notify("error", describeError(e, "export to Word"));
  }
}

/**
 * PDF with selectable text, links and heading bookmarks. Text with characters
 * the built-in font can't show (e.g. CJK, Arabic, emoji) is offered
 * `onPrint` (Print → Save as PDF) instead, when there is one.
 */
async function exportAsPdf(src: ExportSource, onPrint?: () => Promise<void>) {
  try {
    const { markdownToPdf, pdfExportUnsupportedText } = await import("../services/convert/toPdf");
    const unsupported = pdfExportUnsupportedText(src.content);
    if (unsupported.length) {
      const { ask } = await import("../stores/uiStore");
      const choice = await ask({
        title: "Some characters need a different PDF method",
        message: onPrint
          ? `This document contains characters (${unsupported.join(" ")}) that the built-in PDF font can't display. Print → Save as PDF uses your system fonts and shows them correctly.`
          : `These documents contain characters (${unsupported.join(" ")}) that the built-in PDF font can't display. Export as Word, or combine the folder and use Print → Save as PDF, to keep them.`,
        buttons: [
          { id: "cancel", label: "Cancel" },
          { id: "anyway", label: "Export Anyway", variant: onPrint ? undefined : "primary" },
          ...(onPrint ? [{ id: "print", label: "Use Print → Save as PDF", variant: "primary" as const }] : []),
        ],
        cancelId: "cancel",
      });
      if (choice === "print" && onPrint) return onPrint();
      if (choice !== "anyway") return;
    }
    const { makeImageLoader } = await import("../services/convert/toDocx");
    const { documentTitle } = await import("../services/exportHtml");
    const bytes = await markdownToPdf(src.content, {
      title: documentTitle(src.content, src.name),
      loadImage: makeImageLoader(src.path, loadImage),
      renderDiagram: await diagramRenderer(src.content),
      math: features().math,
      pageSize: pageSize(),
      pageBreakBeforeH1: useSettings.getState().settings.pageBreakBeforeH1,
      ...frontMatterMetadata(src.content),
      renderMath: await mathRenderer(src.content),
    });
    const saved = await backend().exportBinaryFile(exportFileName(src.name, "pdf"), bytes, "pdf");
    if (saved) notify("success", `Exported to ${saved}`);
  } catch (e) {
    notify("error", describeError(e, "export to PDF"));
  }
}

/** Exports the active document as a Word document (.docx). */
export async function exportActiveAsDocx() {
  const doc = activeDoc();
  if (doc) await exportAsDocx(fromDoc(doc));
}

/** Exports the active document as a PDF file. */
export async function exportActiveAsPdf() {
  const doc = activeDoc();
  if (doc) await exportAsPdf(fromDoc(doc), printActive);
}

/**
 * Exports every Markdown file in the open folder as one PDF or Word document
 * (combined in memory in folder order, with a table of contents), without
 * writing a combined .md file.
 */
export async function exportFolder(format: "pdf" | "docx") {
  const { readCombinableFolder, combineFolderText, combinedPathFor } = await import("./combine");
  const folder = await readCombinableFolder();
  if (!folder) return;
  const { markdown, count, unreadable } = await combineFolderText(folder.root, folder.inputs);
  if (unreadable.length) notify("warning", `Skipped ${unreadable.length} of ${count + unreadable.length} files that could not be read (${unreadable.slice(0, 3).join(", ")}).`);
  // Image paths were re-based onto the folder, as if the text lived in its combined file.
  const src: ExportSource = { content: markdown, name: basename(folder.root), path: combinedPathFor(folder.root) };
  await (format === "pdf" ? exportAsPdf(src) : exportAsDocx(src));
}

/**
 * Copies the rendered document as formatted text, for pasting into Word,
 * email or Google Docs: the clipboard gets an HTML version (formatting,
 * tables, links, embedded images) and the Markdown as plain text.
 */
export async function copyActiveAsFormattedText() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const html = await renderHtml(doc.content, doc.path, loadImage, features());
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([doc.content], { type: "text/plain" }),
        }),
      ]);
    } else {
      copyHtmlWithSelection(html);
    }
    notify("success", "Formatted text copied. Paste it into Word, an email or a document.");
  } catch (e) {
    notify("error", describeError(e, "copy the formatted text"));
  }
}

/** Fallback for engines without ClipboardItem: select rendered HTML and use the copy command. */
function copyHtmlWithSelection(html: string) {
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const ok = document.execCommand("copy");
  selection?.removeAllRanges();
  holder.remove();
  if (!ok) throw new Error("The clipboard isn't available.");
}

/** Copies the rendered HTML of the active document to the clipboard. */
/** Copies the selection (or the whole document) as plain text without Markdown syntax. */
export async function copyActiveAsPlainText() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const view = getEditorView();
    const selected = view && editorDocId() === doc.id ? view.state.selection.ranges.map((r) => view.state.sliceDoc(r.from, r.to)).join("\n\n").trim() : "";
    const { markdownToPlainText } = await import("../services/convert/plainText");
    await navigator.clipboard.writeText(markdownToPlainText(selected || doc.content));
    notify("success", selected ? "Selection copied as plain text." : "Document copied as plain text.");
  } catch (e) {
    notify("error", describeError(e, "copy the text"));
  }
}

export async function copyActiveAsHtml() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const html = await renderHtml(doc.content, doc.path, loadImage, features());
    await navigator.clipboard.writeText(html);
    notify("success", "HTML copied to the clipboard.");
  } catch (e) {
    notify("error", describeError(e, "copy the HTML"));
  }
}

/**
 * Prints the active document (and "Save as PDF" through the system print
 * dialog). The rendered document is placed in a print-only container so it
 * works in every view mode.
 */
export async function printActive() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const html = await renderHtml(doc.content, doc.path, loadImage, features());
    const { documentTitle } = await import("../services/exportHtml");
    const breaks = useSettings.getState().settings.pageBreakBeforeH1 ? ".markdown-body > h1 ~ h1 { break-before: page; }" : "";
    await printHtml(`<article class="markdown-body">${html}</article>`, printPageStyle(documentTitle(doc.content, doc.name)) + breaks);
  } catch (e) {
    notify("error", describeError(e, "print the document"));
  }
}

/**
 * View → Print Slides: each slide (without its speaker notes) on its own
 * landscape page, numbered, for handouts or a PDF of the slides.
 */
export async function printSlides() {
  const doc = activeDoc();
  if (!doc) return;
  try {
    const { splitNotes, splitSlides } = await import("./slides");
    const pages = await Promise.all(
      splitSlides(doc.content).map(async (slide) => `<section class="markdown-body print-slide">${await renderHtml(splitNotes(slide).body, doc.path, loadImage, features())}</section>`),
    );
    const box = "font: 9pt system-ui, sans-serif; color: #5c6575;";
    await printHtml(pages.join(""), `@page { size: A4 landscape; margin: 14mm; @bottom-center { content: counter(page) " / " counter(pages); ${box} } }`);
  } catch (e) {
    notify("error", describeError(e, "print the slides"));
  }
}

/** Prints the given HTML with the page style, through a print-only container (so it works in every view mode). */
async function printHtml(html: string, pageCss: string) {
  const container = document.createElement("div");
  container.id = "print-root";
  container.innerHTML = html;
  document.body.appendChild(container);
  const pageStyle = document.createElement("style");
  pageStyle.dataset.print = "";
  pageStyle.textContent = pageCss;
  document.head.appendChild(pageStyle);
  document.body.classList.add("printing");
  const cleanup = () => {
    document.body.classList.remove("printing");
    container.remove();
    pageStyle.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  try {
    window.addEventListener("afterprint", cleanup);
    // Give images a moment to decode before the print snapshot.
    await new Promise((r) => setTimeout(r, 50));
    window.print();
    // Some webviews don't fire afterprint; clean up after the dialog returns.
    setTimeout(cleanup, 1000);
  } catch (e) {
    cleanup();
    throw e;
  }
}
