import GithubSlugger from "github-slugger";
import { extractHeadings } from "./outline";
import { resolveRelative } from "../services/paths";

export type Severity = "error" | "warning" | "info";

/** A Markdown problem at a character range of the document. */
export interface MarkdownProblem {
  from: number;
  to: number;
  severity: Severity;
  message: string;
  rule: string;
}

export interface LinkRef {
  from: number;
  to: number;
  image: boolean;
  text: string;
  target: string;
  /** Where the destination starts in the text (after `<` when it is bracketed). */
  targetFrom: number;
  /** True for a reference-style definition (`[id]: path`). */
  definition?: boolean;
  /** True for an HTML `<a href>` or `<img src>`. */
  html?: boolean;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LINK = /(!?)\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s]*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g;
const DEFINITION = /^( {0,3}\[([^\]\n]+)\]:[ \t]*)(<[^>\n]*>|\S+)/gm;

/**
 * Returns the text with fenced code blocks and inline code spans blanked out
 * (same length), so link/heading rules never fire inside code.
 */
export function maskCode(text: string): string {
  const lines = text.split("\n");
  let fence: string | null = null;
  const out = lines.map((line) => {
    const f = FENCE.exec(line);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return " ".repeat(line.length);
    }
    if (fence) return " ".repeat(line.length);
    return line.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m) => " ".repeat(m.length));
  });
  return out.join("\n");
}

export function findLinks(text: string): LinkRef[] {
  const masked = maskCode(text);
  const links: LinkRef[] = [];
  for (const m of masked.matchAll(LINK)) {
    const bracketed = m[3].startsWith("<");
    const raw = bracketed ? m[3].slice(1, -1) : m[3];
    // The destination follows "](" and optional spaces.
    const open = m.index! + m[1].length + 1 + m[2].length + 2;
    const targetFrom = masked.indexOf(m[3], open) + (bracketed ? 1 : 0);
    links.push({ from: m.index!, to: m.index! + m[0].length, image: m[1] === "!", text: m[2], target: raw, targetFrom });
  }
  return links;
}

/** Reference-style link definitions (`[id]: path "title"`), outside code. */
export function findLinkDefinitions(text: string): LinkRef[] {
  const out: LinkRef[] = [];
  for (const m of maskCode(text).matchAll(DEFINITION)) {
    const bracketed = m[3].startsWith("<");
    const targetFrom = m.index! + m[1].length + (bracketed ? 1 : 0);
    out.push({ from: m.index!, to: m.index! + m[0].length, image: false, text: m[2], target: bracketed ? m[3].slice(1, -1) : m[3], targetFrom, definition: true });
  }
  return out;
}

const HTML_LINK = /<(a|img)\b[^>]*?\s(href|src)\s*=\s*("[^"]*"|'[^']*')[^>]*>/dgi;

/** `href` of HTML `<a>` tags and `src` of `<img>` tags, outside code. */
export function findHtmlLinks(text: string): LinkRef[] {
  const out: LinkRef[] = [];
  for (const m of maskCode(text).matchAll(HTML_LINK)) {
    const image = m[1].toLowerCase() === "img";
    if ((m[2].toLowerCase() === "src") !== image) continue;
    const value = m[3].slice(1, -1);
    const targetFrom = m.indices![3]![0] + 1;
    out.push({ from: m.index!, to: m.index! + m[0].length, image, text: "", target: value.trim(), targetFrom: targetFrom + (value.length - value.trimStart().length), html: true });
  }
  return out;
}

/** Every link destination in the text: inline links and images, reference definitions and HTML links and images. */
export function findAllLinks(text: string): LinkRef[] {
  return [...findLinks(text), ...findLinkDefinitions(text), ...findHtmlLinks(text)].sort((a, b) => a.from - b.from);
}

function lineStarts(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

/** Document-local rules (no filesystem access). */
export function lintMarkdown(text: string): MarkdownProblem[] {
  const problems: MarkdownProblem[] = [];
  const starts = lineStarts(text);
  const lineRange = (line: number) => {
    const from = starts[line - 1] ?? 0;
    const to = (starts[line] ?? text.length + 1) - 1;
    return { from, to: Math.max(from, to) };
  };

  // Headings
  const headings = extractHeadings(text);
  const slugger = new GithubSlugger();
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  let h1Count = 0;
  let prevLevel = 0;
  for (const h of headings) {
    const range = lineRange(h.line);
    anchors.add(slugger.slug(h.text));
    const key = `${h.level}:${h.text.toLowerCase()}`;
    if (seen.has(key)) {
      problems.push({ ...range, severity: "warning", rule: "duplicate-heading", message: `Duplicate heading “${h.text}” (also on line ${seen.get(key)}). Links to it are ambiguous.` });
    } else seen.set(key, h.line);
    if (h.level === 1 && ++h1Count > 1) {
      problems.push({ ...range, severity: "info", rule: "multiple-h1", message: "More than one top-level heading (H1) in the document." });
    }
    if (prevLevel && h.level > prevLevel + 1) {
      problems.push({ ...range, severity: "info", rule: "heading-increment", message: `Heading level jumps from H${prevLevel} to H${h.level}.` });
    }
    prevLevel = h.level;
  }
  // Explicit HTML anchors: <a id="x"> / <a name="x">
  for (const m of text.matchAll(/<a\s+[^>]*(?:id|name)\s*=\s*["']([^"']+)["']/gi)) anchors.add(m[1]);

  // Links, images and reference definitions
  for (const link of findAllLinks(text)) {
    const at = { from: link.from, to: link.to };
    if (!link.target) {
      problems.push({ ...at, severity: "warning", rule: "empty-link", message: link.image ? "Image has no source." : "Link has no destination." });
      continue;
    }
    if (link.image && !link.html && !link.text.trim()) {
      problems.push({ ...at, severity: "info", rule: "image-alt", message: "Image has no alt text (describe it for screen readers)." });
    }
    if (link.target.startsWith("#")) {
      let id = link.target.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep raw */
      }
      if (id && !anchors.has(id) && !anchors.has(id.toLowerCase())) {
        problems.push({ ...at, severity: "warning", rule: "broken-anchor", message: `No heading matches “#${id}” in this document.` });
      }
    }
  }
  return problems.sort((a, b) => a.from - b.from);
}

/** Local link/image targets worth checking on disk (relative or absolute paths). */
export function localTargets(links: LinkRef[], docPath: string) {
  return links
    .filter((l) => l.target && !l.target.startsWith("#") && !/^[a-z][a-z0-9+.-]*:/i.test(l.target))
    .map((l) => ({ link: l, path: resolveRelative(docPath, l.target) }));
}

/**
 * Filesystem rules: reports relative links/images whose file doesn't exist.
 * `exists` returns true/false, or null when the location can't be checked
 * (e.g. outside the approved folder) — those are skipped.
 */
export async function lintLinks(
  text: string,
  docPath: string | null,
  exists: (path: string) => Promise<boolean | null>,
): Promise<MarkdownProblem[]> {
  if (!docPath) return [];
  const problems: MarkdownProblem[] = [];
  const cache = new Map<string, Promise<boolean | null>>();
  for (const { link, path } of localTargets(findAllLinks(text), docPath)) {
    if (!path) {
      problems.push({ from: link.from, to: link.to, severity: "warning", rule: "broken-link", message: "Link points outside the file system root." });
      continue;
    }
    if (!cache.has(path)) cache.set(path, exists(path).catch(() => null));
    if ((await cache.get(path)) === false) {
      problems.push({
        from: link.from,
        to: link.to,
        severity: "warning",
        rule: link.image ? "missing-image" : "broken-link",
        message: `${link.image ? "Image" : "Linked file"} not found: ${link.target}`,
      });
    }
  }
  return problems;
}
