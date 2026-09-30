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
  /** A quick fix, offered in the Problems panel and the problem's tooltip. */
  fix?: ProblemFix;
}

/**
 * Edits that fix a problem. `at` is relative to the problem's start (so the fix
 * still applies after edits elsewhere), or "end" for the end of the document.
 */
export interface ProblemFix {
  label: string;
  /** `remove` characters at `at` are replaced by `insert`. */
  edits: Array<{ at: number | "end"; remove?: number; insert: string }>;
}

/** The changes for a fix whose problem now starts at `from` in `text`. Text for the end goes on its own line after a blank one. */
export function fixChanges(fix: ProblemFix, from: number, text: string): Array<{ from: number; to: number; insert: string }> {
  return fix.edits.map(({ at, remove = 0, insert }) => {
    if (at !== "end") {
      const start = Math.min(from + at, text.length);
      return { from: start, to: Math.min(start + remove, text.length), insert };
    }
    // Right after another footnote definition, the next one follows on the next line.
    const lastLine = text.slice(text.lastIndexOf("\n") + 1);
    const gap = text.endsWith("\n\n") || !text ? "" : text.endsWith("\n") || /^ {0,3}\[\^[^\]]+\]:/.test(lastLine) ? "\n" : "\n\n";
    return { from: text.length, to: text.length, insert: gap + insert };
  });
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
  /** Length of the destination in the text when it differs from `target` (HTML entities decoded). */
  sourceLength?: number;
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

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Decodes the character references used in attribute values (`&amp;`, `&#39;`, `&#x20;`). Unknown ones are kept. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, ref: string) => {
    if (ref[0] !== "#") return ENTITIES[ref.toLowerCase()] ?? whole;
    const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
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
    const raw = value.trim();
    const target = decodeEntities(raw);
    out.push({ from: m.index!, to: m.index! + m[0].length, image, text: "", target, targetFrom: targetFrom + (value.length - value.trimStart().length), html: true, ...(target !== raw && { sourceLength: raw.length }) });
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
      const atx = /^( {0,3})(#{1,6})(?=[ \t]|$)/.exec(text.slice(range.from, range.to));
      const level = prevLevel + 1;
      problems.push({
        ...range,
        severity: "info",
        rule: "heading-increment",
        message: `Heading level jumps from H${prevLevel} to H${h.level}.`,
        ...(atx && { fix: { label: `Change to H${level}`, edits: [{ at: atx[1].length, remove: atx[2].length, insert: "#".repeat(level) }] } }),
      });
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
    // The text as written (code spans are blanked in `link.text`): after "[" or "![".
    const start = link.from + (link.image ? 2 : 1);
    const written = link.html || link.definition ? "" : text.slice(start, start + link.text.length);
    if (link.image && !link.html && !written.trim()) {
      problems.push({ ...at, severity: "info", rule: "image-alt", message: "Image has no alt text (describe it for screen readers)." });
    }
    if (!link.image && !link.html && !link.definition && !written.trim()) {
      problems.push({ ...at, severity: "info", rule: "link-text", message: "Link has no text, so screen readers read out its address." });
    }
    if (link.target.startsWith("#")) {
      let id = link.target.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep raw */
      }
      if (id && !anchors.has(id) && !anchors.has(id.toLowerCase())) {
        // A likely typo: offer the closest heading anchor.
        const near = link.sourceLength === undefined ? closest(id.toLowerCase(), anchors) : null;
        problems.push({
          ...at,
          severity: "warning",
          rule: "broken-anchor",
          message: `No heading matches “#${id}” in this document.${near ? ` Did you mean “#${near}”?` : ""}`,
          ...(near && { fix: { label: `Change to #${near}`, edits: [{ at: link.targetFrom + 1 - link.from, remove: link.target.length - 1, insert: near }] } }),
        });
      }
    }
  }
  problems.push(...lintTables(text, starts), ...lintFootnotes(text));
  return problems.sort((a, b) => a.from - b.from);
}

/**
 * Applies every safe quick fix (not guesses such as a suggested anchor),
 * repeating while fixes reveal new ones (a heading moved up a level can make
 * the next one skip). Returns the fixed text and how many fixes were applied.
 */
export function fixAllProblems(text: string): { text: string; fixed: number } {
  let fixed = 0;
  for (let pass = 0; pass < 6; pass++) {
    const fixes = lintMarkdown(text).filter((p) => p.fix && p.rule !== "broken-anchor");
    if (!fixes.length) break;
    // Apply from the end so earlier positions stay valid; skip fixes that would overlap.
    const changes = fixes.flatMap((p) => fixChanges(p.fix!, p.from, text)).sort((a, b) => b.from - a.from);
    let last = Infinity;
    let applied = 0;
    let atEnd = false;
    const length = text.length;
    for (const c of changes) {
      // One addition at the end per pass keeps several of them in order.
      const end = c.from === length;
      if (c.to > last || (end && atEnd)) continue;
      atEnd ||= end;
      text = text.slice(0, c.from) + c.insert + text.slice(c.to);
      last = c.from;
      applied++;
    }
    fixed += applied;
    if (!applied) break;
  }
  return { text, fixed };
}

/** Edit distance between two strings (insertions, deletions, substitutions). */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** The anchor closest to `id` if it's clearly a typo of it (a few characters off, and no other as close). */
function closest(id: string, anchors: Set<string>): string | null {
  let best: string | null = null;
  let bestDistance = Math.max(1, Math.floor(id.length / 3)) + 1;
  let tie = false;
  for (const a of anchors) {
    const d = distance(id, a);
    if (d < bestDistance) [best, bestDistance, tie] = [a, d, false];
    else if (d === bestDistance) tie = true;
  }
  return tie ? null : best;
}

/** Cells in a table row as GFM counts them: every unescaped `|` separates, even inside code. */
function countCells(line: string): number {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return (s.match(/(?<!\\)\|/g)?.length ?? 0) + 1;
}

const DELIMITER_ROW = /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
/** Lines that start another block, which ends a table. */
const BLOCK_START = /^ {0,3}(#{1,6}\s|>|`{3,}|~{3,}|[-*+]\s|\d+[.)]\s)/;

/** Tables whose rows don't match the header, or whose header doesn't match the divider row. */
function lintTables(text: string, starts: number[]): MarkdownProblem[] {
  const lines = text.split("\n");
  const masked = maskCode(text).split("\n");
  const out: MarkdownProblem[] = [];
  const range = (i: number) => ({ from: starts[i], to: starts[i] + lines[i].length });
  for (let i = 0; i + 1 < lines.length; i++) {
    // A divider without "|" under a line with one is a setext heading, not a table.
    if (!masked[i].includes("|") || !masked[i + 1].includes("|") || !DELIMITER_ROW.test(masked[i + 1])) continue;
    const columns = countCells(lines[i]);
    const divider = countCells(lines[i + 1]);
    if (columns !== divider) {
      out.push({ ...range(i + 1), severity: "warning", rule: "table-columns", message: `The table header has ${columns} cells but the divider row has ${divider}, so it isn't shown as a table.` });
      i++;
      continue;
    }
    let j = i + 2;
    for (; j < lines.length && masked[j].trim() && !BLOCK_START.test(masked[j]); j++) {
      const cells = countCells(lines[j]);
      if (!lines[j].includes("|")) {
        out.push({
          ...range(j),
          severity: "warning",
          rule: "table-columns",
          message: "This line becomes a row of the table above. Add a blank line to end the table.",
          fix: { label: "Add Blank Line", edits: [{ at: 0, insert: "\n" }] },
        });
      } else if (cells !== columns) {
        out.push({
          ...range(j),
          severity: "warning",
          rule: "table-columns",
          message: `This row has ${cells} cell${cells === 1 ? "" : "s"} but the table has ${columns} columns: ${cells > columns ? "the extra cells aren't shown" : "the missing cells are left empty"}. (A | inside a cell needs a backslash: \\|.)`,
          // Missing cells can be added after a closing "|"; extra ones need a person to decide.
          ...(cells < columns && lines[j].trimEnd().endsWith("|") && {
            fix: { label: "Add Empty Cells", edits: [{ at: lines[j].trimEnd().length, insert: "  |".repeat(columns - cells) }] },
          }),
        });
      }
    }
    i = j - 1;
  }
  return out;
}

/** Footnote references without a definition (shown as plain text), and definitions nothing refers to. */
function lintFootnotes(text: string): MarkdownProblem[] {
  const masked = maskCode(text);
  const defined = new Map<string, { from: number; to: number }>();
  for (const m of masked.matchAll(/^ {0,3}\[\^([^\]\s]+)\]:/gm)) defined.set(m[1].toLowerCase(), { from: m.index!, to: m.index! + m[0].length });
  const used = new Set<string>();
  const out: MarkdownProblem[] = [];
  for (const m of masked.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) {
    const id = m[1].toLowerCase();
    used.add(id);
    if (!defined.has(id)) {
      out.push({
        from: m.index!,
        to: m.index! + m[0].length,
        severity: "warning",
        rule: "footnote",
        message: `Footnote [^${m[1]}] has no definition, so it's shown as plain text. Add a line “[^${m[1]}]: …”.`,
        fix: { label: "Add Definition", edits: [{ at: "end", insert: `[^${m[1]}]: ` }] },
      });
    }
  }
  for (const [id, at] of defined) {
    if (!used.has(id)) out.push({ ...at, severity: "info", rule: "footnote", message: `Footnote [^${id}] is defined but never referenced.` });
  }
  return out;
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
