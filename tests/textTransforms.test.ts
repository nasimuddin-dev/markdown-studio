import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import { changeCase, joinLines, removeDuplicateLines, sortLines } from "../src/features/textTransforms";

/** Runs a command on `doc` with the selection from `from` to `to` (or a cursor). */
function run(command: StateCommand, doc: string, from = 0, to = from, ranges?: Array<[number, number]>) {
  const selection = ranges ? EditorSelection.create(ranges.map(([a, b]) => EditorSelection.range(a, b))) : EditorSelection.single(from, to);
  const state = EditorState.create({ doc, selection, extensions: EditorState.allowMultipleSelections.of(true) });
  let out = state;
  const ok = command({ state, dispatch: (tr) => (out = tr.state) });
  return { ok, text: out.doc.toString() };
}

describe("text transforms", () => {
  it("sorts the selected lines, or the whole document, in natural order", () => {
    expect(run(sortLines(false), "b10\na\nb2").text).toBe("a\nb2\nb10");
    expect(run(sortLines(true), "b10\na\nb2").text).toBe("b10\nb2\na");
    // Only lines 2–3 (the selection ends at the start of line 4, which is left alone).
    expect(run(sortLines(false), "z\ny\nx\nw", 2, 6).text).toBe("z\nx\ny\nw");
    expect(run(sortLines(false), "a\nb").ok).toBe(false);
  });

  it("removes duplicate lines but keeps blank ones", () => {
    expect(run(removeDuplicateLines, "a\nb\na\n\n\nb\nc").text).toBe("a\nb\n\n\nc");
  });

  it("joins lines with single spaces", () => {
    expect(run(joinLines, "one  \n   two\nthree", 0).text).toBe("one two\nthree");
    expect(run(joinLines, "a\n\n  b\nc", 0, 6).text).toBe("a b\nc");
    expect(run(joinLines, "last", 2).ok).toBe(false);
  });

  it("changes case of selections or the word at the cursor", () => {
    expect(run(changeCase("upper"), "hello world", 0, 5).text).toBe("HELLO world");
    expect(run(changeCase("lower"), "HELLO World", 7).text).toBe("HELLO world");
    expect(run(changeCase("title"), "the quick-brown fox's tale", 0, 26).text).toBe("The Quick-Brown Fox's Tale");
    expect(run(changeCase("upper"), "ab cd", 0, 0, [[0, 2], [3, 5]]).text).toBe("AB CD");
    expect(run(changeCase("upper"), "  ", 1).ok).toBe(false);
  });
});
