import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  deleteColumn, deleteRow, deleteTableColumn, deleteTableRow, displayWidth, formatTable, formatTableAtCursor, insertColumnLeft,
  insertColumnRight, insertRowAbove, insertRowBelow, insertTableColumn, insertTableRow, moveTableCell, sortTableAtCursor, sortTableRows, splitRow,
} from "../src/features/tables";
import { applyCommand } from "../src/features/formatting";

describe("table formatting", () => {
  it("aligns columns and normalises the delimiter row", () => {
    const out = formatTable(["|Name|Qty|Note|", "|:-|-:|:-:|", "|Apple|10|fresh|", "|Kiwi|2|x|"]);
    expect(out).toEqual([
      "| Name  | Qty | Note  |",
      "| :---- | --: | :---: |",
      "| Apple |  10 | fresh |",
      "| Kiwi  |   2 |   x   |",
    ]);
  });

  it("fills missing cells and handles rows without outer pipes", () => {
    expect(formatTable(["a | b", "--- | ---", "1"])).toEqual(["| a   | b   |", "| --- | --- |", "| 1   |     |"]);
  });

  it("keeps escaped pipes and pipes in code spans inside a cell", () => {
    expect(splitRow("| a \\| b | `x|y` | c |")).toEqual(["a \\| b", "`x|y`", "c"]);
  });

  it("measures wide characters as two columns", () => {
    expect(displayWidth("日本")).toBe(4);
    expect(displayWidth("🚀a")).toBe(3);
    expect(formatTable(["| 日本 | a |", "|---|---|", "| x | y |"])).toEqual(["| 日本 | a   |", "| ---- | --- |", "| x    | y   |"]);
  });

  it("rejects non-tables", () => {
    expect(formatTable(["| a |", "| not a delimiter |"])).toBeNull();
    expect(formatTable(["| a |"])).toBeNull();
  });

  it("formats the table around the cursor and keeps the cursor in its cell", () => {
    const doc = "Intro\n\n|a|bb|\n|-|-|\n|ccc|d|\n\nAfter";
    const cursor = doc.indexOf("d|");
    let state = EditorState.create({ doc, selection: EditorSelection.cursor(cursor) });
    state = applyCommand(state, formatTableAtCursor);
    expect(state.doc.toString()).toBe("Intro\n\n| a   | bb  |\n| --- | --- |\n| ccc | d   |\n\nAfter");
    const line = state.doc.lineAt(state.selection.main.head);
    expect(line.text).toBe("| ccc | d   |");
    expect(state.selection.main.head - line.from).toBe(8);
  });
});

describe("sort table by column", () => {
  const table = ["| Name | Size |", "| --- | ---: |", "| beta | 1,200 |", "| Alpha | 90 |", "| gamma |  |", "| item10 | 3.5 |", "| item9 | 3 |"];

  it("sorts numbers numerically and puts empty cells last", () => {
    expect(sortTableRows(table, 1, false)!.slice(2)).toEqual(["| item9 | 3 |", "| item10 | 3.5 |", "| Alpha | 90 |", "| beta | 1,200 |", "| gamma |  |"]);
    expect(sortTableRows(table, 1, true)!.slice(2, 4)).toEqual(["| beta | 1,200 |", "| Alpha | 90 |"]);
  });

  it("sorts text in natural, case-insensitive order", () => {
    expect(sortTableRows(table, 0, false)!.slice(2).map((l) => l.split("|")[1].trim())).toEqual(["Alpha", "beta", "gamma", "item9", "item10"]);
  });

  it("sorts by the cursor's column and formats the table", () => {
    const doc = "Intro\n\n| Name | Qty |\n| --- | --- |\n| b | 2 |\n| a | 10 |\n";
    const cursor = doc.indexOf("Qty");
    const state = EditorState.create({ doc, selection: EditorSelection.cursor(cursor) });
    const out = applyCommand(state, sortTableAtCursor(true)).doc.toString();
    expect(out).toBe("Intro\n\n| Name | Qty |\n| ---- | --- |\n| a    | 10  |\n| b    | 2   |\n");
    expect(sortTableRows(["| a |", "| b |"], 0, false)).toBeNull();
  });
});

describe("table rows and columns", () => {
  const t = ["| A | B |", "| :-- | --: |", "| 1 | 2 |", "| 3 | 4 |"];

  it("inserts rows, never above the header", () => {
    expect(insertTableRow(t, 2, true)?.lines).toEqual(["| A | B |", "| :-- | --: |", "| 1 | 2 |", "|  |  |", "| 3 | 4 |"]);
    expect(insertTableRow(t, 2, false)?.lines[2]).toBe("|  |  |");
    expect(insertTableRow(t, 0, true)?.row).toBe(2);
    expect(insertTableRow(t, 0, false)).toBeNull();
    expect(insertTableRow(["no", "table"], 0, true)).toBeNull();
  });

  it("deletes body rows only", () => {
    expect(deleteTableRow(t, 2, 0)?.lines).toEqual(["| A | B |", "| :-- | --: |", "| 3 | 4 |"]);
    expect(deleteTableRow(t, 0, 0)).toBeNull();
    expect(deleteTableRow(t, 1, 0)).toBeNull();
    // Deleting the only body row moves the cursor to the header.
    expect(deleteTableRow(["| A |", "| - |", "| 1 |"], 2, 0)?.row).toBe(0);
  });

  it("inserts and deletes columns, keeping the other columns' alignment", () => {
    expect(insertTableColumn(t, 2, 0, true)?.lines).toEqual(["| A |  | B |", "| :-- | --- | --: |", "| 1 |  | 2 |", "| 3 |  | 4 |"]);
    expect(insertTableColumn(t, 2, 0, false)?.lines[1]).toBe("| --- | :-- | --: |");
    expect(deleteTableColumn(t, 2, 0)?.lines).toEqual(["| B |", "| --: |", "| 2 |", "| 4 |"]);
    expect(deleteTableColumn(["| A |", "| - |"], 0, 0)).toBeNull();
  });

  const run = (doc: string, at: string, command: typeof insertRowBelow) => {
    const state = applyCommand(EditorState.create({ doc, selection: EditorSelection.cursor(doc.indexOf(at)) }), command);
    const line = state.doc.lineAt(state.selection.main.head);
    return { doc: state.doc.toString(), line: line.text, column: state.selection.main.head - line.from };
  };
  const doc = ["|a|b|", "|-|-|", "|1|2|"].join("\n");
  const rows = (s: string) => s.split("\n");

  it("edits the table around the cursor, formats it and keeps the cursor in the right cell", () => {
    const below = run(doc, "2|", insertRowBelow);
    expect(rows(below.doc)).toEqual(["| a   | b   |", "| --- | --- |", "| 1   | 2   |", "|     |     |"]);
    expect(below).toMatchObject({ line: "|     |     |", column: 8 });
    expect(rows(run(doc, "1|", insertRowAbove).doc)[2]).toBe("|     |     |");
    const right = run(doc, "1|", insertColumnRight);
    expect(rows(right.doc)[0]).toBe("| a   |     | b   |");
    expect(right.column).toBe(8);
    expect(rows(run(doc, "1|", insertColumnLeft).doc)[0]).toBe("|     | a   | b   |");
    expect(rows(run(doc, "1|", deleteRow).doc)).toEqual(["| a   | b   |", "| --- | --- |"]);
    expect(rows(run(doc, "2|", deleteColumn).doc)).toEqual(["| a   |", "| --- |", "| 1   |"]);
  });

  it("does nothing outside a table", () => {
    const state = EditorState.create({ doc: "plain text" });
    expect(insertRowBelow({ state, dispatch: () => {} })).toBe(false);
  });
});

describe("Tab and Shift+Tab in tables", () => {
  const doc = ["|a|b|", "|-|-|", "|1|2|"].join("\n");
  const press = (text: string, at: number, forward: boolean) => {
    const state = applyCommand(EditorState.create({ doc: text, selection: EditorSelection.cursor(at) }), moveTableCell(forward));
    const { from, to } = state.selection.main;
    return { doc: state.doc.toString(), selected: state.sliceDoc(from, to), line: state.doc.lineAt(from).number };
  };

  it("formats the table and selects the next cell, skipping the delimiter row", () => {
    expect(press(doc, doc.indexOf("a"), true)).toMatchObject({ selected: "b", line: 1 });
    expect(press(doc, doc.indexOf("b"), true)).toMatchObject({ selected: "1", line: 3 });
    expect(press(doc, doc.indexOf("a"), true).doc.split("\n")[0]).toBe("| a   | b   |");
  });

  it("adds a row after the last cell", () => {
    const r = press(doc, doc.indexOf("2"), true);
    expect(r.doc.split("\n")).toEqual(["| a   | b   |", "| --- | --- |", "| 1   | 2   |", "|     |     |"]);
    expect(r).toMatchObject({ selected: "", line: 4 });
  });

  it("goes back with Shift+Tab, and stops at the first cell", () => {
    expect(press(doc, doc.indexOf("1"), false)).toMatchObject({ selected: "b", line: 1 });
    expect(press(doc, doc.indexOf("2"), false)).toMatchObject({ selected: "1", line: 3 });
    expect(press(doc, doc.indexOf("a"), false)).toMatchObject({ selected: "a", line: 1 });
  });

  it("leaves Tab to indentation outside tables and for multi-line selections", () => {
    const plain = EditorState.create({ doc: "text | with a pipe" });
    expect(moveTableCell(true)({ state: plain, dispatch: () => {} })).toBe(false);
    const multi = EditorState.create({ doc, selection: EditorSelection.range(0, doc.length) });
    expect(moveTableCell(true)({ state: multi, dispatch: () => {} })).toBe(false);
  });
});
