import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { invalidateWorkspaceFiles, tagCompletionSource } from "../src/features/completion";
import { setWorkspace } from "../src/features/workspace";
import { EditorView } from "@codemirror/view";
import { openPath } from "../src/features/documents";
import { registerEditorView } from "../src/features/editorBridge";
import { activeDoc } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { collectFolderTags, extractTags, planTagRename, renameTag, tagAt, tagLabel } from "../src/features/tags";
import { setupBackend } from "./helpers";

describe("extractTags", () => {
  it("reads front matter tags, as a list or comma-separated", () => {
    expect(extractTags("---\ntitle: A\ntags: [draft, \"work\"]\n---\n")).toEqual([
      { tag: "draft", line: 3 },
      { tag: "work", line: 3 },
    ]);
    expect(extractTags("---\ntag: idea, later\n---\n").map((t) => t.tag)).toEqual(["idea", "later"]);
    expect(extractTags("---\ntags:\n  - one\n  - two\n---\n").map((t) => t.tag)).toEqual(["one", "two"]);
  });

  it("finds inline tags with their line, skipping headings, code, links and numbers", () => {
    const text = "# Title\n\nSome #idea here (#nested/sub).\n`#code` and [x](#anchor) and #1 and a#b\n\n```\n#fenced\n```\n#last-one";
    expect(extractTags(text)).toEqual([
      { tag: "idea", line: 3 },
      { tag: "nested/sub", line: 3 },
      { tag: "last-one", line: 9 },
    ]);
  });

  it("counts lines from the top of the file when there is front matter", () => {
    expect(extractTags("---\ntitle: A\n---\n\n#todo")).toEqual([{ tag: "todo", line: 5 }]);
  });
});

describe("collectFolderTags", () => {
  it("groups tags case-insensitively by file, with the first line and a count", async () => {
    setupBackend({ "/ws/a.md": "#Idea and #idea\n\n#work", "/ws/b.md": "---\ntags: [idea]\n---\n", "/ws/c.txt": "#idea" });
    const tags = await collectFolderTags("/ws");
    expect(tags.get("idea")).toEqual([
      { path: "/ws/a.md", line: 1, count: 2, tag: "Idea" },
      { path: "/ws/b.md", line: 2, count: 1, tag: "idea" },
    ]);
    expect(tags.get("work")).toEqual([{ path: "/ws/a.md", line: 3, count: 1, tag: "work" }]);
    expect(tagLabel(tags.get("idea")!)).toBe("Idea");
  });
});

describe("tag completion", () => {
  const complete = async (doc: string) => {
    const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
    ensureSyntaxTree(state, state.doc.length, 5000);
    const r = await tagCompletionSource(new CompletionContext(state, doc.length, false));
    return r && { from: r.from, options: r.options.map((o) => [o.label, o.detail]) };
  };

  it("offers the folder's tags and this document's, with how many files use each", async () => {
    setupBackend({ "/ws/a.md": "#idea #Work", "/ws/b.md": "---\ntags: [idea]\n---\n" });
    await setWorkspace("/ws");
    invalidateWorkspaceFiles();
    expect(await complete("#local here\n\nSee #i")).toEqual({
      from: 17,
      options: [
        ["#idea", "2 files"],
        ["#Work", "1 file"],
        ["#local", "this document"],
      ],
    });
  });

  it("stays out of headings, code, link anchors and numbers", async () => {
    setupBackend({ "/ws/a.md": "#idea" });
    await setWorkspace("/ws");
    invalidateWorkspaceFiles();
    expect(await complete("# i")).toBeNull();
    expect(await complete("`#i")).toBeNull();
    expect(await complete("[x](#i")).toBeNull();
    expect(await complete("a#i")).toBeNull();
    expect(await complete("#12")).toBeNull();
  });
});

describe("tags in the preview and HTML export", () => {
  it("wraps inline tags in span.md-tag, outside links, code and headings", async () => {
    const { renderHtml } = await import("../src/services/exportHtml");
    const html = await renderHtml("# Title #nope\n\nSee #idea and (#work/sub), [#link](x.md), `#code`, #12, a#b.\n");
    expect(html).toContain('<span class="md-tag">#idea</span>');
    expect(html).toContain('(<span class="md-tag">#work/sub</span>)');
    expect(html.match(/md-tag/g)).toHaveLength(2);
    expect(html).toContain("<h1");
    expect(html).toContain("Title #nope</h1>");
  });
});

describe("Rename Tag", () => {
  it("finds the tag at a position", () => {
    const text = "Plan #idea and `#code` [x](#a)";
    expect(tagAt(text, 5)).toBe("idea");
    expect(tagAt(text, 10)).toBe("idea");
    expect(tagAt(text, 17)).toBeNull();
    expect(tagAt(text, 27)).toBeNull();
  });

  it("renames inline and front matter uses, any capitalisation, nested tags too", () => {
    const text = "---\ntitle: Idea list\ntags: [idea, ideas, \"Idea\"]\nkeywords:\n  - idea\n---\n#Idea #ideas #idea/sub `#idea` [#idea](x.md) idea";
    const out = planTagRename(text, "idea", "thought");
    let result = "";
    let last = 0;
    for (const c of out) {
      result += text.slice(last, c.from) + c.insert;
      last = c.to;
    }
    result += text.slice(last);
    expect(result).toBe("---\ntitle: Idea list\ntags: [thought, ideas, \"thought\"]\nkeywords:\n  - idea\n---\n#thought #ideas #thought/sub `#idea` [#idea](x.md) idea");
    const list = "---\ntags:\n  - idea\n  - other\n---\n";
    expect(planTagRename(list, "idea", "x")).toEqual([{ from: 14, to: 18, insert: "x" }]);
  });

  it("renames in the editor, then in the folder's other files after asking", async () => {
    const backend = setupBackend({ "/ws/a.md": "Today #idea\n", "/ws/b.md": "---\ntags: [idea]\n---\nAlso #idea and #ideas\n", "/ws/c.md": "none\n" });
    await setWorkspace("/ws");
    await openPath("/ws/a.md");
    const view = new EditorView({ state: EditorState.create({ doc: activeDoc()!.content, selection: { anchor: 8 } }) });
    registerEditorView(view);
    const dialogs: string[] = [];
    const replies: Array<{ button: string; value?: string }> = [{ button: "ok", value: "#thought" }, { button: "update" }];
    const unsub = useUi.subscribe((s) => {
      const d = s.dialogs[0];
      if (!d || !replies.length) return;
      dialogs.push(`${d.title}: ${d.message}`);
      const r = replies.shift()!;
      queueMicrotask(() => useUi.getState().closeDialog(d.id, r));
    });
    await renameTag();
    unsub();
    expect(dialogs[1]).toBe("Rename in other files?: #idea is used 2 times in 1 other file of “ws”. Rename them too?");
    expect(view.state.doc.toString()).toBe("Today #thought\n");
    expect((await backend.readTextFile("/ws/b.md")).content).toBe("---\ntags: [thought]\n---\nAlso #thought and #ideas\n");
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Renamed the tag in 1 file.");
    registerEditorView(null);
    view.destroy();
  });
});

describe("tag completion in the front matter", () => {
  const complete = async (doc: string) => {
    const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
    const r = await tagCompletionSource(new CompletionContext(state, doc.length, false));
    return r && { from: r.from, labels: r.options.map((o) => o.label) };
  };

  it("completes names without # on the tags line and its list items", async () => {
    setupBackend({ "/ws/a.md": "#idea #work" });
    await setWorkspace("/ws");
    invalidateWorkspaceFiles();
    expect(await complete("---\ntags: [draft, i")).toEqual({ from: 18, labels: ["idea", "work"] });
    expect(await complete("---\ntags: \"w")).toEqual({ from: 11, labels: ["idea", "work"] });
    expect(await complete("---\ntitle: x\ntags:\n  - w")).toEqual({ from: 23, labels: ["idea", "work"] });
    expect(await complete("---\ntitle: i")).toBeNull();
    expect(await complete("---\ntags: [a]\n---\ntags: i")).toBeNull();
  });
});
