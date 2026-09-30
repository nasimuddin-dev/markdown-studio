import type { EditorState, StateCommand } from "@codemirror/state";

type Align = "left" | "center" | "right" | "none";

const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line) || (/\|/.test(line) && line.trim() !== "");
const DELIMITER_CELL = /^\s*:?-{1,}:?\s*$/;

/** Splits a table row into cells, honouring escaped pipes and code spans. */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (ch === "`") {
      inCode = !inCode;
      cur += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Display width: East Asian wide/fullwidth characters and emoji count as 2 columns. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x300 && cp <= 0x36f) continue; // combining marks
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x3fffd);
    w += wide ? 2 : 1;
  }
  return w;
}

function alignOf(cell: string): Align {
  const c = cell.trim();
  const l = c.startsWith(":");
  const r = c.endsWith(":");
  return l && r ? "center" : r ? "right" : l ? "left" : "none";
}

function pad(text: string, width: number, align: Align) {
  const gap = width - displayWidth(text);
  if (gap <= 0) return text;
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") return " ".repeat(Math.floor(gap / 2)) + text + " ".repeat(Math.ceil(gap / 2));
  return text + " ".repeat(gap);
}

/**
 * Formats a GFM table: pads every column to the same width and normalises
 * the delimiter row. Returns `null` if the lines are not a valid table.
 */
export function formatTable(lines: string[]): string[] | null {
  if (lines.length < 2) return null;
  const rows = lines.map(splitRow);
  const delimiter = rows[1];
  if (!delimiter.every((c) => DELIMITER_CELL.test(c))) return null;
  const indent = /^\s*/.exec(lines[0])![0];
  const cols = Math.max(...rows.map((r) => r.length));
  const aligns: Align[] = Array.from({ length: cols }, (_, i) => (delimiter[i] ? alignOf(delimiter[i]) : "none"));
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(3, ...rows.filter((_, ri) => ri !== 1).map((r) => displayWidth(r[i] ?? ""))),
  );
  return rows.map((r, ri) => {
    const cells = Array.from({ length: cols }, (_, i) => {
      if (ri === 1) {
        const a = aligns[i];
        const dashes = "-".repeat(widths[i] - (a === "center" ? 2 : a === "none" ? 0 : 1));
        return a === "center" ? `:${dashes}:` : a === "left" ? `:${dashes}` : a === "right" ? `${dashes}:` : dashes;
      }
      return pad(r[i] ?? "", widths[i], aligns[i]);
    });
    return `${indent}| ${cells.join(" | ")} |`;
  });
}

/** A divider cell, also as mistyped: en/em dashes, `=`, `_`, spaces around colons. */
const LOOSE_DIVIDER_CELL = /^\s*:?\s*[-–—=_]+\s*:?\s*$/;
const isDividerRow = (cells: string[]) => cells.length > 0 && cells.every((c) => LOOSE_DIVIDER_CELL.test(c)) && cells.some((c) => c.trim());

/** Escapes `|` inside code spans, which GFM would otherwise treat as a cell boundary. */
function escapePipesInCode(cell: string): string {
  return cell.replace(/(`+)([\s\S]*?)\1/g, (_span, ticks: string, code: string) => ticks + code.replace(/(?<!\\)\|/g, "\\|") + ticks);
}

/**
 * Repairs a table typed with mistakes, then formats it: a missing or
 * malformed divider row (wrong number of cells, `===`, en/em dashes) is
 * rebuilt keeping any alignment colons; a table that starts with its divider
 * gets a header; short rows get empty cells and long rows keep their cells
 * (the header gains columns, named "Column N"); rows without outer `|` get
 * them; a `|` inside code is escaped. Blank lines are removed. Returns null
 * when there's nothing table-like (fewer than two columns anywhere).
 */
export function fixTable(lines: string[]): string[] | null {
  const indent = /^\s*/.exec(lines.find((l) => l.trim()) ?? "")![0];
  let rows = lines.filter((l) => l.trim()).map((l) => splitRow(l).map(escapePipesInCode));
  if (!rows.length) return null;
  // The first divider-like row gives the alignment; any others are dropped.
  const dividerAt = rows.findIndex(isDividerRow);
  const divider = dividerAt >= 0 ? rows[dividerAt] : [];
  rows = rows.filter((r) => !isDividerRow(r));
  if (dividerAt === 0) rows.unshift([]); // the table started with its divider: no header
  const cols = Math.max(...rows.map((r) => r.length), divider.length);
  if (cols < 2 && !lines.some((l) => l.includes("|"))) return null;
  const header = Array.from({ length: cols }, (_, i) => rows[0]?.[i]?.trim() || `Column ${i + 1}`);
  const aligns = Array.from({ length: cols }, (_, i) => {
    const c = (divider[i] ?? "").replace(/\s+/g, "");
    return c.startsWith(":") && c.endsWith(":") && c.length > 1 ? ":-:" : c.startsWith(":") ? ":--" : c.endsWith(":") ? "--:" : "---";
  });
  const row = (cells: string[]) => `${indent}| ${Array.from({ length: cols }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  const out = [row(header), row(aligns), ...rows.slice(1).map(row)];
  return formatTable(out) ?? out;
}

/** Command: Format → Fix Table. Works on the selected lines, or the table around the cursor. */
export const fixTableAtCursor: StateCommand = ({ state, dispatch }) => {
  const sel = state.selection.main;
  let first: number;
  let last: number;
  if (!sel.empty) {
    first = state.doc.lineAt(sel.from).number;
    last = state.doc.lineAt(sel.to > sel.from && state.doc.lineAt(sel.to).from === sel.to ? sel.to - 1 : sel.to).number;
  } else {
    const range = tableAround(state, state.doc.lineAt(sel.head).number);
    if (!range) return false;
    ({ first, last } = range);
  }
  const lines: string[] = [];
  for (let n = first; n <= last; n++) lines.push(state.doc.line(n).text);
  const fixed = fixTable(lines);
  if (!fixed) return false;
  const from = state.doc.line(first).from;
  const to = state.doc.line(last).to;
  const insert = fixed.join("\n");
  if (insert === state.sliceDoc(from, to)) return true;
  dispatch(state.update({ changes: { from, to, insert }, selection: { anchor: from + 2 }, scrollIntoView: true, userEvent: "input.format" }));
  return true;
};

/**
 * Formats every valid table in a document (outside fenced code), as Format
 * Table does; anything that isn't a valid table is left as it is.
 */
export function formatAllTables(text: string): string {
  const lines = text.split("\n");
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence || !isTableLine(lines[i])) continue;
    let end = i;
    while (end + 1 < lines.length && isTableLine(lines[end + 1]) && !/^ {0,3}(`{3,}|~{3,})/.test(lines[end + 1])) end++;
    const formatted = formatTable(lines.slice(i, end + 1));
    if (formatted) lines.splice(i, end + 1 - i, ...formatted);
    i = end;
  }
  return lines.join("\n");
}

/** Line range (1-based, inclusive) of the table around `line`, if any. */
export function tableAround(state: EditorState, lineNo: number): { first: number; last: number } | null {
  const doc = state.doc;
  if (!isTableLine(doc.line(lineNo).text)) return null;
  let first = lineNo;
  let last = lineNo;
  while (first > 1 && isTableLine(doc.line(first - 1).text)) first--;
  while (last < doc.lines && isTableLine(doc.line(last + 1).text)) last++;
  return { first, last };
}

/** Command: format the table containing the cursor (Format → Format Table). */
export const formatTableAtCursor: StateCommand = ({ state, dispatch }) => {
  const lineNo = state.doc.lineAt(state.selection.main.head).number;
  const range = tableAround(state, lineNo);
  if (!range) return false;
  const lines: string[] = [];
  for (let n = range.first; n <= range.last; n++) lines.push(state.doc.line(n).text);
  const formatted = formatTable(lines);
  if (!formatted) return false;
  const from = state.doc.line(range.first).from;
  const to = state.doc.line(range.last).to;
  const insert = formatted.join("\n");
  if (insert === state.sliceDoc(from, to)) return true;
  // Keep the cursor in the same row and roughly the same cell.
  const cursorLine = lineNo - range.first;
  const head = state.selection.main.head - state.doc.line(lineNo).from;
  const cellIndex = (state.doc.line(lineNo).text.slice(0, head).match(/\|/g) ?? []).length;
  const rowStart = from + formatted.slice(0, cursorLine).reduce((n, l) => n + l.length + 1, 0);
  const row = formatted[cursorLine];
  let pipes = 0;
  let offset = row.length;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "|" && ++pipes === cellIndex) {
      offset = Math.min(i + 2, row.length);
      break;
    }
  }
  dispatch(state.update({ changes: { from, to, insert }, selection: { anchor: rowStart + offset }, userEvent: "input.format" }));
  return true;
};

/** Which cell (0-based) of a table row a column offset falls in. */
function cellIndexAt(line: string, column: number): number {
  let index = 0;
  let inCode = false;
  const leading = line.trimStart().startsWith("|");
  for (let i = 0; i < Math.min(column, line.length); i++) {
    const ch = line[i];
    if (ch === "\\") i++;
    else if (ch === "`") inCode = !inCode;
    else if (ch === "|" && !inCode) index++;
  }
  return Math.max(0, leading ? index - 1 : index);
}

const NUMBER = /^[-+]?[$€£¥]?\s*[-+]?\d[\d,]*(\.\d+)?\s*%?$/;
const toNumber = (s: string) => Number(s.replace(/[$€£¥,%\s]/g, ""));
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Sorts the body rows of a table by one column: numerically when every
 * non-empty cell is a number (1,200, 3.5%, $9), otherwise in natural text
 * order. Empty cells always go last; equal rows keep their order.
 */
export function sortTableRows(lines: string[], column: number, descending: boolean): string[] | null {
  if (lines.length < 3 || !splitRow(lines[1]).every((c) => DELIMITER_CELL.test(c))) return null;
  const body = lines.slice(2).map((line) => ({ line, cell: (splitRow(line)[column] ?? "").trim() }));
  const filled = body.filter((r) => r.cell !== "");
  const numeric = filled.length > 0 && filled.every((r) => NUMBER.test(r.cell));
  const compare = (a: string, b: string) => (numeric ? toNumber(a) - toNumber(b) : collator.compare(a, b));
  const sorted = [...filled].sort((a, b) => (descending ? -1 : 1) * compare(a.cell, b.cell));
  return [lines[0], lines[1], ...sorted.map((r) => r.line), ...body.filter((r) => r.cell === "").map((r) => r.line)];
}

/** Command: sort the table around the cursor by the cursor's column, then format it. */
export function sortTableAtCursor(descending: boolean): StateCommand {
  return ({ state, dispatch }) => {
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    const range = tableAround(state, line.number);
    if (!range) return false;
    const lines: string[] = [];
    for (let n = range.first; n <= range.last; n++) lines.push(state.doc.line(n).text);
    const sorted = sortTableRows(lines, cellIndexAt(line.text, head - line.from), descending);
    const formatted = sorted && formatTable(sorted);
    if (!formatted) return false;
    const from = state.doc.line(range.first).from;
    const to = state.doc.line(range.last).to;
    // The cursor goes to the start of the header row, where the column is still visible.
    dispatch(state.update({ changes: { from, to, insert: formatted.join("\n") }, selection: { anchor: from }, userEvent: "input.sortTable" }));
    return true;
  };
}

/** A change to a table's structure: new lines, and the row and cell to put the cursor in. */
type TableEdit = { lines: string[]; row: number; cell: number } | null;

const isTable = (lines: string[]) => lines.length >= 2 && splitRow(lines[1]).every((c) => DELIMITER_CELL.test(c));
const columnCount = (lines: string[]) => Math.max(...lines.map((l) => splitRow(l).length));
const indentOf = (line: string) => /^\s*/.exec(line)![0];
const joinRow = (indent: string, cells: string[]) => `${indent}| ${cells.join(" | ")} |`;

/**
 * Inserts an empty row above or below table line `row` (0 = header,
 * 1 = delimiter). Rows can't go above the header; "below" the header or the
 * delimiter row adds the first body row.
 */
export function insertTableRow(lines: string[], row: number, below: boolean): TableEdit {
  if (!isTable(lines) || (row <= 1 && !below)) return null;
  const at = row <= 1 ? 2 : below ? row + 1 : row;
  const empty = joinRow(indentOf(lines[0]), Array.from({ length: columnCount(lines) }, () => ""));
  return { lines: [...lines.slice(0, at), empty, ...lines.slice(at)], row: at, cell: 0 };
}

/** Deletes body row `row`; the header and delimiter rows stay. */
export function deleteTableRow(lines: string[], row: number, cell: number): TableEdit {
  if (!isTable(lines) || row <= 1) return null;
  const next = [...lines.slice(0, row), ...lines.slice(row + 1)];
  // The row that took its place, or the one above; the header if no body rows are left.
  const at = Math.min(row, next.length - 1);
  return { lines: next, row: at === 1 ? 0 : at, cell };
}

/** Inserts an empty column left or right of column `col` (0-based). */
export function insertTableColumn(lines: string[], row: number, col: number, right: boolean): TableEdit {
  if (!isTable(lines)) return null;
  const cols = columnCount(lines);
  const at = Math.min(right ? col + 1 : col, cols);
  const next = lines.map((line, i) => {
    const cells = splitRow(line);
    while (cells.length < cols) cells.push("");
    cells.splice(at, 0, i === 1 ? "---" : "");
    return joinRow(indentOf(line), cells);
  });
  return { lines: next, row, cell: at };
}

/** Deletes column `col`; a table keeps at least one column. */
/** Sets the alignment of column `col` (the divider row's colons). */
export function alignTableColumn(lines: string[], row: number, col: number, align: "left" | "center" | "right"): TableEdit {
  if (!isTable(lines)) return null;
  const cols = columnCount(lines);
  if (col >= cols) return null;
  const divider = splitRow(lines[1]);
  while (divider.length < cols) divider.push("---");
  divider[col] = align === "left" ? ":--" : align === "center" ? ":-:" : "--:";
  const next = [...lines];
  next[1] = joinRow(indentOf(lines[1]), divider);
  return { lines: next, row, cell: col };
}

/** Swaps column `col` with its neighbour to the left (-1) or right (+1), alignment included. */
export function moveTableColumn(lines: string[], row: number, col: number, delta: -1 | 1): TableEdit {
  if (!isTable(lines)) return null;
  const cols = columnCount(lines);
  const to = col + delta;
  if (col >= cols || to < 0 || to >= cols) return null;
  const next = lines.map((line, i) => {
    const cells = splitRow(line);
    while (cells.length < cols) cells.push(i === 1 ? "---" : "");
    [cells[col], cells[to]] = [cells[to], cells[col]];
    return joinRow(indentOf(line), cells);
  });
  return { lines: next, row, cell: to };
}

export function deleteTableColumn(lines: string[], row: number, col: number): TableEdit {
  if (!isTable(lines)) return null;
  const cols = columnCount(lines);
  if (cols <= 1 || col >= cols) return null;
  const next = lines.map((line) => {
    const cells = splitRow(line);
    while (cells.length < cols) cells.push("");
    cells.splice(col, 1);
    return joinRow(indentOf(line), cells);
  });
  return { lines: next, row, cell: Math.min(col, cols - 2) };
}

/** Offset of the start of cell `cell`'s text in a formatted row ("| a | b |"). */
function cellTextOffset(row: string, cell: number): number {
  let pipes = 0;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "|" && row[i - 1] !== "\\" && pipes++ === cell) return Math.min(i + 2, row.length);
  }
  return row.length;
}

/**
 * Runs a structural edit on the table around the cursor, formats the result
 * and moves the cursor into the cell the edit points to.
 */
function editTableAtCursor(edit: (lines: string[], row: number, cell: number) => TableEdit, userEvent: string): StateCommand {
  return ({ state, dispatch }) => {
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    const range = tableAround(state, line.number);
    if (!range) return false;
    const lines: string[] = [];
    for (let n = range.first; n <= range.last; n++) lines.push(state.doc.line(n).text);
    const result = edit(lines, line.number - range.first, cellIndexAt(line.text, head - line.from));
    const formatted = result && formatTable(result.lines);
    if (!result || !formatted) return false;
    const from = state.doc.line(range.first).from;
    const to = state.doc.line(range.last).to;
    const rowStart = from + formatted.slice(0, result.row).reduce((n, l) => n + l.length + 1, 0);
    const anchor = rowStart + cellTextOffset(formatted[result.row], result.cell);
    dispatch(state.update({ changes: { from, to, insert: formatted.join("\n") }, selection: { anchor }, userEvent }));
    return true;
  };
}

export const insertRowAbove = editTableAtCursor((l, row, cell) => {
  const r = insertTableRow(l, row, false);
  return r && { ...r, cell };
}, "input.tableRow");
export const insertRowBelow = editTableAtCursor((l, row, cell) => {
  const r = insertTableRow(l, row, true);
  return r && { ...r, cell };
}, "input.tableRow");
export const deleteRow = editTableAtCursor(deleteTableRow, "delete.tableRow");
export const insertColumnLeft = editTableAtCursor((l, row, cell) => insertTableColumn(l, row, cell, false), "input.tableColumn");
export const insertColumnRight = editTableAtCursor((l, row, cell) => insertTableColumn(l, row, cell, true), "input.tableColumn");
export const deleteColumn = editTableAtCursor(deleteTableColumn, "delete.tableColumn");
export const alignColumn = (align: "left" | "center" | "right") =>
  editTableAtCursor((l, row, cell) => alignTableColumn(l, row, cell, align), "input.tableAlign");
export const moveColumn = (delta: -1 | 1) => editTableAtCursor((l, row, cell) => moveTableColumn(l, row, cell, delta), "move.tableColumn");

/** The text of cell `cell` in a formatted row ("| a   | b |"), as [start, end) offsets. */
function cellTextRange(row: string, cell: number): [number, number] {
  const start = cellTextOffset(row, cell);
  let end = start;
  while (end < row.length && !(row[end] === "|" && row[end - 1] !== "\\")) end++;
  while (end > start && row[end - 1] === " ") end--;
  return [start, end];
}

/**
 * Tab / Shift+Tab in a table: formats it and selects the text of the next or
 * previous cell, skipping the delimiter row. Tab in the last cell adds a row.
 * Outside a table (or with a multi-line selection) it does nothing, so Tab
 * indents as usual.
 */
export function moveTableCell(forward: boolean): StateCommand {
  return ({ state, dispatch }) => {
    const sel = state.selection.main;
    const line = state.doc.lineAt(sel.head);
    if (state.doc.lineAt(sel.anchor).number !== line.number) return false;
    const range = tableAround(state, line.number);
    if (!range) return false;
    let lines: string[] = [];
    for (let n = range.first; n <= range.last; n++) lines.push(state.doc.line(n).text);
    let formatted = formatTable(lines);
    if (!formatted) return false;
    const cols = splitRow(formatted[0]).length;
    let row = line.number - range.first;
    let cell = Math.min(cellIndexAt(line.text, sel.head - line.from), cols - 1);
    if (forward) {
      if (row === 1) [row, cell] = [2, -1];
      if (++cell >= cols) [row, cell] = [row + 1, 0];
      if (row === 1) row = 2;
      if (row >= formatted.length) {
        lines = insertTableRow(formatted, formatted.length - 1, true)!.lines;
        formatted = formatTable(lines)!;
      }
    } else {
      if (row === 1) [row, cell] = [0, cols];
      if (--cell < 0) [row, cell] = [row - 1, cols - 1];
      if (row === 1) row = 0;
      if (row < 0) [row, cell] = [0, 0];
    }
    const from = state.doc.line(range.first).from;
    const to = state.doc.line(range.last).to;
    const rowStart = from + formatted.slice(0, row).reduce((n, l) => n + l.length + 1, 0);
    const [start, end] = cellTextRange(formatted[row], cell);
    const insert = formatted.join("\n");
    dispatch(
      state.update({
        changes: insert === state.sliceDoc(from, to) ? undefined : { from, to, insert },
        selection: { anchor: rowStart + start, head: rowStart + end },
        scrollIntoView: true,
        userEvent: "select.tableCell",
      }),
    );
    return true;
  };
}
