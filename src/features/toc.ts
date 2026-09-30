import GithubSlugger from "github-slugger";
import type { StateCommand } from "@codemirror/state";
import { extractHeadings } from "./outline";

export const TOC_START = "<!-- toc -->";
export const TOC_END = "<!-- tocstop -->";
export const TOC_BLOCK = /<!-- toc -->[\s\S]*?<!-- tocstop -->/;

/**
 * Builds a nested, linked table of contents from the document's headings
 * (anchors match the preview's GitHub-style heading ids). A lone H1 title at
 * the top is left out, and only the top `maxDepth` heading levels (default:
 * the top level and the one below it) are listed. Headings inside an existing
 * TOC block are ignored.
 */
export function buildToc(markdown: string, maxDepth = 2): string {
  const withoutToc = markdown.replace(TOC_BLOCK, (m) => m.replace(/[^\n]/g, " "));
  let headings = extractHeadings(withoutToc);
  const slugger = new GithubSlugger();
  const withSlugs = headings.map((h) => ({ ...h, slug: slugger.slug(h.text) }));
  const h1s = withSlugs.filter((h) => h.level === 1);
  let items = withSlugs;
  if (h1s.length === 1 && withSlugs[0]?.level === 1) items = withSlugs.slice(1);
  headings = items;
  if (!items.length) return `${TOC_START}\n${TOC_END}`;
  const top = Math.min(...items.map((h) => h.level));
  const lines = items
    .filter((h) => h.level - top < maxDepth)
    .map((h) => `${"  ".repeat(h.level - top)}- [${h.text.replace(/([[\]])/g, "\\$1")}](#${h.slug})`);
  return `${TOC_START}\n${lines.join("\n")}\n${TOC_END}`;
}

const hasToc = (markdown: string) => TOC_BLOCK.test(markdown);

/** Regenerates an existing TOC block (used on save). Returns the text unchanged if there is none. */
export function updateToc(markdown: string): string {
  if (!hasToc(markdown)) return markdown;
  return markdown.replace(TOC_BLOCK, buildToc(markdown));
}

/** Command: insert a TOC at the cursor, or refresh the existing one. */
export const insertOrUpdateToc: StateCommand = ({ state, dispatch }) => {
  const text = state.doc.toString();
  const existing = TOC_BLOCK.exec(text);
  if (existing) {
    const toc = buildToc(text);
    dispatch(state.update({ changes: { from: existing.index, to: existing.index + existing[0].length, insert: toc }, userEvent: "input.format" }));
    return true;
  }
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const before = line.text.trim() ? "\n\n" : "";
  const toc = buildToc(text);
  const insert = `${before}${toc}\n\n`;
  const at = line.text.trim() ? line.to : line.from;
  dispatch(state.update({ changes: { from: at, insert }, selection: { anchor: at + insert.length }, scrollIntoView: true, userEvent: "input.format" }));
  return true;
};
