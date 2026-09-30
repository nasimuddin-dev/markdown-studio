import type { ConversionResult } from "./docx";

/**
 * PDF → Markdown. PDFs store positioned text, not structure, so the document
 * is reconstructed with layout heuristics:
 *   - lines are grouped by baseline; words are spaced by horizontal gaps
 *   - the most common font size is body text; larger lines become headings
 *   - lines close together form paragraphs; hyphenated line breaks are joined
 *   - bullet glyphs (including Word's Symbol/Wingdings ones), dashes and
 *     "1." prefixes become list items, nested by indentation
 *   - text repeated at the top/bottom of most pages (headers, footers, page
 *     numbers) is dropped
 * Scanned PDFs (images only) have no text to extract; OCR is not attempted.
 */

type PdfJs = typeof import("pdfjs-dist");
export interface PdfJsSetup {
  lib: PdfJs;
  /** Adobe CMaps (needed for some CJK fonts) and standard font metrics. */
  cMapUrl?: string;
  standardFontDataUrl?: string;
}
let loader: () => Promise<PdfJsSetup> = async () => {
  const lib = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  // Served from the app bundle (see the pdfjsAssets plugin in vite.config.ts).
  return { lib, cMapUrl: "/pdfjs/cmaps/", standardFontDataUrl: "/pdfjs/standard_fonts/" };
};

/** Test hook: tooling outside the browser provides pdf.js differently. */
export function setPdfJsLoader(fn: () => Promise<PdfJsSetup>) {
  loader = fn;
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
  bold: boolean;
}

export interface Line {
  text: string;
  x: number;
  y: number;
  size: number;
  bold: boolean;
  page: number;
  /** Height of the page the line is on (PDF points). */
  pageHeight?: number;
}

/**
 * Bullet glyphs. Besides the Unicode ones, Word writes bullets in the Symbol
 * and Wingdings fonts, which PDFs often map to the Private Use Area (U+F0B7
 * is Symbol's "•", U+F0A7 Wingdings' "▪", U+F0D8 "➢", U+F0FC "✓"…).
 */
const GLYPHS = "•◦▪▫●○■□‣⁃·∙⦁➢➤►▶▸▹✓✔❖◆◇☐☑";
/** A glyph bullet (a space after it is optional), or a dash/asterisk followed by a space. */
const BULLET = new RegExp(`^(?:[${GLYPHS}]\\s*|[–—*-]\\s+)(?=\\S)`);
const LONE_BULLET = new RegExp(`^[${GLYPHS}–—*-]$`);
const ORDERED = /^(\d{1,3})[.)]\s+/;

function groupLines(items: Item[], page: number, pageHeight: number): Line[] {
  const sorted = items.filter((i) => i.str.length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; size: number; items: Item[] }> = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.max(l.size, it.size) * 0.45);
    if (line) {
      line.items.push(it);
      line.size = Math.max(line.size, it.size);
    } else lines.push({ y: it.y, size: it.size, items: [it] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      const parts = l.items.sort((a, b) => a.x - b.x);
      let text = "";
      let end = -Infinity;
      for (const p of parts) {
        const gap = p.x - end;
        if (text && gap > l.size * 0.18 && !text.endsWith(" ") && !p.str.startsWith(" ")) text += " ";
        text += p.str;
        end = p.x + p.w;
      }
      const boldChars = parts.filter((p) => p.bold).reduce((n, p) => n + p.str.trim().length, 0);
      const allChars = parts.reduce((n, p) => n + p.str.trim().length, 0);
      return {
        text: text.replace(/\s+/g, " ").trim(),
        x: parts[0].x,
        y: l.y,
        size: Math.round(l.size * 10) / 10,
        bold: allChars > 0 && boldChars / allChars > 0.8,
        page,
        pageHeight,
      };
    })
    .filter((l) => l.text);
}

/** Drops page headers/footers: text (digits normalised) repeated at the page edges. */
export function stripRunningText(pages: Line[][]): Line[][] {
  if (pages.length < 2) return pages.map((p) => p.filter((l) => !/^\d{1,4}$/.test(l.text) || p.length > 3));
  const key = (t: string) => t.replace(/\d+/g, "#").toLowerCase();
  // Only lines in the top/bottom 12% of the page can be running headers/footers.
  const atEdge = (l: Line) => {
    const h = l.pageHeight ?? 792;
    return l.y > h * 0.88 || l.y < h * 0.12;
  };
  const edges = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set<string>();
    for (const l of p) if (atEdge(l)) seen.add(key(l.text));
    for (const k of seen) edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  return pages.map((p) =>
    p.filter((l) => {
      if (!atEdge(l)) return true;
      if (/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l.text)) return false;
      return (edges.get(key(l.text)) ?? 0) < threshold;
    }),
  );
}

function bodySize(lines: Line[]): number {
  const weight = new Map<number, number>();
  for (const l of lines) weight.set(l.size, (weight.get(l.size) ?? 0) + l.text.length);
  let best = 12;
  let max = -1;
  for (const [size, w] of weight) if (w > max) [best, max] = [size, w];
  return best;
}

/** "bullet" or "ordered" for a top-level list item, "nested" for an indented one, else null. */
function listKind(block: string): "bullet" | "ordered" | "nested" | null {
  const m = /^( *)(- |\d+\. )/.exec(block);
  if (!m) return null;
  return m[1] ? "nested" : m[2] === "- " ? "bullet" : "ordered";
}

const escapeStart = (t: string) => t.replace(/^([#>|+=])/, "\\$1");

/** Turns positioned lines into Markdown blocks. */
export function linesToMarkdown(pages: Line[][]): string {
  const lines = pages.flat();
  if (!lines.length) return "";
  const body = bodySize(lines);
  const out: string[] = [];
  let para: string[] = [];
  let prev: Line | null = null;
  let inList = false;
  /** Left edges of the list levels seen so far, outermost first. */
  let levels: number[] = [];
  /** The list marker at each level, for indenting nested items. */
  const markers: string[] = [];
  /** A bullet glyph that ended up on a line of its own (a different baseline). */
  let loneBullet: Line | null = null;

  const flush = () => {
    if (para.length) out.push(para.join(" ").replace(/(\w)- (\p{Ll})/gu, "$1$2"));
    para = [];
  };
  const join = (text: string) => {
    const last = para[para.length - 1];
    if (last && /\p{L}-$/u.test(last) && /^\p{Ll}/u.test(text)) para[para.length - 1] = last.slice(0, -1) + text;
    else para.push(text);
  };

  for (let l of lines) {
    if (LONE_BULLET.test(l.text)) {
      loneBullet = l;
      continue;
    }
    if (loneBullet) {
      // The glyph belongs to the text next to it.
      if (loneBullet.page === l.page && Math.abs(loneBullet.y - l.y) <= l.size * 1.2 && l.x > loneBullet.x) l = { ...l, text: `• ${l.text}`, x: loneBullet.x };
      loneBullet = null;
    }
    const ratio = l.size / body;
    const newPage = prev !== null && prev.page !== l.page;
    const gap = prev && !newPage ? prev.y - l.y : Infinity;
    const isHeading = l.text.length <= 150 && !/[.,;:]$/.test(l.text) && (ratio >= 1.15 || (l.bold && ratio >= 0.95 && l.text.length <= 80 && gap > l.size * 1.3));

    if (isHeading) {
      flush();
      inList = false;
      const level = ratio >= 1.8 ? 1 : ratio >= 1.4 ? 2 : 3;
      // A heading wrapped over two lines continues the previous heading.
      const lastOut = out[out.length - 1];
      if (prev && !newPage && lastOut?.startsWith("#".repeat(level) + " ") && Math.abs(prev.size - l.size) < 0.5 && gap <= l.size * 1.5) {
        out[out.length - 1] = `${lastOut} ${l.text}`;
      } else out.push(`${"#".repeat(level)} ${escapeStart(l.text)}`);
      prev = l;
      continue;
    }

    // Word's second-level bullet is a Courier "o"; only trust it inside a list, indented.
    const subBullet = inList && levels.length > 0 && l.x > levels[0] + l.size * 0.8 ? /^o\s+(?=\S)/.exec(l.text) : null;
    const bullet = BULLET.exec(l.text) ?? subBullet;
    const ordered = ORDERED.exec(l.text);
    if (bullet || ordered) {
      flush();
      if (!inList && out.length && !listKind(out[out.length - 1])) out.push("");
      if (!inList) levels = [];
      inList = true;
      // Nesting follows the indentation: a new, deeper left edge opens a level.
      const tolerance = l.size * 0.8;
      while (levels.length && l.x < levels[levels.length - 1] - tolerance) levels.pop();
      if (!levels.length || l.x > levels[levels.length - 1] + tolerance) levels.push(l.x);
      else levels[levels.length - 1] = Math.min(levels[levels.length - 1], l.x);
      const depth = levels.length - 1;
      const marker = bullet ? "- " : `${ordered![1]}. `;
      markers.length = depth;
      // A nested item is indented by the width of its parents' markers ("- " or "1. ").
      const indent = " ".repeat(markers.reduce((n, m) => n + m.length, 0));
      markers.push(marker);
      para = [indent + marker + l.text.slice((bullet ?? ordered)![0].length)];
      prev = l;
      continue;
    }

    // A list item's wrapped lines start right of its bullet; text back at the bullet's edge ends the list.
    const leavesList = inList && levels.length > 0 && l.x <= levels[levels.length - 1] + l.size * 0.3;
    const continues = prev !== null && !newPage && !leavesList && gap <= Math.max(prev.size, l.size) * 1.6;
    if (continues && para.length) {
      join(l.text);
    } else {
      flush();
      inList = false;
      para = [escapeStart(l.text)];
    }
    prev = l;
  }
  flush();

  // Blank lines between blocks; items of the same list (bulleted or numbered) stay together.
  // Nested items always stay with the list around them.
  const blocks: string[] = [];
  for (const b of out) {
    if (b === "") continue;
    const kind = listKind(b);
    const prevKind = blocks.length ? listKind(blocks[blocks.length - 1].replace(/^\u0000/, "")) : null;
    const together = kind !== null && prevKind !== null && (kind === prevKind || kind === "nested" || prevKind === "nested");
    blocks.push(together ? `\u0000${b}` : b);
  }
  return blocks.join("\n\n").replace(/\n\n\u0000/g, "\n") + "\n";
}

export async function pdfToMarkdown(data: ArrayBuffer): Promise<ConversionResult> {
  const { lib: pdfjs, cMapUrl, standardFontDataUrl } = await loader();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: false,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    // Keeps font names (e.g. "Helvetica-Bold") so bold lines can be detected.
    fontExtraProperties: true,
  });
  const pdf = await task.promise;
  const pages: Line[][] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      // Loading the page's operators also loads its fonts (names used for bold detection).
      await page.getOperatorList();
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const [a, b, , d, e, f] = raw.transform as number[];
        const size = Math.hypot(b, d) || Math.abs(a) || raw.height || 10;
        let fontName = "";
        try {
          fontName = page.commonObjs.has(raw.fontName) ? String(page.commonObjs.get(raw.fontName)?.name ?? "") : "";
        } catch {
          fontName = "";
        }
        const family = content.styles[raw.fontName]?.fontFamily ?? "";
        items.push({
          str: raw.str,
          x: e,
          y: f,
          w: raw.width,
          size,
          bold: /bold|black|heavy|semibold/i.test(fontName + " " + family),
        });
      }
      pages.push(groupLines(items, n, page.view[3] - page.view[1]));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  const text = pages.flat().map((l) => l.text).join("");
  if (!text.trim()) {
    return {
      markdown: "",
      images: [],
      warnings: ["This PDF has no selectable text. It may be a scanned document; text recognition (OCR) isn't supported."],
    };
  }
  return { markdown: linesToMarkdown(stripRunningText(pages)), images: [], warnings: [] };
}
