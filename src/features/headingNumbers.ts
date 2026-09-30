import type { StateCommand } from "@codemirror/state";
import { extractHeadings } from "./outline";
import { buildToc, TOC_BLOCK, updateToc } from "./toc";

/**
 * Heading numbers for structured documents (specifications, policies):
 * `## 1. Introduction`, `### 1.1 Purpose`, `#### 1.1.1 Scope`. A lone H1
 * title at the top isn't numbered, like in the table of contents.
 *
 * Existing numbers are recognised only when they contain a dot (`1.`, `2.3`),
 * so headings such as "2024 Roadmap" or "10 Tips" keep their text.
 */
const EXISTING = /^(?:\d+\.(?:\d+\.?)*)[ \t]+/;
const ATX_PREFIX = /^ {0,3}#{1,6}[ \t]+/;
const INDENT = /^ {0,3}/;

/** Replaces (or, with `number` null, removes) the number at the start of a heading line. */
function renumberLine(line: string, number: string | null): string {
  const prefix = (ATX_PREFIX.exec(line) ?? INDENT.exec(line)!)[0];
  const rest = line.slice(prefix.length).replace(EXISTING, "");
  return prefix + (number ? `${number} ` : "") + rest;
}

/** Line number (1-based) → the heading line with its new number, for every heading that changes. */
function numberedLines(text: string, remove: boolean): Map<number, string> {
  const lines = text.split("\n");
  let headings = extractHeadings(text);
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 1 && headings[0]?.level === 1) headings = headings.slice(1);
  const out = new Map<number, string>();
  if (!headings.length) return out;
  const top = Math.min(...headings.map((h) => h.level));
  const counters: number[] = [];
  for (const h of headings) {
    const depth = h.level - top;
    counters[depth] = (counters[depth] ?? 0) + 1;
    counters.length = depth + 1;
    // A skipped level (## then ####) counts as 1: 1.1.1, not 1.0.1.
    const parts = Array.from({ length: depth + 1 }, (_, i) => counters[i] || 1);
    const number = depth === 0 ? `${parts[0]}.` : parts.join(".");
    const line = lines[h.line - 1];
    const next = renumberLine(line, remove ? null : number);
    if (next !== line) out.set(h.line, next);
  }
  return out;
}

/** Numbers (or un-numbers) the headings of a Markdown text; an existing table of contents is refreshed. */
export function numberHeadings(text: string, remove = false): string {
  const changed = numberedLines(text, remove);
  const lines = text.split("\n").map((l, i) => changed.get(i + 1) ?? l);
  return updateToc(lines.join("\n"));
}

function headingCommand(remove: boolean): StateCommand {
  return ({ state, dispatch }) => {
    const text = state.doc.toString();
    const changed = numberedLines(text, remove);
    if (!changed.size) return false;
    const changes = [...changed].map(([n, insert]) => {
      const line = state.doc.line(n);
      return { from: line.from, to: line.to, insert };
    });
    // Refresh a table of contents in the same undo step (it never contains heading lines).
    const numbered = state.update({ changes }).state.doc.toString();
    const toc = TOC_BLOCK.exec(text);
    const all = toc ? [...changes, { from: toc.index, to: toc.index + toc[0].length, insert: buildToc(numbered) }] : changes;
    dispatch(state.update({ changes: all, scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

/** Command: number the headings (1., 1.1, 1.1.1); running it again updates the numbers. */
export const numberHeadingsCommand = headingCommand(false);
/** Command: remove heading numbers. */
export const removeHeadingNumbersCommand = headingCommand(true);
