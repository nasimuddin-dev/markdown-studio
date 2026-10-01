import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import { reflowLines, reflowParagraph, unwrapParagraph } from "../src/features/reflow";

/** Runs a command on `doc` with the cursor at "|" (or a selection between two "|"). */
function run(command: StateCommand, doc: string) {
  const marks = [...doc.matchAll(/\|/g)].map((m) => m.index!);
  const text = doc.replace(/\|/g, "");
  const selection = marks.length === 2 ? EditorSelection.single(marks[0], marks[1] - 1) : EditorSelection.single(marks[0] ?? 0);
  let state = EditorState.create({ doc: text, selection });
  const changed = command({ state, dispatch: (tr) => (state = tr.state) });
  return { changed, text: state.doc.toString(), state };
}
const at = (width: number) => reflowParagraph(() => width);

describe("reflowLines", () => {
  it("wraps words at the column", () => {
    expect(reflowLines(["one two three four five six"], 13)).toEqual(["one two three", "four five six"]);
  });

  it("joins short lines", () => {
    expect(reflowLines(["one", "two", "three"], 80)).toEqual(["one two three"]);
  });

  it("keeps a word longer than the column on its own line", () => {
    expect(reflowLines(["a https://example.com/a/very/long/address b"], 10)).toEqual(["a", "https://example.com/a/very/long/address", "b"]);
  });

  it("indents list item continuation under the text", () => {
    expect(reflowLines(["- alpha beta gamma delta"], 12)).toEqual(["- alpha beta", "  gamma", "  delta"]);
    expect(reflowLines(["10. alpha beta gamma"], 14)).toEqual(["10. alpha beta", "    gamma"]);
    expect(reflowLines(["- [ ] alpha beta gamma"], 16)).toEqual(["- [ ] alpha beta", "      gamma"]);
  });

  it("repeats quote markers on every line", () => {
    expect(reflowLines(["> alpha beta gamma delta"], 14)).toEqual(["> alpha beta", "> gamma delta"]);
    expect(reflowLines(["> - alpha beta", "> gamma"], 80)).toEqual(["> - alpha beta gamma"]);
  });

  it("keeps hard line breaks", () => {
    expect(reflowLines(["one two  ", "three", "four\\", "five"], 80)).toEqual(["one two  ", "three four\\", "five"]);
  });

  it("never starts a line with a word that would make it a list, heading or quote", () => {
    expect(reflowLines(["costs 5 - or 6 # or > 7"], 8)).toEqual(["costs 5 -", "or 6 #", "or > 7"]);
    expect(reflowLines(["chapter 1. begins"], 8)).toEqual(["chapter 1.", "begins"]);
  });
});

describe("Reflow Paragraph", () => {
  it("reflows only the paragraph at the cursor", () => {
    const { text } = run(at(20), "first para\nstays\n\nsecond one is |long enough to wrap\nhere\n\nthird");
    expect(text).toBe("first para\nstays\n\nsecond one is long\nenough to wrap here\n\nthird");
  });

  it("keeps the cursor after the same word", () => {
    const { state } = run(at(20), "second one is long|\nenough to\nwrap");
    expect(state.doc.sliceString(0, state.selection.main.head)).toBe("second one is long");
  });

  it("reflows every paragraph in a selection, and list items separately", () => {
    const { text } = run(at(80), "|a\nb\n\n- one\n  two\n- three\n  four|\n\nc\nd");
    expect(text).toBe("a b\n\n- one two\n- three four\n\nc\nd");
  });

  it("leaves code, math, headings, tables, front matter and HTML alone", () => {
    const doc = ["---", "title: a", "b: c", "---", "", "# A heading that is long", "", "```", "code that is", "long", "```", "", "$$", "x", "y", "$$", "", "| a | b |", "| - | - |", "| 1 | 2 |", "", "<div>", "html", "</div>", "", "Setext heading", "words", "==="];
    const { changed } = run(at(10), "|" + doc.join("\n") + "|");
    expect(changed).toBe(false);
  });

  it("does nothing on a blank line", () => {
    expect(run(at(10), "a\n|\nb").changed).toBe(false);
  });

  it("Unwrap Paragraph joins the lines", () => {
    const { text } = run(unwrapParagraph, "> one\n> |two\n> three\n\nfour\nfive");
    expect(text).toBe("> one two three\n\nfour\nfive");
  });
});
