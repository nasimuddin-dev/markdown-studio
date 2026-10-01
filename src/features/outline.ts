import GithubSlugger from "github-slugger";
import { protectedLines } from "../services/markdownSections";

export interface Heading {
  level: number;
  text: string;
  /** 1-based line number in the document. */
  line: number;
}

const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/;
const SETEXT_H2 = /^ {0,3}-+[ \t]*$/;

/** Strips inline Markdown so headings read as plain text in the outline. */
export function plainHeadingText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, "$2")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Extracts ATX (`## Title`) and setext (`Title\n===`) headings, ignoring
 * front matter and what the preview doesn't treat as headings: fenced code,
 * `$$` math blocks and multi-line HTML such as comments and `<pre>`.
 */
export function extractHeadings(text: string): Heading[] {
  const lines = text.split("\n");
  const headings: Heading[] = [];
  const shielded = protectedLines(lines);
  let start = 0;

  // YAML front matter at the very top.
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && (l.trim() === "---" || l.trim() === "..."));
    if (end > 0) start = end + 1;
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (shielded[i]) continue;

    const atx = ATX.exec(line);
    if (atx) {
      const text = plainHeadingText(atx[2] ?? "");
      if (text) headings.push({ level: atx[1].length, text, line: i + 1 });
      continue;
    }
    const next = lines[i + 1];
    if (next !== undefined && line.trim() && !/^ {0,3}([-*+]|\d+[.)]|>)\s/.test(line)) {
      if (SETEXT_H1.test(next)) headings.push({ level: 1, text: plainHeadingText(line), line: i + 1 });
      else if (SETEXT_H2.test(next) && !/^\s*$/.test(line)) headings.push({ level: 2, text: plainHeadingText(line), line: i + 1 });
      if (SETEXT_H1.test(next) || SETEXT_H2.test(next)) i++;
    }
  }
  return headings;
}

/** Index of the heading that contains `line` (the last heading at or above it), or -1. */
export function currentHeadingIndex(headings: Heading[], line: number): number {
  let idx = -1;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].line <= line) idx = i;
    else break;
  }
  return idx;
}

/**
 * The `#anchor` of each heading, as the preview and GitHub create them
 * (duplicates get -1, -2, …), in the same order as `headings`.
 */
export function headingSlugs(headings: Heading[]): string[] {
  const slugger = new GithubSlugger();
  return headings.map((h) => slugger.slug(h.text));
}
