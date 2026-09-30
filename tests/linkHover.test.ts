import { describe, expect, it } from "vitest";
import { documentLinkAt, excerpt } from "../src/features/linkHover";

describe("document link previews", () => {
  it("find links to Markdown documents, not web pages, images or anchors", () => {
    const text = "[g](docs/guide.md#setup) [w](https://x.com/a.md) ![i](a.png) [h](#top) [[notes/todo]]";
    const at = (marker: string) => documentLinkAt(text, text.indexOf(marker) + 1)?.target ?? null;
    expect(at("[g]")).toBe("docs/guide.md#setup");
    expect(at("[w]")).toBeNull();
    expect(at("![i]")).toBeNull();
    expect(at("[h]")).toBeNull();
    expect(at("[[notes")).toBe("notes/todo.md");
  });

  it("show the start of the document, or of the linked section, as plain text", () => {
    const doc = "---\ntitle: T\n---\n# Guide\n\nRead **this** [first](a.md).\n\n## Setup\n\nInstall `it`.\n";
    expect(excerpt(doc, null)).toBe("Guide\nRead this first.\nSetup\nInstall it.");
    expect(excerpt(doc, "setup")).toBe("Setup\nInstall it.");
    expect(excerpt("word ".repeat(200), null, 30)).toBe("word word word word word word…");
  });
});
