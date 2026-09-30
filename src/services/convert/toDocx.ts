import GithubSlugger from "github-slugger";
import { ALERT_KINDS, takeMdastAlert } from "../alerts";
import { stripFrontMatter } from "../frontMatter";
import {
  AlignmentType, Bookmark, BorderStyle, Document, InternalHyperlink, ExternalHyperlink, Footer, Header, FootnoteReferenceRun, HeadingLevel, ImageRun, LevelFormat, Packer,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  type IParagraphOptions, type ParagraphChild,
} from "docx";
import { unified } from "unified";
import { remarkWikiLinks } from "../wikiLinks";
import { splitTags, TAG_COLOR } from "../tags";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkGemoji from "remark-gemoji";
import remarkMath from "remark-math";
import { latexToWordMath } from "./omml";
import type { Root, RootContent, PhrasingContent, List, Table as MdTable, AlignType } from "mdast";
import { resolveRelative } from "../paths";
import { collectFootnotes, type Footnotes } from "./footnotes";
import { PAGE_POINTS, type PageSize } from "./pageSize";

/** Loads an image referenced by the document; returns bytes or null. */
export type DocxImageLoader = (src: string) => Promise<{ data: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" } | null>;

/**
 * Draws a Mermaid diagram as a PNG for PDF and Word export; `width` and
 * `height` are its display size in CSS pixels (the PNG may be larger, for
 * sharpness). Returns null, or throws, when the diagram can't be drawn: the
 * exporters then keep the code block.
 */
export type DiagramRenderer = (code: string) => Promise<{ data: Uint8Array; width: number; height: number } | null>;

export interface ExportOptions {
  title?: string;
  loadImage?: DocxImageLoader;
  renderDiagram?: DiagramRenderer;
  /** Treat $…$ and $$…$$ as math (default true, like the preview's setting). */
  math?: boolean;
  /** Draws a display formula ($$…$$) as a PNG for PDF export; null or an error keeps the LaTeX. */
  renderMath?: DiagramRenderer;
  /** Paper size for PDF and Word (default A4). */
  pageSize?: PageSize;
  /** Start each top-level heading after the first on a new page. */
  pageBreakBeforeH1?: boolean;
  /** Document properties (from the front matter). */
  author?: string;
  description?: string;
  keywords?: string;
}

const MONO = "Consolas";
const MAX_IMAGE_WIDTH = 600; // px (~6.25 in at 96 dpi)
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

interface Style {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: boolean;
  /** An inline #tag, coloured like the preview's labels. */
  tag?: boolean;
  /** Inside a heading, where `#words` aren't tags. */
  noTags?: boolean;
}

/** Width/height from PNG, GIF, BMP or JPEG headers. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) return { width: dv.getUint32(16), height: dv.getUint32(20) };
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
  if (bytes.length > 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) return { width: dv.getInt32(18, true), height: Math.abs(dv.getInt32(22, true)) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: dv.getUint16(i + 7), height: dv.getUint16(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor).toLowerCase();
  } catch {
    return anchor.toLowerCase();
  }
}

function plainText(node: RootContent | PhrasingContent): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) return (node.children as Array<RootContent | PhrasingContent>).map(plainText).join("");
  return "";
}

function pageNumberFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16, color: "8A93A3" })],
      }),
    ],
  });
}

/**
 * Word bookmarks for the headings, in document order, and the heading anchors
 * (`#setup`, as the preview makes them) that lead to each, so links within
 * the document (a table of contents) work in Word.
 */
function headingBookmarks(tree: Root): { names: string[]; byAnchor: Map<string, string> } {
  const slugger = new GithubSlugger();
  const names: string[] = [];
  const byAnchor = new Map<string, string>();
  for (const node of tree.children) {
    if (node.type !== "heading") continue;
    // Names starting with "_" are hidden bookmarks: links work, Word's Bookmark list stays clean.
    const name = `_h${names.length + 1}`;
    names.push(name);
    byAnchor.set(slugger.slug(plainText(node)), name);
  }
  return { names, byAnchor };
}

class DocxBuilder {
  private listInstance = 0;
  private headingIndex = 0;
  /** Set from ExportOptions.pageBreakBeforeH1; counts the H1s seen so far. */
  breakBeforeH1 = false;
  /** Draws display formulas Word can't take as equations (matrices, environments). */
  renderMath?: DiagramRenderer;
  private h1Count = 0;
  constructor(
    private loadImage?: DocxImageLoader,
    private footnotes?: Footnotes,
    private renderDiagram?: DiagramRenderer,
    private bookmarks: { names: string[]; byAnchor: Map<string, string> } = { names: [], byAnchor: new Map() },
  ) {}

  private run(text: string, s: Style): TextRun {
    return new TextRun({
      text,
      bold: s.bold,
      italics: s.italics,
      strike: s.strike,
      font: s.code ? MONO : undefined,
      style: s.link ? "Hyperlink" : undefined,
      color: s.tag ? TAG_COLOR : undefined,
      shading: s.code ? { type: ShadingType.CLEAR, fill: "F2F3F5", color: "auto" } : undefined,
    });
  }

  private async inline(nodes: PhrasingContent[], s: Style = {}): Promise<ParagraphChild[]> {
    const out: ParagraphChild[] = [];
    for (const n of nodes) {
      switch (n.type) {
        case "text":
          for (const part of s.noTags || s.link ? [{ text: n.value, tag: false }] : splitTags(n.value)) out.push(this.run(part.text.replace(/\n/g, " "), { ...s, tag: part.tag }));
          break;
        case "strong":
          out.push(...(await this.inline(n.children, { ...s, bold: true })));
          break;
        case "emphasis":
          out.push(...(await this.inline(n.children, { ...s, italics: true })));
          break;
        case "delete":
          out.push(...(await this.inline(n.children, { ...s, strike: true })));
          break;
        case "inlineCode":
          out.push(this.run(n.value, { ...s, code: true }));
          break;
        case "break":
          out.push(new TextRun({ text: "", break: 1 }));
          break;
        case "link": {
          const anchor = n.url.startsWith("#") ? this.bookmarks.byAnchor.get(decodeAnchor(n.url.slice(1))) : undefined;
          if (/^(https?:|mailto:)/i.test(n.url)) {
            out.push(new ExternalHyperlink({ link: n.url, children: await this.inline(n.children, { ...s, link: true }) }));
          } else if (anchor) {
            // A link to a heading in this document.
            out.push(new InternalHyperlink({ anchor, children: await this.inline(n.children, { ...s, link: true }) }));
          } else out.push(...(await this.inline(n.children, s)));
          break;
        }
        case "image":
          out.push(await this.image(n.url, n.alt ?? ""));
          break;
        case "html":
          out.push(this.run(n.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, ""), s));
          break;
        case "inlineMath": {
          // A native Word equation; formulas outside the supported subset keep their LaTeX.
          const eq = latexToWordMath(n.value);
          out.push(eq ?? this.run(`$${n.value}$`, s));
          break;
        }
        case "footnoteReference": {
          // A real Word footnote: Word numbers it and puts the note at the bottom of the page.
          const number = this.footnotes?.number(n.identifier);
          out.push(number ? new FootnoteReferenceRun(number) : this.run(`[^${n.label ?? n.identifier}]`, s));
          break;
        }
        default:
          out.push(this.run(plainText(n), s));
      }
    }
    return out;
  }

  private async image(src: string, alt: string): Promise<ParagraphChild> {
    const img = this.loadImage ? await this.loadImage(src).catch(() => null) : null;
    const size = img ? imageSize(img.data) : null;
    if (!img || !size) return new TextRun({ text: alt ? `[${alt}]` : "[image]", italics: true, color: "666666" });
    const scale = Math.min(1, MAX_IMAGE_WIDTH / size.width);
    return new ImageRun({
      type: img.type,
      data: img.data,
      transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) },
      altText: alt ? { name: alt, description: alt, title: alt } : undefined,
    });
  }

  private async paragraph(nodes: PhrasingContent[], opts: IParagraphOptions = {}) {
    return new Paragraph({ ...opts, children: await this.inline(nodes) });
  }

  private async list(list: List, level: number, out: Array<Paragraph | Table>) {
    const instance = ++this.listInstance;
    for (const item of list.children) {
      let first = true;
      for (const child of item.children) {
        if (child.type === "paragraph" && first) {
          const box = item.checked === true ? "☑ " : item.checked === false ? "☐ " : "";
          const children = await this.inline(child.children);
          if (box) children.unshift(new TextRun(box));
          out.push(
            new Paragraph({
              children,
              ...(list.ordered
                ? { numbering: { reference: "ordered", level: Math.min(level, 8), instance } }
                : { bullet: { level: Math.min(level, 8) } }),
            }),
          );
          first = false;
        } else if (child.type === "list") {
          await this.list(child, level + 1, out);
        } else {
          const nested = await this.block(child, level + 1);
          for (const p of nested) out.push(p);
        }
      }
    }
  }

  private async table(t: MdTable): Promise<Table> {
    const align = (a: AlignType | undefined) =>
      a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
    const rows = await Promise.all(
      t.children.map(
        async (row, ri) =>
          new TableRow({
            // Only set on the header row: Word readers treat any tblHeader element as "header".
            ...(ri === 0 ? { tableHeader: true } : {}),
            children: await Promise.all(
              row.children.map(
                async (cell, ci) =>
                  new TableCell({
                    shading: ri === 0 ? { type: ShadingType.CLEAR, fill: "EEF0F3", color: "auto" } : undefined,
                    children: [
                      new Paragraph({
                        alignment: align(t.align?.[ci] ?? undefined),
                        children: await this.inline(cell.children, ri === 0 ? { bold: true } : {}),
                      }),
                    ],
                  }),
              ),
            ),
          }),
      ),
    );
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
  }

  async block(node: RootContent, indentLevel = 0): Promise<Array<Paragraph | Table>> {
    const indent = indentLevel ? { left: 360 * indentLevel } : undefined;
    switch (node.type) {
      case "heading": {
        const name = this.bookmarks.names[this.headingIndex++];
        const children = await this.inline(node.children, { noTags: true });
        const pageBreakBefore = this.breakBeforeH1 && node.depth === 1 && this.h1Count++ > 0;
        return [new Paragraph({ heading: HEADINGS[node.depth - 1], pageBreakBefore, children: name ? [new Bookmark({ id: name, children })] : children })];
      }
      case "paragraph":
        return [await this.paragraph(node.children, { indent, spacing: { after: 120 } })];
      case "list": {
        const out: Array<Paragraph | Table> = [];
        await this.list(node, indentLevel, out);
        return out;
      }
      case "code": {
        if (node.lang === "mermaid" && this.renderDiagram) {
          const png = await this.renderDiagram(node.value).catch(() => null);
          if (png) {
            const scale = Math.min(1, MAX_IMAGE_WIDTH / png.width);
            return [
              new Paragraph({
                indent,
                spacing: { before: 120, after: 120 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: png.data,
                    transformation: { width: Math.round(png.width * scale), height: Math.round(png.height * scale) },
                    altText: { name: "Diagram", description: "Mermaid diagram", title: "Diagram" },
                  }),
                ],
              }),
            ];
          }
        }
        return node.value.split("\n").map(
          (line, i, all) =>
            new Paragraph({
              indent,
              spacing: { before: i === 0 ? 120 : 0, after: i === all.length - 1 ? 120 : 0 },
              shading: { type: ShadingType.CLEAR, fill: "F4F5F7", color: "auto" },
              children: [new TextRun({ text: line || " ", font: MONO, size: 19 })],
            }),
        );
      }
      case "blockquote": {
        const out: Array<Paragraph | Table> = [];
        const alert = takeMdastAlert(node);
        const bar = { left: { style: BorderStyle.SINGLE, size: 12, color: alert ? ALERT_KINDS[alert].color : "C3C9D2", space: 8 } };
        if (alert) {
          const { label, color } = ALERT_KINDS[alert];
          out.push(new Paragraph({ indent: { left: 360 * (indentLevel + 1) }, border: bar, children: [new TextRun({ text: label, bold: true, color })] }));
        }
        for (const child of node.children) {
          const inner = child.type === "paragraph"
            ? [await this.paragraph(child.children, {
                indent: { left: 360 * (indentLevel + 1) },
                border: bar,
              })]
            : await this.block(child, indentLevel + 1);
          out.push(...inner);
        }
        return out;
      }
      case "table":
        return [await this.table(node)];
      case "thematicBreak":
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C3C9D2", space: 1 } }, children: [] })];
      case "html": {
        const text = node.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
        return text ? [new Paragraph({ indent, children: [new TextRun(text)] })] : [];
      }
      case "footnoteDefinition":
        return []; // becomes a Word footnote (see footnoteContent)
      case "math": {
        const eq = latexToWordMath(node.value);
        if (eq) return [new Paragraph({ indent, alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 }, children: [eq] })];
        const png = this.renderMath ? await this.renderMath(node.value).catch(() => null) : null;
        if (png) {
          const scale = Math.min(1, MAX_IMAGE_WIDTH / png.width);
          return [
            new Paragraph({
              indent,
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new ImageRun({
                  type: "png",
                  data: png.data,
                  transformation: { width: Math.round(png.width * scale), height: Math.round(png.height * scale) },
                  // The LaTeX stays with the picture, for screen readers and editing.
                  altText: { name: "Formula", description: node.value, title: "Formula" },
                }),
              ],
            }),
          ];
        }
        return [new Paragraph({ indent, children: [new TextRun({ text: `$$ ${node.value} $$`, font: MONO, size: 19 })] })];
      }
      default: {
        const text = plainText(node).trim();
        return text ? [new Paragraph({ indent, children: [new TextRun(text)] })] : [];
      }
    }
  }

  /** Word footnotes, keyed by number. Footnotes can hold paragraphs only, so tables become text. */
  async footnoteContent(): Promise<Record<number, { children: Paragraph[] }>> {
    const out: Record<number, { children: Paragraph[] }> = {};
    for (const { number, definition } of this.footnotes?.notes ?? []) {
      const children: Paragraph[] = [];
      for (const child of definition.children) {
        for (const part of await this.block(child)) {
          children.push(part instanceof Paragraph ? part : new Paragraph({ children: [new TextRun(plainText(child))] }));
        }
      }
      out[number] = { children: children.length ? children : [new Paragraph("")] };
    }
    return out;
  }
}

/** Markdown → Word document (.docx) bytes. */
export async function markdownToDocx(markdown: string, opts: ExportOptions = {}): Promise<Uint8Array> {
  const parser = unified().use(remarkParse).use(remarkGfm).use(remarkGemoji).use(remarkWikiLinks);
  if (opts.math !== false) parser.use(remarkMath, { singleDollarTextMath: true });
  // runSync applies transforms such as emoji shortcodes; parse alone only builds the tree.
  const tree = parser.runSync(parser.parse(stripFrontMatter(markdown))) as Root;
  const builder = new DocxBuilder(opts.loadImage, collectFootnotes(tree), opts.renderDiagram, headingBookmarks(tree));
  builder.breakBeforeH1 = !!opts.pageBreakBeforeH1;
  builder.renderMath = opts.renderMath;
  const children: Array<Paragraph | Table> = [];
  for (const node of tree.children) children.push(...(await builder.block(node)));
  const footnotes = await builder.footnoteContent();
  const page = PAGE_POINTS[opts.pageSize ?? "a4"];
  const doc = new Document({
    footnotes,
    title: opts.title,
    creator: opts.author ?? "Markpion",
    ...(opts.description ? { description: opts.description, subject: opts.description } : {}),
    ...(opts.keywords ? { keywords: opts.keywords } : {}),
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      characterStyles: [{ id: "Hyperlink", name: "Hyperlink", run: { color: "2F5BEA", underline: {} } }],
    },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        // Twips (1/20 pt); Word's default margins fit both sizes. With a title, the first page
        // has its own (empty) header: it shows the title as its heading.
        properties: { titlePage: !!opts.title, page: { size: { width: Math.round(page.width * 20), height: Math.round(page.height * 20) } } },
        // The title at the top of every page after the first, like the PDF export and printing.
        ...(opts.title && {
          headers: {
            default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: opts.title, size: 16, color: "8A93A3" })] })] }),
            first: new Header({ children: [] }),
          },
        }),
        // "page / pages", like the PDF export (on the first page too).
        footers: { default: pageNumberFooter(), first: pageNumberFooter() },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Loader for images referenced from a document: data: URIs and files next to
 * the document (read through the backend). Remote images are not fetched.
 */
export function makeImageLoader(docPath: string | null, readImage: (path: string) => Promise<string>): DocxImageLoader {
  return async (src) => {
    let dataUrl: string | null = null;
    if (src.startsWith("data:image/")) dataUrl = src;
    else if (docPath && !/^[a-z][a-z0-9+.-]*:/i.test(src)) {
      const resolved = resolveRelative(docPath, src);
      if (resolved) dataUrl = await readImage(resolved);
    }
    if (!dataUrl) return null;
    const m = /^data:image\/(png|jpe?g|gif|bmp)[^;]*;base64,(.*)$/i.exec(dataUrl);
    if (!m) return null; // SVG/WebP etc. appear as alt text
    const type = (m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase()) as "png" | "jpg" | "gif" | "bmp";
    return { type, data: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
  };
}
