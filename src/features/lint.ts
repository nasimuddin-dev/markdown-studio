import GithubSlugger from "github-slugger";
import { WIKI_LINK, wikiLinkHref } from "../services/wikiLinks";
import { splitFrontMatter } from "../services/frontMatter";
import { INLINE_TAG } from "../services/tags";
import { extractHeadings } from "./outline";
import { resolveRelative } from "../services/paths";
import { fixTable } from "./tables";

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

/** Every check, by rule id, with the name shown when it's turned off. */
export const LINT_RULES: Record<string, string> = {
  "broken-link": "Links to missing files",
  "missing-image": "Missing images",
  "broken-anchor": "Links to missing headings",
  "empty-link": "Links without a destination",
  "duplicate-heading": "Duplicate headings",
  "multiple-h1": "More than one top-level heading",
  "heading-increment": "Skipped heading levels",
  "image-alt": "Images without alt text",
  "link-text": "Links without text",
  "table-columns": "Table rows that don't match the header",
  footnote: "Footnotes without a definition, or unused",
  reference: "Reference links without a definition, or unused",
  "heading-space": "# without a space",
  "setext-heading": "--- under a line of text",
  "list-space": "List items without a space",
  "emphasis-space": "Bold with spaces inside",
  "destination-spaces": "Paths with spaces",
  "front-matter": "Front matter without its closing ---",
  "tag-case": "A tag written in different capitalisations",
};

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
    // Right after another footnote or link definition, the next one follows on the next line.
    const body = text.endsWith("\n") ? text.slice(0, -1) : text;
    const afterDefinition = /^ {0,3}\[[^\]]+\]:/.test(body.slice(body.lastIndexOf("\n") + 1));
    const newlines = text.endsWith("\n\n") || !text ? 0 : (afterDefinition ? 1 : 2) - (text.endsWith("\n") ? 1 : 0);
    const gap = "\n".repeat(newlines);
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
  /** Length of the destination in the text when it differs from `target` (HTML entities decoded, or a wiki link's page). */
  sourceLength?: number;
  /** A wiki link (`[[Page]]`): `target` is the file it resolves to, not text that can be edited in place. */
  wiki?: boolean;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LINK = /(!?)\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s]*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g;
const DEFINITION = /^( {0,3}\[([^\]\n]+)\]:[ \t]*)(<[^>\n]*>|\S+)/gm;

/**
 * Returns the text with fenced code blocks and inline code spans blanked out
 * (same length), so link/heading rules never fire inside code.
 */
export function maskCode(text: string): string {
  // Every rule masks the same text during one lint run; keep the last result.
  if (text === lastMasked.text) return lastMasked.masked;
  const masked = computeMask(text);
  lastMasked = { text, masked };
  return masked;
}
let lastMasked = { text: "", masked: "" };

function computeMask(text: string): string {
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
/** Wiki links (`[[Page]]`), outside code, with the file they resolve to as target. */
export function findWikiLinks(text: string): LinkRef[] {
  const out: LinkRef[] = [];
  for (const m of maskCode(text).matchAll(WIKI_LINK)) {
    let target: string;
    try {
      target = decodeURI(wikiLinkHref(m[1]));
    } catch {
      continue;
    }
    out.push({ from: m.index!, to: m.index! + m[0].length, image: false, text: (m[2] ?? m[1]).trim(), target, targetFrom: m.index! + 2, sourceLength: m[1].length, wiki: true });
  }
  return out;
}

export function findAllLinks(text: string): LinkRef[] {
  return [...findLinks(text), ...findLinkDefinitions(text), ...findHtmlLinks(text), ...findWikiLinks(text)].sort((a, b) => a.from - b.from);
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
  problems.push(
    ...lintTables(text, starts),
    ...lintFootnotes(text),
    ...lintReferences(text),
    ...lintHeadingSyntax(text, starts),
    ...lintListsAndEmphasis(text, starts),
    ...lintSpacesInDestinations(text),
    ...lintFrontMatter(text),
    ...lintTagCase(text),
  );
  return problems.sort((a, b) => a.from - b.from);
}

/**
 * Applies every safe quick fix (not guesses such as a suggested anchor),
 * repeating while fixes reveal new ones (a heading moved up a level can make
 * the next one skip). Returns the fixed text and how many fixes were applied.
 */
export function fixAllProblems(text: string, skip: ReadonlySet<string> = new Set()): { text: string; fixed: number } {
  let fixed = 0;
  for (let pass = 0; pass < 6; pass++) {
    const fixes = lintMarkdown(text).filter((p) => p.fix && p.rule !== "broken-anchor" && !skip.has(p.rule));
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

/**
 * The file name in `names` that `name` is clearly a typo of: a name with the
 * same extension whose stem is a few characters off (and no other as close),
 * or the same stem with a mistyped extension. Case doesn't matter.
 */
export function closestFileName(name: string, names: string[]): string | null {
  const split = (n: string) => {
    const dot = n.lastIndexOf(".");
    return dot > 0 ? [n.slice(0, dot).toLowerCase(), n.slice(dot + 1).toLowerCase()] : [n.toLowerCase(), ""];
  };
  const [stem, ext] = split(name);
  const sameExt = new Map<string, string>();
  for (const n of names) {
    const [s, e] = split(n);
    if (e === ext) sameExt.set(s, n);
  }
  const near = closest(stem, new Set(sameExt.keys()));
  if (near) return sameExt.get(near)!;
  const sameStem = names.filter((n) => split(n)[0] === stem);
  return sameStem.length === 1 ? sameStem[0] : null;
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
  // The table starting at line `first`: its following lines that contain "|".
  const tableEnd = (first: number) => {
    let k = first + 1;
    while (k < lines.length && masked[k].includes("|") && masked[k].trim() && !BLOCK_START.test(masked[k])) k++;
    return k;
  };
  // Fix Table for a problem at `problemFrom`: replaces the whole table (edits are relative to the problem).
  const fixWholeTable = (first: number, problemFrom: number): ProblemFix | undefined => {
    const end = tableEnd(first);
    const fixed = fixTable(lines.slice(first, end));
    if (!fixed) return undefined;
    const from = starts[first];
    const to = starts[end - 1] + lines[end - 1].length;
    return { label: "Fix Table", edits: [{ at: from - problemFrom, remove: to - from, insert: fixed.join("\n") }] };
  };
  for (let i = 0; i + 1 < lines.length; i++) {
    // A divider without "|" under a line with one is a setext heading, not a table.
    if (!masked[i].includes("|") || !masked[i + 1].includes("|") || !DELIMITER_ROW.test(masked[i + 1])) continue;
    const columns = countCells(lines[i]);
    const divider = countCells(lines[i + 1]);
    if (columns !== divider) {
      out.push({
        ...range(i + 1),
        severity: "warning",
        rule: "table-columns",
        message: `The table header has ${columns} cells but the divider row has ${divider}, so it isn't shown as a table.`,
        fix: fixWholeTable(i, starts[i + 1]),
      });
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
          // Missing cells can be added after a closing "|"; otherwise Fix Table repairs the whole table
          // (extra cells are kept: the header gains columns).
          fix:
            cells < columns && lines[j].trimEnd().endsWith("|")
              ? { label: "Add Empty Cells", edits: [{ at: lines[j].trimEnd().length, insert: "  |".repeat(columns - cells) }] }
              : fixWholeTable(i, starts[j]),
        });
      }
    }
    i = j - 1;
  }
  return out;
}

/**
 * Heading mistakes: `#Title` (no space, so it's plain text) and `---` right
 * under a line of text, which makes that line a heading instead of drawing a
 * horizontal rule (setext headings are rare today, so this is only a hint).
 */
function isTagLine(line: string): boolean {
  const words = line.trim().split(/\s+/);
  if (!words.every((w) => new RegExp(`^${INLINE_TAG.source}$`, "u").test(w))) return false;
  return words.length > 1 || !/^#\p{Lu}\p{Ll}/u.test(words[0]);
}

function lintHeadingSyntax(text: string, starts: number[]): MarkdownProblem[] {
  const lines = text.split("\n");
  const masked = maskCode(text).split("\n");
  const out: MarkdownProblem[] = [];
  // Skip YAML front matter: its closing --- sits under text on purpose.
  const frontMatterEnd = lines[0]?.trim() === "---" ? lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l)) : -1;
  for (let i = frontMatterEnd + 1; i < lines.length; i++) {
    const m = /^( {0,3})(#{1,6})(?=[^\s#])/.exec(masked[i]);
    // An issue-style reference alone on a line ("#123") is left alone, and so is a
    // line of #tags ("#idea #work"), unless it's one capitalised word ("#Title").
    if (m && !/^#\d+$/.test(masked[i].trim()) && !isTagLine(masked[i])) {
      out.push({
        from: starts[i],
        to: starts[i] + lines[i].length,
        severity: "warning",
        rule: "heading-space",
        message: `This isn't a heading: "${m[2]}" needs a space after it.`,
        fix: { label: "Add Space", edits: [{ at: m[1].length + m[2].length, insert: " " }] },
      });
    }
    const above = masked[i - 1];
    if (i > 0 && /^ {0,3}-{3,}\s*$/.test(masked[i]) && above?.trim() && !/^ {0,3}([-*+]|\d+[.)])\s|^ {0,3}(#|>|\||`{3}|~{3})/.test(above) && !/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(above)) {
      out.push({
        from: starts[i],
        to: starts[i] + lines[i].length,
        severity: "info",
        rule: "setext-heading",
        message: "This --- makes the line above a heading. For a horizontal rule, put a blank line before it.",
        fix: { label: "Make It a Rule", edits: [{ at: 0, insert: "\n" }] },
      });
    }
  }
  return out;
}

/**
 * `[text](my file.md)` and `![alt](my image.png)` aren't links: a destination
 * with spaces must be wrapped in `<…>` (or the spaces written as %20). A
 * quoted title after the destination (`(url "Title")`) is fine.
 */
function lintSpacesInDestinations(text: string): MarkdownProblem[] {
  const out: MarkdownProblem[] = [];
  for (const m of maskCode(text).matchAll(/(!?)\[([^\]\n]*)\]\(([^()<>"'\n]*?\s[^()<>"'\n]*?)\)/g)) {
    const dest = m[3].trim();
    // `(url "title")` / `(url 'title')` are excluded by the character class; skip empty or single-word ones.
    if (!dest || !/\s/.test(dest)) continue;
    const open = m.index! + m[1].length + m[2].length + 3; // after "]("
    out.push({
      from: m.index!,
      to: m.index! + m[0].length,
      severity: "warning",
      rule: "destination-spaces",
      message: `The ${m[1] ? "image" : "link"} isn't recognised because its path has spaces. Wrap it in <…>: (<${dest}>).`,
      fix: { label: "Wrap in <…>", edits: [{ at: open - m.index!, remove: m[3].length, insert: `<${dest}>` }] },
    });
  }
  return out;
}

const LIST_ITEM = /^ *([-*+]|\d{1,9}[.)])[ \t]/;

/**
 * List items without a space after the marker ("-item", "2.item", which are
 * plain text; only flagged next to a real list item, so "-10°C" is left alone)
 * and emphasis with spaces inside the markers ("** bold **", which isn't bold).
 */
function lintListsAndEmphasis(text: string, starts: number[]): MarkdownProblem[] {
  const lines = text.split("\n");
  const masked = maskCode(text).split("\n");
  const out: MarkdownProblem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^( *)([-*+]|\d{1,9}[.)])(?=[^\s\d*+.)-])/.exec(masked[i]);
    // "*Note:* text" is emphasis, not a list marker.
    const emphasis = m?.[2] === "*" && masked[i].indexOf("*", m[1].length + 1) > 0;
    if (m && !emphasis && (LIST_ITEM.test(masked[i - 1] ?? "") || LIST_ITEM.test(masked[i + 1] ?? ""))) {
      out.push({
        from: starts[i],
        to: starts[i] + lines[i].length,
        severity: "warning",
        rule: "list-space",
        message: `This isn't a list item: "${m[2]}" needs a space after it.`,
        fix: { label: "Add Space", edits: [{ at: m[1].length + m[2].length, insert: " " }] },
      });
    }
    // "** bold**", "__ bold __": pair the markers left to right, as Markdown does, and check the
    // text between each pair (in the original line, so code inside bold counts as text).
    for (const marker of ["**", "__"]) {
      // An odd number of backslashes before a marker escapes it (`\**` is text, `\\**` is a marker).
      const escaped = (index: number) => (/\\*$/.exec(masked[i].slice(0, index))![0].length % 2) === 1;
      const at = [...masked[i].matchAll(marker === "**" ? /(?<!\*)\*\*(?!\*)/g : /(?<![_\w])__(?!_)|(?<!_)__(?![_\w])/g)]
        .map((x) => x.index!)
        .filter((index) => !escaped(index));
      for (let k = 0; k + 1 < at.length; k += 2) {
        const inner = lines[i].slice(at[k] + 2, at[k + 1]);
        if (!inner.trim() || inner === inner.trim()) continue;
        const from = starts[i] + at[k];
        out.push({
          from,
          to: from + inner.length + 4,
          severity: "warning",
          rule: "emphasis-space",
          message: `Spaces just inside "${marker}" stop it from being bold.`,
          fix: { label: "Remove Spaces", edits: [{ at: 0, remove: inner.length + 4, insert: marker + inner.trim() + marker }] },
        });
      }
    }
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

/**
 * Front matter that's never closed: the document starts with `---` and
 * `key: value` lines but no closing `---`, so it shows as a rule and text.
 * The fix adds the closing line after the properties.
 */
function lintFrontMatter(text: string): MarkdownProblem[] {
  const lines = text.split("\n");
  if (!/^---[ \t]*$/.test(lines[0] ?? "") || !/^[\w-]+:(\s|$)/.test(lines[1] ?? "")) return [];
  if (lines.slice(1).some((l) => /^(---|\.\.\.)[ \t]*$/.test(l))) return [];
  let last = 1;
  while (last + 1 < lines.length && /^([\w-]+:(\s|$)|[ \t]+\S|- )/.test(lines[last + 1])) last++;
  const end = lines.slice(0, last + 1).join("\n").length;
  return [
    {
      from: 0,
      to: 3,
      severity: "warning",
      rule: "front-matter",
      message: "The front matter has no closing ---, so it shows as a line and text. Add --- after its last property.",
      fix: { label: "Close Front Matter", edits: [{ at: end, insert: "\n---" }] },
    },
  ];
}

/** Inline `#tags` outside front matter, code, links and headings, with the offset of their `#`. */
export function inlineTags(text: string): Array<{ tag: string; from: number; line: number }> {
  const fm = splitFrontMatter(text);
  // Blank the front matter, keeping offsets and line numbers.
  let masked = maskCode(fm ? fm.raw.replace(/[^\n]/g, " ") + text.slice(fm.raw.length) : text);
  for (const link of findAllLinks(masked)) masked = masked.slice(0, link.from) + " ".repeat(link.to - link.from) + masked.slice(link.to);
  const out: Array<{ tag: string; from: number; line: number }> = [];
  let offset = 0;
  masked.split("\n").forEach((line, i) => {
    if (!/^ {0,3}#{1,6}(\s|$)/.test(line)) {
      for (const m of line.matchAll(INLINE_TAG)) out.push({ tag: m[1], from: offset + m.index, line: i + 1 });
    }
    offset += line.length + 1;
  });
  return out;
}

/**
 * An inline tag written differently from its most common spelling in the
 * document (`#Idea` next to `#idea`). Tags match either way, but lists show
 * one spelling; the fix uses the common one.
 */
function lintTagCase(text: string): MarkdownProblem[] {
  if (!text.includes("#")) return [];
  const tags = inlineTags(text);
  const spellings = new Map<string, Map<string, number>>();
  for (const { tag } of tags) {
    const key = tag.toLowerCase();
    const counts = spellings.get(key) ?? new Map<string, number>();
    spellings.set(key, counts.set(tag, (counts.get(tag) ?? 0) + 1));
  }
  const out: MarkdownProblem[] = [];
  for (const t of tags) {
    const counts = spellings.get(t.tag.toLowerCase())!;
    if (counts.size < 2) continue;
    const common = [...counts].reduce((best, c) => (c[1] > best[1] ? c : best))[0];
    if (t.tag === common) continue;
    out.push({
      from: t.from,
      to: t.from + 1 + t.tag.length,
      severity: "info",
      rule: "tag-case",
      message: `#${t.tag} is written #${common} elsewhere in this document. They're the same tag; one spelling keeps lists tidy.`,
      fix: { label: `Change to #${common}`, edits: [{ at: 1, remove: t.tag.length, insert: common }] },
    });
  }
  return out;
}

/** How reference labels match: case-insensitive, with runs of whitespace as one space. */
const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Reference-style links (`[text][id]`, `[id][]`) whose definition is missing,
 * so they show as plain text, and definitions (`[id]: path`) that nothing uses.
 * A bare `[id]` counts as a use but isn't flagged without a definition, since
 * square brackets are also ordinary text (and task list boxes).
 */
function lintReferences(text: string): MarkdownProblem[] {
  const masked = maskCode(text);
  const definitions = findLinkDefinitions(text).filter((d) => !d.text.startsWith("^"));
  const defined = new Set(definitions.map((d) => normalizeLabel(d.text)));
  const used = new Set<string>();
  const out: MarkdownProblem[] = [];
  // Most documents have no references at all: skip the scans then.
  if (!definitions.length && !masked.includes("][")) return out;
  for (const m of masked.matchAll(/(!?)\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\[([^\]\n]*)\]/g)) {
    if (masked[m.index! - 1] === "\\") continue;
    const label = (m[3].trim() ? m[3] : m[2]).trim();
    const id = normalizeLabel(label);
    if (!id || id.startsWith("^")) continue;
    used.add(id);
    if (!defined.has(id)) {
      out.push({
        from: m.index!,
        to: m.index! + m[0].length,
        severity: "warning",
        rule: "reference",
        message: `Link reference [${label}] has no definition, so it's shown as plain text. Add a line “[${label}]: address”.`,
        fix: { label: "Add Definition", edits: [{ at: "end", insert: `[${label}]: ` }] },
      });
    }
  }
  if (!definitions.length) return out;
  // A label defined twice: links use the first definition, the other is ignored.
  const first = new Map<string, number>();
  for (const d of definitions) {
    const id = normalizeLabel(d.text);
    const at = first.get(id);
    if (at === undefined) first.set(id, d.from);
    else {
      const line = text.slice(0, at).split("\n").length;
      out.push({ from: d.from, to: d.to, severity: "warning", rule: "reference", message: `Link definition [${d.text}] is defined again; links use the one on line ${line}.` });
    }
  }
  // Shortcut references (`[id]`), and labels inside other links' text.
  for (const m of masked.matchAll(/\[([^[\]\n]+)\](?![(:])/g)) used.add(normalizeLabel(m[1]));
  for (const d of definitions) {
    if (!used.has(normalizeLabel(d.text))) {
      out.push({ from: d.from, to: d.to, severity: "info", rule: "reference", message: `Link definition [${d.text}] is never used.` });
    }
  }
  return out;
}

/** Local link/image targets worth checking on disk (relative or absolute paths). */
export function localTargets(links: LinkRef[], docPath: string) {
  return links
    // A drive letter (C:/notes/a.md) is a path, not a URL scheme.
    .filter((l) => l.target && !l.target.startsWith("#") && (!/^[a-z][a-z0-9+.-]*:/i.test(l.target) || /^[a-zA-Z]:[\\/]/.test(l.target)))
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
  /** File names in a folder, to suggest the one a broken link probably meant. */
  filesIn?: (dir: string) => Promise<string[] | null>,
): Promise<MarkdownProblem[]> {
  if (!docPath) return [];
  const problems: MarkdownProblem[] = [];
  const cache = new Map<string, Promise<boolean | null>>();
  const listings = new Map<string, Promise<string[] | null>>();
  const suggest = async (path: string): Promise<string | null> => {
    if (!filesIn) return null;
    const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const dir = path.slice(0, cut);
    if (!listings.has(dir)) listings.set(dir, filesIn(dir).catch(() => null));
    const names = await listings.get(dir);
    return names?.length ? closestFileName(path.slice(cut + 1), names) : null;
  };
  for (const { link, path } of localTargets(findAllLinks(text), docPath)) {
    if (!path) {
      problems.push({ from: link.from, to: link.to, severity: "warning", rule: "broken-link", message: "Link points outside the file system root." });
      continue;
    }
    if (!cache.has(path)) cache.set(path, exists(path).catch(() => null));
    if ((await cache.get(path)) === false) {
      // A likely typo in the file name: offer the closest name in that folder (not for HTML links).
      const near = link.sourceLength === undefined ? await suggest(path) : null;
      const cut = link.target.search(/[?#]/);
      const pathPart = cut < 0 ? link.target : link.target.slice(0, cut);
      const nameFrom = pathPart.lastIndexOf("/") + 1;
      const bracketed = text[link.targetFrom - 1] === "<";
      problems.push({
        from: link.from,
        to: link.to,
        severity: "warning",
        rule: link.image ? "missing-image" : "broken-link",
        message: `${link.image ? "Image" : "Linked file"} not found: ${link.target}${near ? `. Did you mean “${near}”?` : ""}`,
        ...(near && {
          fix: {
            label: `Change to ${near}`,
            edits: [{ at: link.targetFrom - link.from + nameFrom, remove: pathPart.length - nameFrom, insert: bracketed ? near : encodeURI(near).replace(/\(/g, "%28").replace(/\)/g, "%29") }],
          },
        }),
      });
    }
  }
  return problems;
}
