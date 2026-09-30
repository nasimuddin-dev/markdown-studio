import { describe, expect, it } from "vitest";
import { anchorLine, linkAt } from "../src/features/followLink";

const at = (text: string, marker: string, offset = 1) => linkAt(text, text.indexOf(marker) + offset);

describe("the link under the pointer in the editor", () => {
  const text = [
    "# Intro",
    "See [the guide](docs/guide.md#setup \"Guide\") and ![logo](img/logo.png).",
    "Visit https://example.com/page, or <https://example.org>.",
    "Read [the notes][Notes], [home][] and [home].",
    "`[code](x.md)` and <a href=\"page.md\">HTML</a> and [plain] text.",
    "",
    "[notes]: notes.md",
    "[Home]: https://home.example",
  ].join("\n");

  it("finds inline links, images, HTML links and definitions", () => {
    expect(at(text, "the guide")).toEqual({ kind: "href", href: "docs/guide.md#setup" });
    expect(at(text, "(docs/guide")).toEqual({ kind: "href", href: "docs/guide.md#setup" });
    expect(at(text, "logo](")).toEqual({ kind: "href", href: "img/logo.png" });
    expect(at(text, "page.md\"")).toEqual({ kind: "href", href: "page.md" });
    expect(at(text, "notes.md")).toEqual({ kind: "href", href: "notes.md" });
  });

  it("finds web addresses, without the punctuation after them", () => {
    expect(at(text, "example.com")).toEqual({ kind: "href", href: "https://example.com/page" });
    expect(at(text, "example.org")).toEqual({ kind: "href", href: "https://example.org" });
  });

  it("leads references to their definitions", () => {
    const notes = text.indexOf("[notes]:");
    const home = text.indexOf("[Home]:");
    expect(at(text, "the notes")).toEqual({ kind: "definition", pos: notes });
    expect(at(text, "home][]")).toEqual({ kind: "definition", pos: home });
    expect(at(text, "home].")).toEqual({ kind: "definition", pos: home });
  });

  it("ignores code, undefined brackets and plain text", () => {
    expect(at(text, "code](")).toBeNull();
    expect(at(text, "plain")).toBeNull();
    expect(at(text, "Intro")).toBeNull();
  });
});

describe("anchor targets", () => {
  it("finds headings by their GitHub anchor, and HTML anchors", () => {
    const text = "# Getting Started!\n\ntext\n\n## Install\n\n## Install\n\n<a id=\"custom\"></a>";
    expect(anchorLine(text, "getting-started")).toBe(1);
    expect(anchorLine(text, "Install")).toBe(5);
    expect(anchorLine(text, "install-1")).toBe(7);
    expect(anchorLine(text, "custom")).toBe(9);
    expect(anchorLine(text, "missing")).toBeNull();
  });
});
