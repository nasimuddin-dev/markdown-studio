import { describe, expect, it } from "vitest";
import { rewriteLinks } from "../src/features/linkUpdate";
import { moveEntry, renameEntry } from "../src/features/workspace";
import { openPath } from "../src/features/documents";
import { activeDoc, useDocuments } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { useWorkspace } from "../src/stores/workspaceStore";
import { setupBackend } from "./helpers";

const file = (path: string) => ({ path, name: path.split("/").pop()!, isDir: false });
const folder = (path: string) => ({ ...file(path), isDir: true });
const moved = (from: string, to: string) => (p: string) => (p === from || p.startsWith(from + "/") ? to + p.slice(from.length) : p);

/** Answers each dialog in turn: prompts with a value, confirmations with a button id. */
function answer(...replies: Array<{ value: string } | { button: string }>) {
  const titles: string[] = [];
  const unsub = useUi.subscribe((s) => {
    const d = s.dialogs[0];
    if (!d || !replies.length) return;
    titles.push(d.title);
    const r = replies.shift()!;
    if (!replies.length) unsub();
    queueMicrotask(() => useUi.getState().closeDialog(d.id, "value" in r ? { button: "ok", value: r.value } : r));
  });
  return titles;
}

describe("rewriteLinks", () => {
  it("points links at a moved file, keeping anchors, ./ and brackets", () => {
    const text = "See [guide](./guide.md#setup), ![logo](img/logo.png) and [b](<guide.md>).\n\n`[code](guide.md)`";
    const { text: out, count } = rewriteLinks(text, "/ws/index.md", "/ws/index.md", moved("/ws/guide.md", "/ws/docs/guide.md"));
    expect(count).toBe(2);
    expect(out).toBe("See [guide](./docs/guide.md#setup), ![logo](img/logo.png) and [b](<docs/guide.md>).\n\n`[code](guide.md)`");
  });

  it("fixes a moved document's own links to files that stayed", () => {
    const text = "[home](index.md) [sibling](../other/x.md) [web](https://example.com) [top](#top)";
    const { text: out, count } = rewriteLinks(text, "/ws/a/page.md", "/ws/b/c/page.md", moved("/ws/a/page.md", "/ws/b/c/page.md"));
    expect(count).toBe(2);
    expect(out).toBe("[home](../../a/index.md) [sibling](../../other/x.md) [web](https://example.com) [top](#top)");
  });

  it("updates reference-style definitions, but not indented code", () => {
    const text = 'See [the guide][g].\n\n[g]: guide.md#setup "Guide"\n[logo]: <img/logo.png>\n\n    [g]: guide.md';
    const { text: out, count } = rewriteLinks(text, "/ws/index.md", "/ws/index.md", moved("/ws/guide.md", "/ws/docs/guide.md"));
    expect(count).toBe(1);
    expect(out).toBe('See [the guide][g].\n\n[g]: docs/guide.md#setup "Guide"\n[logo]: <img/logo.png>\n\n    [g]: guide.md');
  });

  it("updates HTML image sources and link targets", () => {
    const text = '<img alt="logo" src="img/logo.png" width="80">\n<a href="img/logo.png">full size</a>';
    const { text: out, count } = rewriteLinks(text, "/ws/README.md", "/ws/README.md", moved("/ws/img", "/ws/assets/img"));
    expect(count).toBe(2);
    expect(out).toBe('<img alt="logo" src="assets/img/logo.png" width="80">\n<a href="assets/img/logo.png">full size</a>');
  });

  it("updates HTML links written with entities and keeps them encoded", () => {
    const text = '<a href="Q&amp;A.md?x=1&amp;y=2">FAQ</a> after';
    const { text: out, count } = rewriteLinks(text, "/ws/i.md", "/ws/i.md", moved("/ws/Q&A.md", "/ws/docs/Q&A.md"));
    expect(count).toBe(1);
    expect(out).toBe('<a href="docs/Q&amp;A.md?x=1&amp;y=2">FAQ</a> after');
  });

  it("leaves links between files that moved together unchanged, and escapes spaces", () => {
    const inside = rewriteLinks("[n](n2.md)", "/ws/notes/n1.md", "/ws/archive/notes/n1.md", moved("/ws/notes", "/ws/archive/notes"));
    expect(inside.count).toBe(0);
    const spaced = rewriteLinks("[x](old.md)", "/ws/i.md", "/ws/i.md", moved("/ws/old.md", "/ws/My Notes (1).md"));
    expect(spaced.text).toBe("[x](My%20Notes%20%281%29.md)");
  });
});

describe("updating links after a rename or move", () => {
  it("asks, then rewrites links in other files and the moved file, reloading open tabs", async () => {
    const backend = setupBackend({
      "/ws/index.md": "[Guide](guide.md)\n",
      "/ws/guide.md": "[Back](index.md)\n",
      "/ws/docs/keep.md": "x",
    });
    useWorkspace.getState().setRoot("/ws");
    await openPath("/ws/index.md");
    const titles = answer({ button: "update" });
    await moveEntry(file("/ws/guide.md"), "/ws/docs");
    expect(titles).toEqual(["Update links?"]);
    expect((await backend.readTextFile("/ws/index.md")).content).toBe("[Guide](docs/guide.md)\n");
    expect((await backend.readTextFile("/ws/docs/guide.md")).content).toBe("[Back](../index.md)\n");
    expect(activeDoc()?.content).toBe("[Guide](docs/guide.md)\n");
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Updated links in 2 files.");
  });

  it("changes nothing when the user declines, and skips files with unsaved changes", async () => {
    const backend = setupBackend({ "/ws/a.md": "[x](old.md) [y](two.md)", "/ws/b.md": "[y](two.md)", "/ws/old.md": "o", "/ws/two.md": "t" });
    useWorkspace.getState().setRoot("/ws");
    answer({ value: "new.md" }, { button: "keep" });
    await renameEntry(file("/ws/old.md"));
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("[x](old.md) [y](two.md)");

    await openPath("/ws/b.md");
    editOpenDocument("/ws/b.md", "[y](two.md) edited");
    answer({ value: "three.md" }, { button: "update" });
    await renameEntry(file("/ws/two.md"));
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("[x](old.md) [y](three.md)");
    expect((await backend.readTextFile("/ws/b.md")).content).toBe("[y](two.md)");
  });

  it("doesn't ask when nothing links to the moved folder", async () => {
    setupBackend({ "/ws/notes/n.md": "[m](m.md)", "/ws/notes/m.md": "m", "/ws/archive/x.md": "x" });
    useWorkspace.getState().setRoot("/ws");
    const titles = answer({ button: "update" });
    await moveEntry(folder("/ws/notes"), "/ws/archive");
    expect(titles).toEqual([]);
  });
});

/** Gives an open document unsaved changes. */
function editOpenDocument(path: string, content: string) {
  const doc = useDocuments.getState().docs.find((d) => d.path === path)!;
  useDocuments.getState().update(doc.id, { content });
}
