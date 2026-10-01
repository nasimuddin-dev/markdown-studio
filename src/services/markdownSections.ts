/**
 * Splits a long Markdown document into sections the preview can parse one at
 * a time, so a large document shows its first screen without parsing the
 * rest. A section starts at an ATX heading (`#` … `######` at the start of a
 * line) outside fenced code, `$$` math and multi-line HTML (comments, `<pre>`,
 * `<script>`, `<style>`, `<textarea>`): a heading there ends any paragraph,
 * list or quote, so each section parses exactly as it would inside the whole.
 *
 * What a section can't see on its own is handled around it: reference-style
 * link definitions are collected once and given to every section, heading ids
 * are numbered across the document by the caller, and documents with
 * footnotes (whose numbering spans the document) aren't split.
 */

export interface MarkdownSection {
  /** The section's text. */
  source: string;
  /** 1-based line of the document the section starts on. */
  startLine: number;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^#{1,6}(?:[ \t]|$)/;
const MATH = /^ {0,3}\$\$/;
const HTML_OPEN = /^ {0,3}(?:<!--|<(pre|script|style|textarea)(?:[\s>]|$))/i;
const HTML_CLOSE: Record<string, RegExp> = {
  "<!--": /-->/,
  pre: /<\/pre>/i,
  script: /<\/script>/i,
  style: /<\/style>/i,
  textarea: /<\/textarea>/i,
};
/** A reference-style link definition on one line: `[label]: destination`. Not footnotes (`[^1]:`). */
const DEFINITION = /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\S/;
const FOOTNOTE = /\[\^[^\]\s]+\]/;

/**
 * Where each line stands: true for lines inside code, math or multi-line HTML
 * (or the lines opening and closing them), where no heading, section break or
 * link definition can start. Used by the outline's heading list too, so it
 * agrees with what the preview renders.
 */
export function protectedLines(lines: string[]): boolean[] {
  const out = new Array<boolean>(lines.length).fill(false);
  let fence: string | null = null;
  let math = false;
  let html: RegExp | null = null;
  lines.forEach((line, i) => {
    if (fence) {
      out[i] = true;
      const f = FENCE.exec(line);
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.slice(line.indexOf(f[1]) + f[1].length).trim()) fence = null;
      return;
    }
    if (math) {
      out[i] = true;
      if (MATH.test(line)) math = false;
      return;
    }
    if (html) {
      out[i] = true;
      if (html.test(line)) html = null;
      return;
    }
    const f = FENCE.exec(line);
    if (f) {
      out[i] = true;
      fence = f[1];
      return;
    }
    if (MATH.test(line)) {
      out[i] = true;
      // "$$ x $$" on one line opens and closes.
      math = !/\$\$.*\$\$/.test(line.trim());
      return;
    }
    const h = HTML_OPEN.exec(line);
    if (h) {
      out[i] = true;
      const close = HTML_CLOSE[h[1]?.toLowerCase() ?? "<!--"];
      // Closed on the same line (after the opening tag): nothing to carry over.
      const rest = line.slice(line.indexOf(h[0]) + h[0].length);
      if (!close.test(rest)) html = close;
    }
  });
  return out;
}

/** Whether a document uses footnotes (their numbering spans the document, so it isn't split). */
export function hasFootnotes(text: string): boolean {
  return FOOTNOTE.test(text);
}

/** The document's reference-style link definitions, one per line (given to every section). */
export function referenceDefinitions(text: string): string {
  const lines = text.split("\n");
  const shielded = protectedLines(lines);
  return lines.filter((line, i) => !shielded[i] && DEFINITION.test(line)).join("\n");
}

/**
 * Splits `text` at headings into sections of at least `minChars` characters
 * (smaller ones are joined with the next). Joining the sections' sources gives
 * back the text exactly.
 */
export function splitSections(text: string, minChars = 8000): MarkdownSection[] {
  const lines = text.split("\n");
  const shielded = protectedLines(lines);
  const sections: MarkdownSection[] = [];
  let start = 0;
  let size = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i > start && size >= minChars && !shielded[i] && ATX.test(lines[i])) {
      sections.push({ source: lines.slice(start, i).join("\n") + "\n", startLine: start + 1 });
      start = i;
      size = 0;
    }
    size += lines[i].length + 1;
  }
  sections.push({ source: lines.slice(start).join("\n"), startLine: start + 1 });
  return sections;
}
