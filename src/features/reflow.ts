import { EditorSelection, type ChangeSpec, type StateCommand } from "@codemirror/state";
import { protectedLines } from "../services/markdownSections";

/**
 * Reflow Paragraph (hard wrap) and Unwrap Paragraph: the paragraph at the cursor,
 * or every paragraph the selection touches, re-broken at a column (or joined into
 * one line). List markers, quote markers and hard line breaks are kept; code,
 * math, HTML, tables, headings, rules and link definitions are left alone.
 */

/** Quote markers, indentation, and a list marker (with a task box). */
const PREFIX = /^((?:[ \t]*>[ \t]?)*)([ \t]*)((?:[-*+]|\d{1,9}[.)])(?:[ \t]+\[[ xX]\])?(?:[ \t]+|$))?/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/;
const SETEXT_EQUALS = /^ {0,3}=+[ \t]*$/;
const DEFINITION = /^ {0,3}\[[^\]]+\]:/;
const TABLE_DELIMITER = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$|^[ \t]*\|[ \t]*:?-+:?[ \t]*\|?[ \t]*$/;
/**
 * Words that would change what a line means if they started one: list, quote
 * and heading markers, rules, fences, HTML, math and link definitions. A line
 * never breaks before them (it runs a little long instead).
 */
const UNSAFE_START = /^(?:[-+*>|]|#{1,6}|\d{1,9}[.)]|=+|-+|_+|\*+)$|^(?:`{3}|~{3}|<[A-Za-z!/?]|\[[^\]]*\]:|\$\$)/;

interface Prefix {
  quote: string;
  indent: string;
  marker: string;
}

function prefixOf(line: string): Prefix {
  const m = PREFIX.exec(line)!;
  return { quote: m[1], indent: m[2], marker: m[3] ?? "" };
}

/** The line without its quote markers, so ">" lines are judged by their content. */
const content = (line: string) => line.slice(prefixOf(line).quote.length);
const quoteDepth = (quote: string) => (quote.match(/>/g) ?? []).length;

/** Lines that are never part of a paragraph to reflow (and so end one). */
function isBreak(line: string, isProtected: boolean): boolean {
  if (isProtected) return true;
  const c = content(line);
  return !c.trim() || HEADING.test(c) || RULE.test(c) || SETEXT_EQUALS.test(c) || DEFINITION.test(c) || TABLE_DELIMITER.test(c);
}

/** Front matter at the top of the document counts as protected too. */
function protectedWithFrontMatter(lines: string[]): boolean[] {
  const out = protectedLines(lines);
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && (l.trim() === "---" || l.trim() === "..."));
    if (end > 0) for (let i = 0; i <= end; i++) out[i] = true;
  }
  return out;
}

/** Paragraphs as [first, last] line indexes (0-based), covering lines first..last of the range. */
function paragraphsIn(lines: string[], prot: boolean[], from: number, to: number): [number, number][] {
  const starts = (i: number) =>
    i === 0 || isBreak(lines[i - 1], prot[i - 1]) || !!prefixOf(lines[i]).marker ||
    quoteDepth(prefixOf(lines[i]).quote) !== quoteDepth(prefixOf(lines[i - 1]).quote);
  const out: [number, number][] = [];
  let i = from;
  // Back up to the start of the paragraph the range begins in.
  while (i > 0 && !isBreak(lines[i], prot[i]) && !starts(i)) i--;
  while (i <= to) {
    if (isBreak(lines[i], prot[i])) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < lines.length && !isBreak(lines[end + 1], prot[end + 1]) && !starts(end + 1)) end++;
    out.push([i, end]);
    i = end + 1;
  }
  return out;
}

/** A paragraph that isn't plain text: a setext heading, a table, HTML or indented code. */
function leaveAlone(para: string[], next: string | undefined): boolean {
  // "---" or "===" right under text makes it a heading.
  if (next !== undefined && SETEXT.test(content(next))) return true;
  const first = prefixOf(para[0]);
  if (!first.marker && first.indent.replace(/\t/g, "    ").length >= 4) return true;
  return para.some((l) => content(l).trimStart().startsWith("|") || /^[ \t]*</.test(content(l)));
}

/** Re-breaks one paragraph's lines at `width` columns (Infinity joins them). */
export function reflowLines(para: string[], width: number): string[] {
  const first = prefixOf(para[0]);
  const lead = first.quote + first.indent + first.marker;
  const rest = first.quote + first.indent.replace(/\t/g, "    ") + " ".repeat(first.marker.length);
  // Hard line breaks (two trailing spaces or a backslash) end a run of words.
  const runs: { words: string[]; hardBreak: string }[] = [{ words: [], hardBreak: "" }];
  para.forEach((line, i) => {
    const text = i === 0 ? line.slice(lead.length) : content(line).trimStart();
    runs[runs.length - 1].words.push(...text.split(/[ \t]+/).filter(Boolean));
    const hard = /(?: {2,}|\\)$/.exec(text);
    if (hard && i < para.length - 1) {
      runs[runs.length - 1].hardBreak = hard[0].startsWith(" ") ? "  " : "\\";
      // A backslash break is a word's last character; trailing spaces were split off.
      if (runs[runs.length - 1].hardBreak === "\\") {
        const w = runs[runs.length - 1].words;
        w[w.length - 1] = w[w.length - 1].slice(0, -1);
        if (!w[w.length - 1]) w.pop();
      }
      runs.push({ words: [], hardBreak: "" });
    }
  });
  const out: string[] = [];
  for (const run of runs) {
    let line = "";
    for (const word of run.words) {
      const prefix = out.length === 0 && !line ? lead : rest;
      if (!line) line = prefix + word;
      else if (line.length + 1 + word.length <= width || UNSAFE_START.test(word)) line += " " + word;
      else {
        out.push(line);
        line = rest + word;
      }
    }
    if (!line) line = out.length === 0 ? lead.trimEnd() : rest.trimEnd();
    out.push(line + run.hardBreak);
  }
  return out;
}

/** Characters before `pos` that aren't white space, to put the cursor back after the same word. */
function inkBefore(text: string, pos: number): number {
  return text.slice(0, pos).replace(/\s/g, "").length;
}
function positionAfterInk(text: string, ink: number): number {
  if (ink === 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i]) && ++seen === ink) return i + 1;
  }
  return text.length;
}

function reflowCommand(width: () => number): StateCommand {
  return ({ state, dispatch }) => {
    const { doc } = state;
    const lines = doc.toString().split("\n");
    const prot = protectedWithFrontMatter(lines);
    const sel = state.selection.main;
    const fromLine = doc.lineAt(sel.from).number - 1;
    const lastPos = sel.to > sel.from && doc.lineAt(sel.to).from === sel.to ? sel.to - 1 : sel.to;
    const toLine = doc.lineAt(lastPos).number - 1;
    const changes: ChangeSpec[] = [];
    let cursor: number | null = null;
    let shift = 0;
    for (const [a, b] of paragraphsIn(lines, prot, fromLine, toLine)) {
      const para = lines.slice(a, b + 1);
      if (leaveAlone(para, lines[b + 1])) continue;
      const from = doc.line(a + 1).from;
      const to = doc.line(b + 1).to;
      const before = doc.sliceString(from, to);
      const after = reflowLines(para, width()).join("\n");
      if (sel.empty && sel.head >= from && sel.head <= to) {
        cursor = from + shift + positionAfterInk(after, inkBefore(before, sel.head - from));
      }
      if (after !== before) changes.push({ from, to, insert: after });
      shift += after.length - before.length;
    }
    if (!changes.length) return false;
    const set = state.changes(changes);
    const selection = sel.empty
      ? EditorSelection.cursor(cursor ?? set.mapPos(sel.head))
      : EditorSelection.range(set.mapPos(sel.from, -1), set.mapPos(sel.to, 1));
    dispatch(state.update({ changes: set, selection, userEvent: "input.transform", scrollIntoView: true }));
    return true;
  };
}

/** Wraps the paragraph(s) at `width()` columns. */
export const reflowParagraph = (width: () => number) => reflowCommand(width);
/** Joins each paragraph's lines into one line. */
export const unwrapParagraph: StateCommand = reflowCommand(() => Infinity);
