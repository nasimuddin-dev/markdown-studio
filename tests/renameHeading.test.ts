import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { registerEditorView } from "../src/features/editorBridge";
import { openPath } from "../src/features/documents";
import { applyChanges } from "../src/features/referenceLinks";
import { headingAt, planHeadingRename, renameHeading, rewriteAnchorLinks } from "../src/features/renameHeading";
import { activeDoc } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { useWorkspace } from "../src/stores/workspaceStore";
import { setupBackend } from "./helpers";

const rename = (text: string, line: number, value: string) => {
  const plan = planHeadingRename(text, line, value);
  return plan && { text: applyChanges(text, plan.changes), renamed: Object.fromEntries(plan.renamed) };
};

describe("renaming a heading", () => {
  it("finds the heading's text on ATX and setext headings", () => {
    const text = "# Title #\n\nSub **bold**\n---\n\ntext";
    expect(headingAt(text, 1)).toMatchObject({ line: 1, raw: "Title" });
    expect(headingAt(text, 3)).toMatchObject({ line: 3, raw: "Sub **bold**" });
    expect(headingAt(text, 4)).toMatchObject({ line: 3 });
    expect(headingAt(text, 6)).toBeNull();
  });

  it("renames it and updates this document's links, keeping closing #s", () => {
    const text = "## Set Up ##\n\nSee [setup](#set-up), [again](#Set-Up) and [other](#other).\n\n## Other";
    expect(rename(text, 1, "Installation")).toEqual({
      text: "## Installation ##\n\nSee [setup](#installation), [again](#installation) and [other](#other).\n\n## Other",
      renamed: { "set-up": "installation" },
    });
  });

  it("renumbers anchors of later headings with the same text", () => {
    const text = "## Notes\n\n## Notes\n\n[first](#notes) [second](#notes-1)";
    expect(rename(text, 1, "Intro")?.text).toBe("## Intro\n\n## Notes\n\n[first](#intro) [second](#notes)");
  });

  it("refuses an empty name and lines that aren't headings", () => {
    expect(rename("# A", 1, "  ")).toBeNull();
    expect(rename("text", 1, "B")).toBeNull();
  });

  it("updates wiki links that name the heading by its text", () => {
    const text = "## Set Up\n\nSee [[#Set Up]], [[#set up|here]] and [[#Other]].";
    const plan = planHeadingRename(text, 1, "Install **now**")!;
    expect(applyChanges(text, plan.changes)).toBe("## Install **now**\n\nSee [[#Install now]], [[#Install now|here]] and [[#Other]].");
    const other = "[[guide#Set Up]] [[guide]] [[notes#Set Up]]";
    expect(rewriteAnchorLinks(other, "/ws/index.md", "/ws/guide.md", plan.renamed, plan.wiki)).toEqual({ text: "[[guide#Install now]] [[guide]] [[notes#Set Up]]", count: 1 });
  });

  it("updates anchors in links from other documents to this one", () => {
    const text = "[a](guide.md#set-up) [b](./guide.md#other) [c](other.md#set-up) [d](#set-up)";
    expect(rewriteAnchorLinks(text, "/ws/index.md", "/ws/guide.md", new Map([["set-up", "install"]]))).toEqual({
      text: "[a](guide.md#install) [b](./guide.md#other) [c](other.md#set-up) [d](#set-up)",
      count: 1,
    });
  });
});

describe("Rename Heading command", () => {
  it("asks for the name, renames in the editor and offers to update other files", async () => {
    const backend = setupBackend({ "/ws/guide.md": "# Guide\n\n## Set Up\n\n[here](#set-up)\n", "/ws/index.md": "Read [setup](guide.md#set-up).\n" });
    useWorkspace.getState().setRoot("/ws");
    await openPath("/ws/guide.md");
    const view = new EditorView({ state: EditorState.create({ doc: activeDoc()!.content, selection: { anchor: 10 } }) });
    registerEditorView(view);
    const titles: string[] = [];
    const replies: Array<{ button: string; value?: string }> = [{ button: "ok", value: "Installation" }, { button: "update" }];
    const unsub = useUi.subscribe((s) => {
      const d = s.dialogs[0];
      if (!d || !replies.length) return;
      titles.push(d.title);
      const r = replies.shift()!;
      queueMicrotask(() => useUi.getState().closeDialog(d.id, r));
    });
    await renameHeading();
    unsub();
    expect(titles).toEqual(["Rename Heading", "Update links?"]);
    expect(view.state.doc.toString()).toBe("# Guide\n\n## Installation\n\n[here](#installation)\n");
    expect((await backend.readTextFile("/ws/index.md")).content).toBe("Read [setup](guide.md#installation).\n");
    registerEditorView(null);
    view.destroy();
  });
});
