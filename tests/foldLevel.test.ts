import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { foldedRanges } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { foldToLevel } from "../src/features/foldLevel";

const doc = "# Title\n\nIntro.\n\n## One\n\nText 1.\n\n### One.A\n\nDeep.\n\n## Two\n\nText 2.\n\n```\n# not a heading\n```\n";

function fold(level: number, state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] })) {
  foldToLevel(level)({ state, dispatch: (tr) => (state = tr.state) });
  const folded: string[] = [];
  foldedRanges(state).between(0, state.doc.length, (from) => {
    folded.push(state.doc.lineAt(from).text);
  });
  return { folded, state };
}

describe("Fold to Level", () => {
  it("folds the sections at that level and deeper", () => {
    expect(fold(2).folded).toEqual(["## One", "## Two"]);
    expect(fold(3).folded).toEqual(["### One.A"]);
    expect(fold(1).folded).toEqual(["# Title"]);
  });

  it("opens earlier folds first", () => {
    const { state } = fold(2);
    let again = state;
    foldToLevel(3)({ state, dispatch: (tr) => (again = tr.state) });
    const folded: string[] = [];
    foldedRanges(again).between(0, again.doc.length, (from) => {
      folded.push(again.doc.lineAt(from).text);
    });
    expect(folded).toEqual(["### One.A"]);
  });
});
