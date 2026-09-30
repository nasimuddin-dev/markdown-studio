import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { fixTable, fixTableAtCursor } from "../src/features/tables";
import { lintMarkdown } from "../src/features/lint";

const fix = (text: string) => fixTable(text.split("\n"))!.join("\n");
const tableProblems = (text: string) => lintMarkdown(text).filter((p) => p.rule === "table-columns");

describe("Fix Table", () => {
  it("adds a missing divider row and outer pipes", () => {
    expect(fix("Name | Qty\nApples | 3")).toBe("| Name   | Qty |\n| ------ | --- |\n| Apples | 3   |");
  });

  it("rebuilds a divider with the wrong number of cells or mistyped dashes, keeping alignment", () => {
    expect(fix("| a | b | c |\n| :-- | --: |\n| 1 | 2 | 3 |")).toBe("| a   |   b | c   |\n| :-- | --: | --- |\n| 1   |   2 | 3   |");
    expect(fix("| a | b |\n| ——— | === |\n| 1 | 2 |")).toBe("| a   | b   |\n| --- | --- |\n| 1   | 2   |");
    expect(fix("| a | b |\n| :-: | - |\n| 1 | 2 |").split("\n")[1]).toBe("| :-: | --- |");
  });

  it("pads short rows and keeps extra cells by widening the header", () => {
    const fixed = fix("| a | b |\n| - | - |\n| 1 |\n| 1 | 2 | 3 |");
    expect(fixed).toBe("| a   | b   | Column 3 |\n| --- | --- | -------- |\n| 1   |     |          |\n| 1   | 2   | 3        |");
    expect(tableProblems(fixed)).toEqual([]);
  });

  it("adds a header to a table that starts with its divider, and drops blank lines and extra dividers", () => {
    expect(fix("|---|---|\n| 1 | 2 |\n\n| 3 | 4 |\n|---|---|")).toBe("| Column 1 | Column 2 |\n| -------- | -------- |\n| 1        | 2        |\n| 3        | 4        |");
  });

  it("escapes | inside code so GFM keeps the cell", () => {
    const fixed = fix("| cmd | note |\n| - | - |\n| `a|b` | pipe |");
    expect(fixed.split("\n")[2]).toBe("| `a\\|b` | pipe |");
    expect(tableProblems(fixed)).toEqual([]);
  });

  it("fixes the table around the cursor, or the selected lines", () => {
    const doc = "Intro\n\nName | Qty\nApples | 3\n\nAfter";
    const at = (anchor: number, head = anchor) => {
      const state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
      let out = state;
      const ok = fixTableAtCursor({ state, dispatch: (tr) => (out = tr.state) });
      return { ok, text: out.doc.toString() };
    };
    const fixedDoc = "Intro\n\n| Name   | Qty |\n| ------ | --- |\n| Apples | 3   |\n\nAfter";
    expect(at(doc.indexOf("Apples")).text).toBe(fixedDoc);
    expect(at(doc.indexOf("Name"), doc.indexOf("3") + 1).text).toBe(fixedDoc);
    expect(at(0).ok).toBe(false); // not in a table
  });
});
