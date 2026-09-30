import { EditorSelection, type EditorState, type StateCommand, type Text } from "@codemirror/state";
import { parseDelimited, rowsToMarkdownTable } from "../services/convert/csv";

/**
 * Line and case commands of the Edit menu. Each works on the selected lines
 * (or the whole document when nothing is selected) and is one undoable edit.
 */

/** The line range of the main selection, or the whole document when it's empty. */
function lineRange(state: EditorState): { from: number; to: number; lines: string[] } {
  const { doc } = state;
  const sel = state.selection.main;
  if (sel.empty) return { from: 0, to: doc.length, lines: doc.toString().split("\n") };
  const first = doc.lineAt(sel.from);
  // A selection that ends at the start of a line doesn't include that line.
  const lastPos = sel.to > sel.from && doc.lineAt(sel.to).from === sel.to ? sel.to - 1 : sel.to;
  const last = doc.lineAt(lastPos);
  return { from: first.from, to: last.to, lines: doc.sliceString(first.from, last.to).split("\n") };
}

function replaceLines(transform: (lines: string[]) => string[]): StateCommand {
  return ({ state, dispatch }) => {
    const { from, to, lines } = lineRange(state);
    const insert = transform(lines).join("\n");
    if (insert === state.doc.sliceString(from, to)) return false;
    dispatch(state.update({ changes: { from, to, insert }, selection: EditorSelection.range(from, from + insert.length), userEvent: "input.transform" }));
    return true;
  };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Sorts lines alphabetically (numbers in natural order: 2 before 10). */
export const sortLines = (descending: boolean) =>
  replaceLines((lines) => [...lines].sort((a, b) => (descending ? -1 : 1) * collator.compare(a, b)));

/** Removes repeated lines, keeping the first of each; blank lines are kept. */
export const removeDuplicateLines = replaceLines((lines) => {
  const seen = new Set<string>();
  return lines.filter((l) => {
    if (!l.trim()) return true;
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });
});

/** Joins the selected lines (or the cursor's line and the next one) with single spaces. */
export const joinLines: StateCommand = ({ state, dispatch }) => {
  const { doc } = state;
  const sel = state.selection.main;
  const first = doc.lineAt(sel.from);
  const last = sel.empty ? (first.number < doc.lines ? doc.line(first.number + 1) : first) : doc.lineAt(sel.to);
  if (last.number === first.number) return false;
  const lines = doc.sliceString(first.from, last.to).split("\n");
  const insert = lines.map((l, i) => (i ? l.trim() : l.trimEnd())).filter((l, i) => i === 0 || l).join(" ");
  dispatch(state.update({ changes: { from: first.from, to: last.to, insert }, userEvent: "input.transform" }));
  return true;
};

/**
 * Turns the selected lines of comma-, tab-, semicolon- or pipe-separated text
 * into a Markdown table (the first line becomes the header). Does nothing
 * unless every line splits into the same number (2 or more) of cells.
 */
export const convertSelectionToTable: StateCommand = ({ state, dispatch }) => {
  if (state.selection.main.empty) return false;
  const { from, to, lines } = lineRange(state);
  const text = lines.join("\n").trim();
  const rows = parseDelimited(text);
  if (rows.length < 1 || rows[0].length < 2 || rows.some((r) => r.length !== rows[0].length)) return false;
  const insert = rowsToMarkdownTable(rows);
  dispatch(state.update({ changes: { from, to, insert }, selection: EditorSelection.cursor(from + insert.length), scrollIntoView: true, userEvent: "input.transform" }));
  return true;
};

type Case = "upper" | "lower" | "title";

function recase(text: string, to: Case): string {
  if (to === "upper") return text.toLocaleUpperCase();
  if (to === "lower") return text.toLocaleLowerCase();
  return text.toLocaleLowerCase().replace(/(^|[\s\-–—("“[])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase());
}

function wordAt(doc: Text, pos: number): { from: number; to: number } | null {
  const line = doc.lineAt(pos);
  const at = pos - line.from;
  const before = /[\p{L}\p{N}_'’-]*$/u.exec(line.text.slice(0, at))![0].length;
  const after = /^[\p{L}\p{N}_'’-]*/u.exec(line.text.slice(at))![0].length;
  return before + after ? { from: pos - before, to: pos + after } : null;
}

/** Changes the case of every selection (or the word at each cursor). */
export function changeCase(to: Case): StateCommand {
  return ({ state, dispatch }) => {
    const changes = state.selection.ranges.flatMap((r) => {
      const range = r.empty ? wordAt(state.doc, r.head) : r;
      if (!range) return [];
      const text = state.doc.sliceString(range.from, range.to);
      const insert = recase(text, to);
      return insert === text ? [] : [{ from: range.from, to: range.to, insert }];
    });
    if (!changes.length) return false;
    dispatch(state.update({ changes, userEvent: "input.transform" }));
    return true;
  };
}
