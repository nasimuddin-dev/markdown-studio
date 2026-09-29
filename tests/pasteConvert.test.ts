import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { pasteHtmlAsMarkdown, pastePlainTable, pendingPastes } from "../src/features/richPaste";

function editor(doc: string, cursor = doc.length) {
  return new EditorView({ state: EditorState.create({ doc, selection: { anchor: cursor }, extensions: [pendingPastes] }), parent: document.body });
}

describe("converted pastes", () => {
  it("insert at the paste position even when the user types while it converts", async () => {
    const view = editor("Intro\n");
    const pasted = pastePlainTable(view, "a\tb\n1\t2");
    // Typed right after Ctrl+V, before the conversion finished.
    view.dispatch({ changes: { from: view.state.doc.length, insert: "typed" }, selection: { anchor: view.state.doc.length + 5 } });
    await pasted;
    const text = view.state.doc.toString();
    expect(text).toBe("Intro\n|   a |   b |\n| --: | --: |\n|   1 |   2 |\ntyped");
    // The cursor stays where the typing left it.
    expect(view.state.selection.main.head).toBe(text.length);
    expect(view.state.field(pendingPastes).size).toBe(0);
    view.destroy();
  });

  it("put the cursor after the pasted text when nothing changed meanwhile", async () => {
    const view = editor("ab", 1);
    await pasteHtmlAsMarkdown(view, "<p>Hello <b>bold</b></p>", "Hello bold");
    expect(view.state.doc.toString()).toBe("aHello **bold**b");
    expect(view.state.selection.main.head).toBe("aHello **bold**".length);
    view.destroy();
  });
});
