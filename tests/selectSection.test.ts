import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { selectSection } from "../src/features/sections";

const doc = "# Title\n\nIntro.\n\n## One\n\nText 1.\n\n### One.A\n\nDeep.\n\n## Two\n\nText 2.\n";

function select(state: EditorState) {
  let next = state;
  const ran = selectSection({ state, dispatch: (tr) => (next = tr.state) });
  return { ran, state: next, text: next.sliceDoc(next.selection.main.from, next.selection.main.to) };
}

describe("Select Section", () => {
  it("selects the section at the cursor, then its parent when run again", () => {
    const first = select(EditorState.create({ doc, selection: { anchor: doc.indexOf("Deep") } }));
    expect(first.text).toBe("### One.A\n\nDeep.");
    const second = select(first.state);
    expect(second.text).toBe("## One\n\nText 1.\n\n### One.A\n\nDeep.");
    const third = select(second.state);
    expect(third.text).toBe(doc.trimEnd());
  });

  it("does nothing above the first heading", () => {
    expect(select(EditorState.create({ doc: "text\n# H", selection: { anchor: 1 } })).ran).toBe(false);
  });
});
