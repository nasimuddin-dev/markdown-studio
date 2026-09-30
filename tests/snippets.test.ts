import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { registerEditorView } from "../src/features/editorBridge";
import { openPath } from "../src/features/documents";
import { BUILT_IN_SNIPPETS, insertSnippet, listSnippets } from "../src/features/templates";
import { setWorkspace } from "../src/features/workspace";
import { setupBackend } from "./helpers";

describe("snippets", () => {
  it("lists the folder's snippets/ files before the built-in ones", async () => {
    setupBackend({ "/ws/snippets/Note box.md": "> **Note:** {{cursor}}", "/ws/notes.md": "x", "/ws/templates/t.md": "t" });
    await setWorkspace("/ws");
    const names = (await listSnippets()).map((s) => s.name);
    expect(names).toEqual(["Note box", ...BUILT_IN_SNIPPETS.map((s) => s.name)]);
  });

  it("inserts at the cursor, replacing the selection, with the cursor at {{cursor}}", async () => {
    setupBackend({ "/ws/snippets/Note box.md": "> **Note:** {{cursor}} ({{title}})", "/ws/Guide.md": "" });
    await setWorkspace("/ws");
    await openPath("/ws/Guide.md");
    const view = new EditorView({ state: EditorState.create({ doc: "Before OLD after", selection: { anchor: 7, head: 10 } }) });
    registerEditorView(view);
    const [own] = await listSnippets();
    await insertSnippet(own);
    expect(view.state.doc.toString()).toBe("Before > **Note:**  (Guide) after");
    expect(view.state.selection.main.head).toBe("Before > **Note:** ".length);
    registerEditorView(null);
    view.destroy();
  });
});
