import JSZip from "jszip";
import markdownCss from "../../styles/markdown.css?raw";
import { documentTitle, renderHtml, type ImageLoader } from "../exportHtml";
import { frontMatterMetadata, splitFrontMatter } from "../frontMatter";
import type { MarkdownFeatures } from "../markdown";
import { resolveRelative } from "../paths";

/**
 * Markdown to an EPUB 3 e-book: one XHTML file with the document (math as
 * MathML, Mermaid diagrams as SVG, as in HTML export), a table of contents
 * from its headings, and its local pictures inside the package. Web pictures
 * become links, since e-readers don't load them. A `cover` picture in the
 * front matter becomes the book's cover.
 */

const XHTML = "http://www.w3.org/1999/xhtml";

/** Light theme tokens for markdown.css; e-readers choose their own page colours. */
const EPUB_CSS = `:root {
  --font-ui: serif; --font-mono: monospace;
  --text: #1d2330; --text-muted: #5c6575; --border: #d9dde3; --border-strong: #c3c9d2;
  --accent: #2f5bea; --bg-code: #f4f5f7; --danger: #c62f3a;
  --hl-keyword: #a626a4; --hl-string: #2e7d32; --hl-number: #b35b00; --hl-comment: #6e7781;
  --hl-function: #1f5fbf; --hl-type: #9a4a00; --hl-property: #0b6f86; --hl-meta: #8a6100;
}
.markdown-body { max-width: none; padding: 0; margin: 0; }
.cover { margin: 0; padding: 0; text-align: center; }
.cover img { max-width: 100%; max-height: 100vh; }
pre, table, img, blockquote, svg { page-break-inside: avoid; break-inside: avoid; }
h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
`;

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
};

export interface EpubOptions {
  /** The document's file name (for the title when it has none). */
  name: string;
  /** Where relative image paths are resolved from. */
  docPath: string | null;
  loadImage?: ImageLoader;
  features?: MarkdownFeatures & { diagrams?: boolean };
  /** Extra CSS, already scoped to `.markdown-body` (see `scopeCustomCss`). */
  css?: string;
  /** For tests: a fixed identifier and modification time. */
  id?: string;
  now?: Date;
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
/** Characters XML doesn't allow at all. */
const xmlSafe = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");

function dataUrlParts(url: string): { type: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return { type: m[1].toLowerCase(), bytes };
}

/** A front matter value with any quotes around it removed. */
function frontMatterValue(markdown: string, keys: RegExp): string | undefined {
  return splitFrontMatter(markdown)?.entries.find(([k]) => keys.test(k))?.[1].trim().replace(/^["']|["']$/g, "") || undefined;
}

/** The picture named by `cover` (or `cover-image`) in the front matter, if it can be read. */
async function coverImage(markdown: string, opts: EpubOptions): Promise<{ file: string; type: string; bytes: Uint8Array } | null> {
  const value = frontMatterValue(markdown, /^cover(?:[-_]image)?$/i);
  const path = value && opts.docPath ? resolveRelative(opts.docPath, value) : null;
  if (!path || !opts.loadImage) return null;
  try {
    const parts = dataUrlParts(await opts.loadImage(path));
    const ext = parts && IMAGE_TYPES[parts.type];
    return parts && ext ? { file: `images/cover.${ext}`, ...parts } : null;
  } catch {
    return null;
  }
}

/** A BCP 47 language tag from the front matter (`lang` or `language`), or English. */
function documentLanguage(markdown: string): string {
  const value = frontMatterValue(markdown, /^(?:lang|language)$/i);
  return value && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(value) ? value : "en";
}

interface NavEntry {
  level: number;
  id: string;
  text: string;
}

/** Nested <ol> lists for the headings (levels 1 to 3), as EPUB navigation requires. */
function navList(entries: NavEntry[], file: string): string {
  if (!entries.length) return "";
  const top = Math.min(...entries.map((e) => e.level));
  let out = "<ol>";
  let depth = top;
  entries.forEach((e, i) => {
    const level = Math.max(e.level, top);
    if (i > 0) {
      if (level > depth) {
        // Only one level deeper at a time; a skipped level nests under the previous item.
        out += "<ol>";
        depth++;
      } else {
        out += "</li>";
        while (depth > level) {
          out += "</ol></li>";
          depth--;
        }
      }
    }
    out += `<li><a href="${file}#${escapeXml(e.id)}">${escapeXml(e.text)}</a>`;
  });
  out += "</li>";
  while (depth > top) {
    out += "</ol></li>";
    depth--;
  }
  return out + "</ol>";
}

export async function markdownToEpub(markdown: string, opts: EpubOptions): Promise<Uint8Array> {
  const features = opts.features ?? { math: true, diagrams: true };
  const html = await renderHtml(markdown, opts.docPath, opts.loadImage, features);
  const title = documentTitle(markdown, opts.name);
  const meta = frontMatterMetadata(markdown);
  const lang = documentLanguage(markdown);

  const page = new DOMParser().parseFromString(`<div class="markdown-body">${html}</div>`, "text/html");
  const body = page.body.firstElementChild as HTMLElement;

  // Local pictures (inlined as data URLs by renderHtml) become files in the package.
  const images: { file: string; type: string; bytes: Uint8Array }[] = [];
  const byUrl = new Map<string, string>();
  for (const img of [...body.querySelectorAll("img")]) {
    const src = img.getAttribute("src") ?? "";
    if (/^https?:/i.test(src)) {
      const link = page.createElement("a");
      link.setAttribute("href", src);
      link.textContent = img.getAttribute("alt") || src;
      img.replaceWith(link);
      continue;
    }
    const known = byUrl.get(src);
    if (known) {
      img.setAttribute("src", known);
      continue;
    }
    const parts = src.startsWith("data:") ? dataUrlParts(src) : null;
    const ext = parts && IMAGE_TYPES[parts.type];
    if (!parts || !ext) {
      // A picture that couldn't be read (or a type e-readers don't show): keep its description.
      img.replaceWith(page.createTextNode(img.getAttribute("alt") ?? ""));
      continue;
    }
    const file = `images/image${images.length + 1}.${ext}`;
    images.push({ file, type: parts.type, bytes: parts.bytes });
    byUrl.set(src, file);
    img.setAttribute("src", file);
  }

  // Table of contents from the headings; each gets an id to link to.
  const nav: NavEntry[] = [];
  const ids = new Set([...body.querySelectorAll("[id]")].map((el) => el.id));
  body.querySelectorAll("h1, h2, h3").forEach((h, i) => {
    if (!h.id) {
      let id = `heading-${i + 1}`;
      while (ids.has(id)) id += "-";
      ids.add(id);
      h.id = id;
    }
    const text = (h.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) nav.push({ level: Number(h.tagName[1]), id: h.id, text });
  });

  const content = xmlSafe(new XMLSerializer().serializeToString(body));
  const hasMath = !!body.querySelector("math");
  const hasSvg = !!body.querySelector("svg");

  const xhtml = (heading: string, inner: string, extra = "") => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML}" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
<head>
<meta charset="utf-8" />
<title>${escapeXml(heading)}</title>
<link rel="stylesheet" type="text/css" href="style.css" />${extra}
</head>
<body>
${inner}
</body>
</html>
`;

  const id = opts.id ?? `urn:uuid:${crypto.randomUUID()}`;
  const modified = (opts.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const contentProps = [hasMath && "mathml", hasSvg && "svg"].filter(Boolean).join(" ");
  const cover = await coverImage(markdown, opts);
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(lang)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${escapeXml(id)}</dc:identifier>
<dc:title>${escapeXml(xmlSafe(title))}</dc:title>
<dc:language>${escapeXml(lang)}</dc:language>
${meta.author ? `<dc:creator>${escapeXml(xmlSafe(meta.author))}</dc:creator>\n` : ""}${meta.description ? `<dc:description>${escapeXml(xmlSafe(meta.description))}</dc:description>\n` : ""}${meta.keywords ? `<dc:subject>${escapeXml(xmlSafe(meta.keywords))}</dc:subject>\n` : ""}<meta property="dcterms:modified">${modified}</meta>
<meta name="generator" content="Markpion" />
${cover ? `<meta name="cover" content="cover-image" />\n` : ""}</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
${cover ? `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />\n<item id="cover-image" href="${cover.file}" media-type="${cover.type}" properties="cover-image" />\n` : ""}<item id="content" href="content.xhtml" media-type="application/xhtml+xml"${contentProps ? ` properties="${contentProps}"` : ""} />
<item id="style" href="style.css" media-type="text/css" />
${images.map((img, i) => `<item id="image${i + 1}" href="${img.file}" media-type="${img.type}" />\n`).join("")}</manifest>
<spine>
${cover ? `<itemref idref="cover" />\n` : ""}<itemref idref="content" />
</spine>
</package>
`;
  const navDoc = xhtml(
    "Contents",
    `<nav epub:type="toc" id="toc">
<h1>Contents</h1>
${navList(nav, "content.xhtml") || `<ol><li><a href="content.xhtml">${escapeXml(xmlSafe(title))}</a></li></ol>`}
</nav>`,
  );

  const zip = new JSZip();
  // The mimetype comes first and uncompressed, so readers can identify the file.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
</rootfiles>
</container>
`,
  );
  zip.file("OEBPS/content.opf", opf);
  zip.file("OEBPS/nav.xhtml", navDoc);
  zip.file("OEBPS/content.xhtml", xhtml(title, content));
  zip.file("OEBPS/style.css", `${EPUB_CSS}\n${markdownCss}${opts.css ? `\n/* Custom CSS */\n${opts.css}` : ""}`);
  for (const img of images) zip.file(`OEBPS/${img.file}`, img.bytes);
  if (cover) {
    zip.file(`OEBPS/${cover.file}`, cover.bytes);
    zip.file("OEBPS/cover.xhtml", xhtml(title, `<div class="cover"><img src="${cover.file}" alt="${escapeXml(xmlSafe(title))}" /></div>`));
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", mimeType: "application/epub+zip" });
}
