import GithubSlugger from "github-slugger";
import { collectFootnotes, type Footnotes } from "./footnotes";
import { mathTextRuns } from "./mathText";
import { ALERT_KINDS, takeMdastAlert } from "../alerts";
import { stripFrontMatter } from "../frontMatter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Root, RootContent, PhrasingContent, List, Table as MdTable } from "mdast";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { DiagramRenderer, DocxImageLoader, ExportOptions } from "./toDocx";
import { PAGE_POINTS } from "./pageSize";

/**
 * Markdown → PDF with real, selectable text (pdfmake, vector output):
 * heading styles with a bookmark tree, emphasis, links, lists (incl. tasks and
 * nesting), tables, code blocks, quotes, rules and embedded images.
 * The bundled Roboto font covers Latin, Greek and Cyrillic; documents in
 * other scripts should use Print → Save as PDF (see `pdfExportUnsupportedText`).
 */

type Inline = string | { text: Inline | Inline[]; [k: string]: unknown };

const SIDE_MARGIN = 40; // points

function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor).toLowerCase();
  } catch {
    return anchor.toLowerCase();
  }
}

function plain(node: RootContent | PhrasingContent): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) return (node.children as Array<RootContent | PhrasingContent>).map(plain).join("");
  return "";
}

/** Characters outside the bundled font's coverage (e.g. CJK, Arabic, emoji). */
export function pdfExportUnsupportedText(markdown: string): string[] {
  const found = new Set<string>();
  for (const ch of markdown) {
    const cp = ch.codePointAt(0)!;
    const ok =
      cp < 0x0250 || // Latin incl. extended A/B
      (cp >= 0x0370 && cp <= 0x04ff) || // Greek, Cyrillic
      (cp >= 0x1e00 && cp <= 0x1eff) || // Latin extended additional
      (cp >= 0x2000 && cp <= 0x206f) || // general punctuation (dashes, quotes, …)
      (cp >= 0x20a0 && cp <= 0x20cf) || // currency symbols
      (cp >= 0x2100 && cp <= 0x214f) || // letterlike symbols (™, №, ℃)
      cp === 0xfeff;
    if (!ok) found.add(ch);
    if (found.size >= 8) break;
  }
  return [...found];
}

/** The anchor of every heading (as the preview makes them), in document order, including nested ones. */
function headingAnchors(tree: Root): Set<string> {
  const slugger = new GithubSlugger();
  const anchors = new Set<string>();
  const walk = (node: { type: string; children?: unknown[] }) => {
    if (node.type === "heading") anchors.add(slugger.slug(plain(node as RootContent)));
    for (const child of (node.children ?? []) as Array<{ type: string; children?: unknown[] }>) walk(child);
  };
  walk(tree);
  return anchors;
}

class PdfBuilder {
  private headingIds: Array<{ depth: number; id: string }> = [];
  /** Set from ExportOptions.pageBreakBeforeH1; counts the H1s seen so far. */
  breakBeforeH1 = false;
  private h1Count = 0;
  /** Gives headings the same anchors as the preview, so `#anchor` links can jump to them. */
  private slugger = new GithubSlugger();
  /** Anchors of the document's headings, for links within the document. */
  anchors = new Set<string>();
  constructor(
    private loadImage?: DocxImageLoader,
    private footnotes?: Footnotes,
    private renderDiagram?: DiagramRenderer,
    private renderMath?: DiagramRenderer,
    /** Page width minus the side margins, in points. */
    private contentWidth = PAGE_POINTS.a4.width - 2 * SIDE_MARGIN,
  ) {}

  private async inline(nodes: PhrasingContent[], style: Record<string, unknown> = {}): Promise<Inline[]> {
    const out: Inline[] = [];
    for (const n of nodes) {
      switch (n.type) {
        case "text":
          out.push(Object.keys(style).length ? { text: n.value.replace(/\n/g, " "), ...style } : n.value.replace(/\n/g, " "));
          break;
        case "strong":
          out.push(...(await this.inline(n.children, { ...style, bold: true })));
          break;
        case "emphasis":
          out.push(...(await this.inline(n.children, { ...style, italics: true })));
          break;
        case "delete":
          out.push(...(await this.inline(n.children, { ...style, decoration: "lineThrough" })));
          break;
        case "inlineCode":
          out.push({ text: n.value, ...style, style: "inlineCode" });
          break;
        case "break":
          out.push("\n");
          break;
        case "link":
          if (/^(https?:|mailto:)/i.test(n.url)) out.push(...(await this.inline(n.children, { ...style, link: n.url, style: "link" })));
          else if (n.url.startsWith("#") && this.anchors.has(decodeAnchor(n.url.slice(1)))) {
            // A link to a heading in this document (a table of contents) jumps to it.
            out.push(...(await this.inline(n.children, { ...style, linkToDestination: `h-${decodeAnchor(n.url.slice(1))}`, style: "link" })));
          } else out.push(...(await this.inline(n.children, style)));
          break;
        case "image":
          out.push({ text: n.alt ? `[${n.alt}]` : "[image]", italics: true, color: "#666666" });
          break;
        case "html":
          out.push(n.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, ""));
          break;
        case "inlineMath": {
          // PDF text can't flow around pictures, so inline formulas are set as
          // text; ones the font can't draw keep their LaTeX source.
          const runs = mathTextRuns(n.value);
          if (runs) out.push(...runs.map((r) => ({ ...style, ...r, ...(style.italics ? { italics: true } : {}) })));
          else out.push({ text: `$${n.value}$`, ...style, style: "inlineCode" });
          break;
        }
        case "footnoteReference": {
          const number = this.footnotes?.number(n.identifier);
          out.push(number ? { text: String(number), sup: true, linkToDestination: `fn-${number}`, color: "#2F5BEA" } : `[^${n.label ?? n.identifier}]`);
          break;
        }
        default:
          out.push(plain(n));
      }
    }
    return out;
  }

  /** Block images get their own node so they can be sized to the page. */
  private async imageBlock(url: string, alt: string): Promise<Content> {
    const img = this.loadImage ? await this.loadImage(url).catch(() => null) : null;
    if (!img || (img.type !== "png" && img.type !== "jpg")) {
      return { text: alt ? `[${alt}]` : "[image]", italics: true, color: "#666666", margin: [0, 0, 0, 8] };
    }
    let bin = "";
    for (let i = 0; i < img.data.length; i += 0x8000) bin += String.fromCharCode(...img.data.subarray(i, i + 0x8000));
    const mime = img.type === "png" ? "image/png" : "image/jpeg";
    const { imageSize } = await import("./toDocx");
    const size = imageSize(img.data);
    const width = size ? Math.min(this.contentWidth, size.width * 0.75) : this.contentWidth;
    return { image: `data:${mime};base64,${btoa(bin)}`, width, margin: [0, 4, 0, 10] };
  }

  /** Vector checkbox for task-list items (the text font has no ☐/☑ glyphs). */
  private checkbox(checked: boolean): Content {
    const box = { type: "rect", x: 0, y: 3, w: 8, h: 8, r: 1, lineWidth: 0.8, lineColor: "#5C6575" };
    const tick = { type: "polyline", lineWidth: 1.2, lineColor: "#2F5BEA", points: [{ x: 1.6, y: 7 }, { x: 3.4, y: 9 }, { x: 6.8, y: 4.2 }] };
    return { canvas: (checked ? [box, tick] : [box]) as never, width: 12 };
  }

  private async list(list: List): Promise<Content> {
    const items: Content[] = [];
    for (const item of list.children) {
      const parts: Content[] = [];
      for (const child of item.children) {
        if (child.type === "paragraph") parts.push({ text: await this.inline(child.children), margin: [0, 0, 0, 2] } as Content);
        else parts.push(...(await this.block(child)));
      }
      const body: Content = parts.length === 1 ? parts[0] : { stack: parts };
      const isTask = item.checked !== null && item.checked !== undefined;
      items.push(
        isTask
          ? ({ columns: [this.checkbox(item.checked === true), { ...(body as object), width: "*" }], columnGap: 4, listType: "none" } as Content)
          : body,
      );
    }
    return list.ordered
      ? { ol: items, start: list.start ?? 1, margin: [0, 0, 0, 8] }
      : { ul: items, margin: [0, 0, 0, 8] };
  }

  private async table(t: MdTable): Promise<Content> {
    const align = (i: number) => t.align?.[i] ?? "left";
    const body = await Promise.all(
      t.children.map((row, ri) =>
        Promise.all(
          row.children.map(async (cell, ci) => ({
            text: await this.inline(cell.children),
            bold: ri === 0,
            fillColor: ri === 0 ? "#EEF0F3" : undefined,
            alignment: align(ci),
          })),
        ),
      ),
    );
    const cols = Math.max(...body.map((r) => r.length));
    for (const r of body) while (r.length < cols) r.push({ text: [], bold: false, fillColor: undefined, alignment: "left" });
    return {
      table: { headerRows: 1, widths: Array(cols).fill("*"), body: body as never },
      layout: { hLineColor: () => "#C3C9D2", vLineColor: () => "#C3C9D2", paddingTop: () => 3, paddingBottom: () => 3 },
      margin: [0, 2, 0, 10],
    };
  }

  async block(node: RootContent): Promise<Content[]> {
    switch (node.type) {
      case "heading": {
        const id = `h-${this.slugger.slug(plain(node))}`;
        while (this.headingIds.length && this.headingIds[this.headingIds.length - 1].depth >= node.depth) this.headingIds.pop();
        const parent = this.headingIds[this.headingIds.length - 1]?.id;
        this.headingIds.push({ depth: node.depth, id });
        return [
          {
            text: await this.inline(node.children),
            style: `h${node.depth}`,
            id,
            outline: true,
            outlineText: plain(node),
            ...(parent ? { outlineParentId: parent } : {}),
            ...(this.breakBeforeH1 && node.depth === 1 && this.h1Count++ > 0 ? { pageBreak: "before" } : {}),
          } as Content,
        ];
      }
      case "paragraph": {
        // A paragraph that is just an image renders as a block image.
        if (node.children.length === 1 && node.children[0].type === "image") {
          return [await this.imageBlock(node.children[0].url, node.children[0].alt ?? "")];
        }
        return [{ text: await this.inline(node.children), margin: [0, 0, 0, 8] }];
      }
      case "list":
        return [await this.list(node)];
      case "code":
        if (node.lang === "mermaid" && this.renderDiagram) {
          const png = await this.renderDiagram(node.value).catch(() => null);
          if (png) {
            let bin = "";
            for (let i = 0; i < png.data.length; i += 0x8000) bin += String.fromCharCode(...png.data.subarray(i, i + 0x8000));
            return [{ image: `data:image/png;base64,${btoa(bin)}`, width: Math.min(this.contentWidth, png.width * 0.75), margin: [0, 4, 0, 10] }];
          }
        }
        return [
          {
            table: { widths: ["*"], body: [[{ text: node.value || " ", style: "code" }]] },
            layout: { fillColor: () => "#F4F5F7", hLineColor: () => "#D9DDE3", vLineColor: () => "#D9DDE3", paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
            margin: [0, 2, 0, 10],
          },
        ];
      case "blockquote": {
        const alert = takeMdastAlert(node);
        const style = alert ? ALERT_KINDS[alert] : null;
        const inner: Content[] = style ? [{ text: style.label, bold: true, color: `#${style.color}`, margin: [0, 0, 0, 4] }] : [];
        for (const child of node.children) inner.push(...(await this.block(child)));
        return [
          {
            table: { widths: ["*"], body: [[{ stack: inner, color: style ? "#1D2330" : "#5C6575" }]] },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: (i: number) => (i === 0 ? 3 : 0),
              vLineColor: () => (style ? `#${style.color}` : "#C3C9D2"),
              paddingLeft: () => 10,
            },
            margin: [0, 0, 0, 8],
          },
        ];
      }
      case "table":
        return [await this.table(node)];
      case "thematicBreak":
        return [{ canvas: [{ type: "line", x1: 0, y1: 0, x2: this.contentWidth, y2: 0, lineWidth: 1, lineColor: "#C3C9D2" }], margin: [0, 6, 0, 12] }];
      case "html": {
        const text = node.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
        return text ? [{ text, margin: [0, 0, 0, 8] }] : [];
      }
      case "footnoteDefinition":
        return []; // collected into the Footnotes section at the end
      case "math": {
        const png = this.renderMath ? await this.renderMath(node.value).catch(() => null) : null;
        if (png) {
          let bin = "";
          for (let i = 0; i < png.data.length; i += 0x8000) bin += String.fromCharCode(...png.data.subarray(i, i + 0x8000));
          return [{ image: `data:image/png;base64,${btoa(bin)}`, width: Math.min(this.contentWidth, png.width * 0.75), alignment: "center", margin: [0, 4, 0, 10] }];
        }
        return [{ text: `$$ ${node.value} $$`, style: "code", margin: [0, 2, 0, 10] }];
      }
      default: {
        const text = plain(node).trim();
        return text ? [{ text, margin: [0, 0, 0, 8] }] : [];
      }
    }
  }

  /** The Footnotes section: a rule, a heading and the numbered notes. */
  async footnoteSection(): Promise<Content[]> {
    const notes = this.footnotes?.notes ?? [];
    if (!notes.length) return [];
    const out: Content[] = [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: this.contentWidth / 3, y2: 0, lineWidth: 0.8, lineColor: "#C3C9D2" }], margin: [0, 14, 0, 6] },
      { text: "Footnotes", bold: true, fontSize: 11, margin: [0, 0, 0, 4] },
    ];
    for (const { number, definition } of notes) {
      const body: Content[] = [];
      for (const child of definition.children) body.push(...(await this.block(child)));
      out.push({
        columns: [{ text: `${number}.`, width: 16, fontSize: 9.5, color: "#5C6575" }, { stack: body, width: "*", fontSize: 9.5 }],
        columnGap: 4,
        id: `fn-${number}`,
      } as Content);
    }
    return out;
  }
}

let fontsReady: Promise<typeof import("pdfmake/build/pdfmake")> | null = null;

async function pdfmake() {
  fontsReady ??= (async () => {
    const lib = (await import("pdfmake/build/pdfmake")) as unknown as { default?: unknown };
    const pm = (lib.default ?? lib) as typeof import("pdfmake/build/pdfmake");
    const vfsMod = (await import("pdfmake/build/vfs_fonts")) as unknown as { default?: Record<string, string> };
    const courierMod = (await import("pdfmake/build/standard-fonts/Courier")) as unknown as { default?: unknown };
    pm.addVirtualFileSystem((vfsMod.default ?? vfsMod) as Record<string, string>);
    pm.addFontContainer((courierMod.default ?? courierMod) as never);
    return pm;
  })();
  return fontsReady;
}

/** Markdown → PDF bytes. */
export async function markdownToPdf(markdown: string, opts: ExportOptions = {}): Promise<Uint8Array> {
  // Emoji shortcodes (:tada:) stay as text: the PDF font has no emoji.
  const parser = unified().use(remarkParse).use(remarkGfm);
  if (opts.math !== false) parser.use(remarkMath, { singleDollarTextMath: true });
  const tree = parser.parse(stripFrontMatter(markdown)) as Root;
  const page = PAGE_POINTS[opts.pageSize ?? "a4"];
  const builder = new PdfBuilder(opts.loadImage, collectFootnotes(tree), opts.renderDiagram, opts.renderMath, page.width - 2 * SIDE_MARGIN);
  builder.breakBeforeH1 = !!opts.pageBreakBeforeH1;
  builder.anchors = headingAnchors(tree);
  const content: Content[] = [];
  for (const node of tree.children) content.push(...(await builder.block(node)));
  content.push(...(await builder.footnoteSection()));

  const doc: TDocumentDefinitions = {
    info: {
      title: opts.title,
      creator: "Markpion",
      producer: "Markpion",
      ...(opts.author ? { author: opts.author } : {}),
      ...(opts.description ? { subject: opts.description } : {}),
      ...(opts.keywords ? { keywords: opts.keywords } : {}),
    },
    pageSize: { width: page.width, height: page.height },
    pageMargins: [SIDE_MARGIN, 48, SIDE_MARGIN, 56],
    content,
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: "center", fontSize: 8, color: "#8A93A3", margin: [0, 20, 0, 0] }),
    // The title at the top of every page after the first (the first shows it as its heading), like printing.
    header: (page) => (page > 1 && opts.title ? { text: opts.title, alignment: "center", fontSize: 8, color: "#8A93A3", margin: [SIDE_MARGIN, 22, SIDE_MARGIN, 0] } : null),
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.3, color: "#1D2330" },
    styles: {
      h1: { fontSize: 22, bold: true, margin: [0, 6, 0, 8] },
      h2: { fontSize: 17, bold: true, margin: [0, 10, 0, 6] },
      h3: { fontSize: 14, bold: true, margin: [0, 8, 0, 4] },
      h4: { fontSize: 12, bold: true, margin: [0, 6, 0, 4] },
      h5: { fontSize: 11, bold: true, margin: [0, 6, 0, 4] },
      h6: { fontSize: 10.5, bold: true, color: "#5C6575", margin: [0, 6, 0, 4] },
      link: { color: "#2F5BEA", decoration: "underline" },
      inlineCode: { font: "Courier", fontSize: 9.5, background: "#F2F3F5" },
      code: { font: "Courier", fontSize: 9, lineHeight: 1.2, preserveLeadingSpaces: true },
    },
  };
  const pm = await pdfmake();
  const buffer = await pm.createPdf(doc).getBuffer();
  return new Uint8Array(buffer);
}
