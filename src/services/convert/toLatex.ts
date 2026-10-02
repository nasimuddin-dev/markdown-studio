import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import GithubSlugger from "github-slugger";
import type { Definition, FootnoteDefinition, Heading, List, ListItem, Nodes, Parent, PhrasingContent, Root, RootContent, Table } from "mdast";
import { frontMatterMetadata, frontMatterTitle, stripFrontMatter } from "../frontMatter";
import { remarkWikiLinks } from "../wikiLinks";

/**
 * Markdown → a LaTeX document (.tex) for pdfLaTeX, XeLaTeX or LuaLaTeX:
 * headings become sections (with labels, so links to headings work), math
 * passes through unchanged, tables use booktabs, code is verbatim, footnotes
 * become \footnote, and pictures \includegraphics with their path as written
 * (compile next to the document). Front matter gives the title and author.
 */

const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", $: "\\$", "&": "\\&", "#": "\\#", "%": "\\%", _: "\\_",
  "^": "\\textasciicircum{}", "~": "\\textasciitilde{}", "<": "\\textless{}", ">": "\\textgreater{}", "|": "\\textbar{}",
};

/** Text with LaTeX's special characters escaped. */
export function escapeLatex(text: string): string {
  return text.replace(/[\\{}$&#%_^~<>|]/g, (c) => SPECIAL[c]);
}

/** A URL for \href/\url: only %, # and backslash need escaping there. */
const escapeUrl = (url: string) => url.replace(/[\\%#]/g, (c) => `\\${c}`);

const SECTIONS = ["section", "subsection", "subsubsection", "paragraph", "subparagraph", "subparagraph"];

const ALERTS: Record<string, string> = { NOTE: "Note", TIP: "Tip", IMPORTANT: "Important", WARNING: "Warning", CAUTION: "Caution" };

interface Context {
  definitions: Map<string, Definition>;
  footnotes: Map<string, FootnoteDefinition>;
  /** Heading slugs (their \label), for links within the document. */
  labels: Set<string>;
  headingOffset: number;
  packages: Set<string>;
  /** Picture file for a Mermaid diagram's code (null: keep the code). */
  diagram?: (code: string) => string | null;
  /** `.svg` pictures are included as `.png` (converted next to them; pdfLaTeX can't read SVG). */
  svgAsPng?: boolean;
}

/** A centred figure for a picture file, with its description as the caption. */
function figure(path: string, alt: string, ctx: Context): string {
  const caption = alt ? `\n\\caption*{${escapeLatex(alt)}}` : "";
  if (caption) ctx.packages.add("caption");
  return `\\begin{figure}[htbp]\n\\centering\n${image(path, alt, ctx)}${caption}\n\\end{figure}`;
}

const plainText = (node: Nodes): string =>
  "value" in node && typeof node.value === "string" ? node.value : "children" in node ? (node.children as Nodes[]).map(plainText).join("") : "";

function inline(nodes: PhrasingContent[], ctx: Context): string {
  return nodes.map((n) => phrasing(n, ctx)).join("");
}

function phrasing(node: PhrasingContent, ctx: Context): string {
  switch (node.type) {
    case "text":
      return escapeLatex(node.value);
    case "emphasis":
      return `\\emph{${inline(node.children, ctx)}}`;
    case "strong":
      return `\\textbf{${inline(node.children, ctx)}}`;
    case "delete":
      ctx.packages.add("ulem");
      return `\\sout{${inline(node.children, ctx)}}`;
    case "inlineCode":
      return `\\texttt{${escapeLatex(node.value)}}`;
    case "inlineMath":
      return `$${node.value}$`;
    case "break":
      return "\\\\\n";
    case "link":
      return link(node.url, inline(node.children, ctx), ctx);
    case "linkReference": {
      const def = ctx.definitions.get(node.identifier);
      const text = inline(node.children, ctx);
      return def ? link(def.url, text, ctx) : text;
    }
    case "image":
      return image(node.url, node.alt ?? "", ctx);
    case "imageReference": {
      const def = ctx.definitions.get(node.identifier);
      return def ? image(def.url, node.alt ?? "", ctx) : escapeLatex(node.alt ?? "");
    }
    case "footnoteReference": {
      const def = ctx.footnotes.get(node.identifier);
      if (!def) return "";
      // A footnote of one paragraph stays inline; more paragraphs are separated by \par.
      return `\\footnote{${def.children.map((c) => (c.type === "paragraph" ? inline(c.children, ctx) : block(c, ctx).trim())).join("\\par ")}}`;
    }
    case "html":
      // Inline HTML (<kbd>, <sup>…) keeps its text.
      return escapeLatex(node.value.replace(/<[^>]+>/g, ""));
    default: {
      // Anything else (from a plugin) keeps its text.
      const other = node as Nodes;
      return "children" in other ? inline(other.children as PhrasingContent[], ctx) : "";
    }
  }
}

function link(url: string, text: string, ctx: Context): string {
  if (url.startsWith("#")) {
    const target = decodeURIComponent(url.slice(1));
    return ctx.labels.has(target) ? `\\hyperref[${target}]{${text}}` : text;
  }
  if (/^(https?|mailto|ftp):/i.test(url)) return `\\href{${escapeUrl(url)}}{${text}}`;
  // A link to another file keeps its text.
  return text;
}

function image(url: string, alt: string, ctx: Context): string {
  if (/^[a-z][\w+.-]*:/i.test(url)) return `\\href{${escapeUrl(url)}}{${escapeLatex(alt || url)}}`;
  ctx.packages.add("graphicx");
  let path = url;
  try {
    path = decodeURI(url);
  } catch {
    /* keep as written */
  }
  if (ctx.svgAsPng) path = path.replace(/\.svg$/i, ".png");
  return `\\includegraphics[width=\\linewidth,height=0.8\\textheight,keepaspectratio]{${path.replace(/[\\%#{}]/g, "")}}`;
}

function list(node: List, ctx: Context): string {
  const env = node.ordered ? "enumerate" : "itemize";
  const start = node.ordered && node.start && node.start !== 1 ? `\\setcounter{enumi}{${node.start - 1}}\n` : "";
  const items = node.children.map((item: ListItem) => {
    const marker = item.checked == null ? "\\item" : item.checked ? "\\item[$\\boxtimes$]" : "\\item[$\\square$]";
    const body = item.children.map((c) => (c.type === "paragraph" ? inline(c.children, ctx) : block(c, ctx).trim())).join("\n\n");
    return `${marker} ${body}`;
  });
  return `\\begin{${env}}\n${start}${items.join("\n")}\n\\end{${env}}`;
}

function table(node: Table, ctx: Context): string {
  ctx.packages.add("longtable");
  ctx.packages.add("booktabs");
  const cols = Math.max(...node.children.map((r) => r.children.length));
  const spec = Array.from({ length: cols }, (_, i) => ({ left: "l", center: "c", right: "r" })[node.align?.[i] ?? "left"] ?? "l").join("");
  const row = (cells: string[]) => `${[...cells, ...Array(cols - cells.length).fill("")].join(" & ")} \\\\`;
  const [head, ...rows] = node.children.map((r) => r.children.map((c) => inline(c.children, ctx)));
  return [`\\begin{longtable}{${spec}}`, "\\toprule", row(head ?? []), "\\midrule", "\\endhead", ...rows.map(row), "\\bottomrule", "\\end{longtable}"].join("\n");
}

function heading(node: Heading, ctx: Context, slugger: GithubSlugger): string {
  const text = inline(node.children, ctx);
  const slug = slugger.slug(plainText(node));
  const level = Math.max(1, node.depth - ctx.headingOffset);
  return `\\${SECTIONS[Math.min(level, SECTIONS.length) - 1]}{${text}}\\label{${slug}}`;
}

function block(node: RootContent, ctx: Context, slugger = new GithubSlugger()): string {
  switch (node.type) {
    case "heading":
      return heading(node, ctx, slugger);
    case "paragraph": {
      // A picture on its own becomes a centred figure, with its description as the caption.
      const only = node.children.length === 1 ? node.children[0] : null;
      if (only?.type === "image" && !/^[a-z][\w+.-]*:/i.test(only.url)) return figure(only.url, only.alt ?? "", ctx);
      return inline(node.children, ctx);
    }
    case "blockquote": {
      const parts = node.children.map((c) => block(c, ctx, slugger));
      // GitHub alerts: > [!NOTE] starts the quote.
      parts[0] = (parts[0] ?? "").replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, (_m, kind: string) => `\\textbf{${ALERTS[kind.toUpperCase()]}:} `);
      return `\\begin{quote}\n${parts.join("\n\n")}\n\\end{quote}`;
    }
    case "list":
      return list(node, ctx);
    case "code": {
      const file = node.lang === "mermaid" ? ctx.diagram?.(node.value) : null;
      if (file) return figure(file, "", ctx);
      return `\\begin{verbatim}\n${node.value.replace(/\\end\{verbatim\}/g, "\\end {verbatim}")}\n\\end{verbatim}`;
    }
    case "math":
      return `\\[\n${node.value}\n\\]`;
    case "thematicBreak":
      return "\\par\\noindent\\rule{\\linewidth}{0.4pt}";
    case "table":
      return table(node, ctx);
    case "html": {
      const text = node.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
      return text ? escapeLatex(text) : "";
    }
    case "definition":
    case "footnoteDefinition":
    case "yaml":
      return "";
    default:
      return "children" in node ? (node as Parent).children.map((c) => block(c as RootContent, ctx, slugger)).join("\n\n") : "";
  }
}

/**
 * `bodyOnly` returns just the converted text, for pasting into an existing
 * document: no preamble, and a top heading stays a section.
 */
export function markdownToLatex(
  markdown: string,
  opts: { name?: string; math?: boolean; bodyOnly?: boolean; diagram?: (code: string) => string | null; svgAsPng?: boolean } = {},
): string {
  const parser = unified().use(remarkParse).use(remarkGfm);
  if (opts.math !== false) parser.use(remarkMath, { singleDollarTextMath: true });
  const tree = parser.parse(stripFrontMatter(markdown)) as Root;
  remarkWikiLinks()(tree);

  const ctx: Context = { definitions: new Map(), footnotes: new Map(), labels: new Set(), headingOffset: 0, packages: new Set(), diagram: opts.diagram, svgAsPng: opts.svgAsPng };
  const collect = (n: Nodes) => {
    if (n.type === "definition") ctx.definitions.set(n.identifier, n);
    if (n.type === "footnoteDefinition") ctx.footnotes.set(n.identifier, n);
    if ("children" in n) (n.children as Nodes[]).forEach(collect);
  };
  collect(tree);

  // The title: front matter, or a lone first-level heading at the top (then the other headings move up a level).
  let title = frontMatterTitle(markdown);
  let nodes = tree.children;
  const h1s = nodes.filter((n) => n.type === "heading" && n.depth === 1);
  const first = nodes.find((n) => n.type !== "html" && n.type !== "definition");
  if (!opts.bodyOnly && !title && h1s.length === 1 && first === h1s[0]) {
    title = plainText(h1s[0]);
    nodes = nodes.filter((n) => n !== h1s[0]);
  }
  // The highest heading level left becomes \section.
  const depths = nodes.filter((n): n is Heading => n.type === "heading").map((n) => n.depth);
  ctx.headingOffset = depths.length ? Math.min(...depths) - 1 : 0;

  const labelSlugger = new GithubSlugger();
  const visitHeadings = (n: Nodes) => {
    if (n.type === "heading") ctx.labels.add(labelSlugger.slug(plainText(n)));
    if ("children" in n) (n.children as Nodes[]).forEach(visitHeadings);
  };
  // Labels use the same slugs as the headings get below (the title heading included, as in the preview).
  tree.children.forEach(visitHeadings);

  const slugger = new GithubSlugger();
  if (nodes !== tree.children) slugger.slug(plainText(h1s[0]));
  const body = nodes.map((n) => block(n, ctx, slugger)).filter(Boolean).join("\n\n");
  if (opts.bodyOnly) return `${body}\n`;

  const meta = frontMatterMetadata(markdown);
  const packages = ["amsmath", "amssymb", ...["graphicx", "longtable", "booktabs", "caption"].filter((p) => ctx.packages.has(p)), ...(ctx.packages.has("ulem") ? ["[normalem]ulem"] : []), "hyperref"];
  const usePackage = (p: string) => (p.startsWith("[") ? `\\usepackage${p.slice(0, p.indexOf("]") + 1)}{${p.slice(p.indexOf("]") + 1)}}` : `\\usepackage{${p}}`);
  const preamble = [
    "% Exported from Markpion. Compile with pdflatex, xelatex or lualatex.",
    "\\documentclass{article}",
    "\\usepackage[T1]{fontenc}",
    ...packages.map(usePackage),
    title ? `\\title{${escapeLatex(title)}}` : "",
    meta.author ? `\\author{${escapeLatex(meta.author)}}` : title ? "\\author{}" : "",
    title ? "\\date{}" : "",
  ].filter(Boolean);
  return `${preamble.join("\n")}\n\n\\begin{document}\n${title ? "\\maketitle\n" : ""}\n${body}\n\n\\end{document}\n`;
}
