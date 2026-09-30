import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { paragraphAt } from "../src/features/paragraphFocus";

describe("the paragraph being written", () => {
  const doc = "# Title\n\nFirst line\nsecond line\n\n\nLast";
  const state = EditorState.create({ doc });
  const at = (text: string) => paragraphAt(state, doc.indexOf(text));

  it("is the run of non-blank lines around the cursor", () => {
    expect(at("second")).toEqual({ first: 3, last: 4 });
    expect(at("Title")).toEqual({ first: 1, last: 1 });
    expect(at("Last")).toEqual({ first: 7, last: 7 });
  });

  it("is just the line itself on a blank line", () => {
    expect(paragraphAt(state, doc.indexOf("\n\n\n") + 1)).toEqual({ first: 5, last: 5 });
  });
});
