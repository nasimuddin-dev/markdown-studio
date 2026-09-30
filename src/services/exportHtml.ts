import { frontMatterMetadata, frontMatterTitle, stripFrontMatter } from "./frontMatter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
import markdownCss from "../styles/markdown.css?raw";
import { markdownPlugins, type MarkdownFeatures } from "./markdown";
import { inlineMermaidDiagrams } from "./mermaid";
import { basename, resolveRelative } from "./paths";

/** Theme tokens used by markdown.css, so exported files look like the preview. */
const EXPORT_TOKENS = `
:root {
  --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "Cascadia Code", "JetBrains Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --text: #1d2330; --text-muted: #5c6575; --border: #d9dde3; --border-strong: #c3c9d2;
  --accent: #2f5bea; --bg-code: #f4f5f7; --danger: #c62f3a;
  --hl-keyword: #a626a4; --hl-string: #2e7d32; --hl-number: #b35b00; --hl-comment: #6e7781;
  --hl-function: #1f5fbf; --hl-type: #9a4a00; --hl-property: #0b6f86; --hl-meta: #8a6100;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: #dfe3ea; --text-muted: #9aa3b2; --border: #33383f; --border-strong: #454b55;
    --accent: #6b8cff; --bg-code: #262a32; --danger: #ff6b76;
    --hl-keyword: #d49bf5; --hl-string: #9bd88a; --hl-number: #f0a86b; --hl-comment: #7d8696;
    --hl-function: #7fb6ff; --hl-type: #f0c46b; --hl-property: #6fd3e6; --hl-meta: #e3b55b;
    color-scheme: dark;
  }
  body { background: #1b1e24; }
}
body { margin: 0; font-family: var(--font-ui); background: #fff; }
.markdown-body { padding-bottom: 48px; }
@media print {
  .markdown-body { max-width: none; padding: 0; }
  pre, table, img, blockquote { break-inside: avoid; }
  h1, h2, h3, h4 { break-after: avoid; }
}
`;

export type ImageLoader = (absolutePath: string) => Promise<string>;

/** Rehype plugin: inlines local images as data URLs so exports are self-contained. */
function rehypeInlineImages(docPath: string | null, load: ImageLoader | undefined) {
  return async (tree: Root) => {
    if (!load || !docPath) return;
    const images: Element[] = [];
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "img" && typeof node.properties?.src === "string") images.push(node);
    });
    await Promise.all(
      images.map(async (img) => {
        const src = img.properties.src as string;
        if (/^(https?:|data:)/i.test(src)) return;
        const resolved = resolveRelative(docPath, src);
        if (!resolved) return;
        try {
          img.properties.src = await load(resolved);
        } catch {
          /* leave the original reference; the exported file will show alt text */
        }
      }),
    );
  };
}

/**
 * Renders Markdown to sanitized HTML using the same policy as the preview
 * (FR-034): raw HTML is parsed, then filtered through the GitHub allow-list.
 */
export async function renderHtml(
  markdown: string,
  docPath: string | null = null,
  loadImage?: ImageLoader,
  features: MarkdownFeatures & { diagrams?: boolean } = { math: true, diagrams: true },
) {
  const { remarkPlugins, rehypePlugins } = markdownPlugins(features);
  const file = await unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePlugins)
    .use(() => rehypeInlineImages(docPath, loadImage))
    .use(rehypeStringify)
    .process(stripFrontMatter(markdown));
  const html = String(file);
  return features.diagrams && typeof document !== "undefined" ? inlineMermaidDiagrams(html) : html;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function documentTitle(markdown: string, fallbackName: string) {
  const fromMeta = frontMatterTitle(markdown);
  if (fromMeta) return fromMeta;
  const h1 = /^\s{0,3}#\s+(.+?)\s*#*\s*$/m.exec(stripFrontMatter(markdown));
  return (h1?.[1] ?? fallbackName.replace(/\.(md|markdown)$/i, "")).trim();
}

/** A CSS string literal. */
const cssString = (text: string) => `"${text.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\r\n]+/g, " ")}"`;

/**
 * Page style for printing: the document's title at the top of each page and
 * "page / pages" at the bottom (CSS page margin boxes, supported by Chromium
 * and so by Windows; other engines print without them).
 */
export function printPageStyle(title: string): string {
  const box = "font: 9pt system-ui, sans-serif; color: #5c6575;";
  return `@page { margin: 18mm 16mm; @top-center { content: ${cssString(title)}; ${box} } @bottom-center { content: counter(page) " / " counter(pages); ${box} } }`;
}

/** Builds a standalone, styled HTML document (no scripts, strict CSP). */
export async function buildHtmlDocument(opts: {
  markdown: string;
  name: string;
  docPath: string | null;
  loadImage?: ImageLoader;
  features?: MarkdownFeatures & { diagrams?: boolean };
  /** Custom CSS for the document, already scoped (see `scopeCustomCss`); `</` is escaped so it can't end the style element. */
  css?: string;
}) {
  const body = await renderHtml(opts.markdown, opts.docPath, opts.loadImage, opts.features);
  const title = escapeHtml(documentTitle(opts.markdown, opts.name));
  const meta = frontMatterMetadata(opts.markdown);
  const metaTags = (["author", "description", "keywords"] as const)
    .filter((k) => meta[k])
    .map((k) => `<meta name="${k}" content="${escapeHtml(meta[k]!)}">
`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'">
<meta name="generator" content="Markpion">
${metaTags}<title>${title}</title>
<style>${printPageStyle(documentTitle(opts.markdown, opts.name))}
${EXPORT_TOKENS}
${markdownCss}${opts.css ? `\n/* Custom CSS */\n${opts.css.replace(/<\//g, "<\\/")}` : ""}</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>
`;
}

export function exportFileName(name: string, ext: string) {
  return basename(name).replace(/\.(md|markdown)$/i, "") + "." + ext;
}
