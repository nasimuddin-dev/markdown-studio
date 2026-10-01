import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CompletionContext } from "@codemirror/autocomplete";
import { ensureSyntaxTree } from "@codemirror/language";
import * as full from "@codemirror/lang-html";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { html, htmlCompletionSource } from "../src/services/markdownHtml";

type HtmlFactory = typeof html;

/** Types `text` at `pos` the way the editor's input handlers see it. */
function type(view: EditorView, pos: number, text: string) {
  view.dispatch({ selection: { anchor: pos } });
  // Auto-close reads the syntax tree; parse it all first (parsing is time-sliced, so a busy machine may not have yet).
  ensureSyntaxTree(view.state, view.state.doc.length, 30_000);
  const insert = () => view.state.update({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length }, userEvent: "input.type" });
  const handled = view.state.facet(EditorView.inputHandler).some((h) => h(view, pos, pos, text, insert));
  if (!handled) view.dispatch(insert());
}

/** A Markdown editor using `factory` for inline HTML; types each step and returns the document after each. */
function session(factory: HtmlFactory, start: string, steps: Array<[number, string]>): string[] {
  const view = new EditorView({ state: EditorState.create({ doc: start, extensions: markdown({ base: markdownLanguage, htmlTagLanguage: factory({ matchClosingTags: false }) }) }) });
  const out = steps.map(([pos, text]) => {
    type(view, pos, text);
    return view.state.doc.toString();
  });
  view.destroy();
  return out;
}

describe("the light HTML language for Markdown", () => {
  it("offers the same tag completions as @codemirror/lang-html", () => {
    const ctx = (factory: HtmlFactory) => new CompletionContext(EditorState.create({ extensions: factory({ matchClosingTags: false }) }), 0, true);
    const theirs = full.htmlCompletionSource(ctx(full.html as HtmlFactory))!.options.map((o) => o.label);
    const ours = htmlCompletionSource(ctx(html))!.options.map((o) => o.label);
    expect(ours).toEqual(theirs);
  });

  it("closes tags in Markdown exactly as @codemirror/lang-html does", () => {
    const scenarios: Array<[string, Array<[number, string]>]> = [
      ["Text\n\n", [[6, "<div"], [10, ">"]]], // block HTML: closed
      ["<div>\n\nx\n\n<", [[11, "/"]]], // `</` in a block
      ["Inline <span>x<", [[15, "/"]]], // `</` after inline HTML
      ["Some <b", [[7, ">"]]], // inline tag
      ["<br", [[3, ">"]]], // void element: not closed
      ["`<code`", [[6, ">"]]], // in a code span: nothing
    ];
    for (const [start, steps] of scenarios) {
      expect(session(html, start, steps), start).toEqual(session(full.html as HtmlFactory, start, steps));
    }
    expect(session(html, "Text\n\n", [[6, "<div"], [10, ">"]]).at(-1)).toBe("Text\n\n<div></div>");
  });

  it("parses inline and block HTML in Markdown like @codemirror/lang-html", () => {
    const doc = 'A <b>bold</b> word\n\n<div class="x">\n</div>';
    // Positions inside: the b tag name, the div tag name, the attribute name, the attribute value.
    const positions = [3, 22, 26, 32];
    const nodes = (factory: HtmlFactory) => {
      const state = EditorState.create({ doc, extensions: markdown({ base: markdownLanguage, htmlTagLanguage: factory({ matchClosingTags: false }) }) });
      // The parsed tree itself (the state's copy can lag behind on a busy machine).
      const tree = ensureSyntaxTree(state, state.doc.length, 30_000);
      expect(tree?.length).toBe(state.doc.length);
      return positions.map((p) => tree!.resolveInner(p, 1).name);
    };
    expect(nodes(html)).toEqual(["TagName", "TagName", "AttributeName", "AttributeValue"]);
    expect(nodes(html)).toEqual(nodes(full.html as HtmlFactory));
  });
});
