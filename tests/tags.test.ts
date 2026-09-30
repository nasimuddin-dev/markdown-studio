import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { invalidateWorkspaceFiles, tagCompletionSource } from "../src/features/completion";
import { setWorkspace } from "../src/features/workspace";
import { collectFolderTags, extractTags } from "../src/features/tags";
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
      { path: "/ws/a.md", line: 1, count: 2 },
      { path: "/ws/b.md", line: 2, count: 1 },
    ]);
    expect(tags.get("work")).toEqual([{ path: "/ws/a.md", line: 3, count: 1 }]);
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
        ["#work", "1 file"],
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
