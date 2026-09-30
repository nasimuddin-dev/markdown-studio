import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { registerEditorView } from "../src/features/editorBridge";
import { openPath } from "../src/features/documents";
import { extractedLink, moveSelectionToNewFile } from "../src/features/extractFile";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

/** Answers the next prompt with `value` (or cancels with null). */
function answerPrompt(value: string | null) {
  const unsub = useUi.subscribe((s) => {
    const d = s.dialogs[0];
    if (!d) return;
    unsub();
    queueMicrotask(() => useUi.getState().closeDialog(d.id, value === null ? { button: "cancel" } : { button: "ok", value }));
  });
}

describe("Move Selection to New File", () => {
  it("links to the new file by the text's first heading", () => {
    expect(extractedLink("## Set Up [beta]\n\nSteps.", "Set Up.md")).toBe("[Set Up \\[beta\\]](Set%20Up.md)");
    expect(extractedLink("Just text.", "notes (old).md")).toBe("[notes (old)](notes%20%28old%29.md)");
  });

  it("writes the selection to a new file next to the document and links to it", async () => {
    const backend = setupBackend({ "/ws/guide.md": "# Guide\n\n## Install\n\nRun it.\n\n## Use\n" });
    await openPath("/ws/guide.md");
    const doc = "# Guide\n\n## Install\n\nRun it.\n\n## Use\n";
    const from = doc.indexOf("## Install");
    const to = doc.indexOf("## Use");
    const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: from, head: to } }) });
    registerEditorView(view);
    answerPrompt("Install.md");
    await moveSelectionToNewFile();
    expect((await backend.readTextFile("/ws/Install.md")).content).toBe("## Install\n\nRun it.\n");
    expect(view.state.doc.toString()).toBe("# Guide\n\n[Install](Install.md)\n\n## Use\n");
    // A name that exists already is refused, and nothing changes.
    view.dispatch({ selection: { anchor: 0, head: 7 } });
    answerPrompt("Install");
    await moveSelectionToNewFile();
    expect(useUi.getState().toasts.at(-1)?.message).toBe("“Install.md” already exists. Choose another name.");
    expect(view.state.doc.toString().startsWith("# Guide")).toBe(true);
    registerEditorView(null);
    view.destroy();
  });
});
