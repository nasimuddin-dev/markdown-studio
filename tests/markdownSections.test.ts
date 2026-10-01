import { describe, expect, it } from "vitest";
import { hasFootnotes, referenceDefinitions, splitSections } from "../src/services/markdownSections";

const joined = (text: string, min = 1) => splitSections(text, min).map((s) => s.source).join("");

describe("splitting a document into sections", () => {
  it("splits at headings and gives back the text exactly", () => {
    const text = "Intro\n\n# A\ntext a\n\n## B\ntext b\n# C\nlast";
    const sections = splitSections(text, 1);
    expect(sections.map((s) => [s.startLine, s.source.split("\n")[0]])).toEqual([
      [1, "Intro"],
      [3, "# A"],
      [6, "## B"],
      [8, "# C"],
    ]);
    expect(joined(text)).toBe(text);
  });

  it("never splits inside code, math or multi-line HTML", () => {
    const text = [
      "# A",
      "```md",
      "# not a heading (code)",
      "```",
      "~~~~",
      "```",
      "# still code (a shorter fence doesn't close ~~~~)",
      "~~~~",
      "$$",
      "# not a heading (math)",
      "$$",
      "<!-- a comment",
      "# not a heading (comment)",
      "-->",
      "<pre>",
      "# not a heading (pre)",
      "</pre>",
      "# B",
    ].join("\n");
    const sections = splitSections(text, 1);
    expect(sections.map((s) => s.source.split("\n")[0])).toEqual(["# A", "# B"]);
    expect(sections[1].startLine).toBe(18);
    expect(joined(text)).toBe(text);
  });

  it("joins small sections and isn't fooled by #tags or #hashes in text", () => {
    const text = "# A\nshort\n# B\nshort\n#tag is not a heading\n# C\n" + "x".repeat(50);
    expect(splitSections(text, 15).map((s) => s.source.split("\n")[0])).toEqual(["# A", "# C"]);
    expect(splitSections("#notaheading\n####### seven\n# real", 1).map((s) => s.startLine)).toEqual([1, 3]);
    expect(splitSections("", 1)).toEqual([{ source: "", startLine: 1 }]);
  });

  it("collects reference definitions outside code, and detects footnotes", () => {
    const text = "See [docs][d] and [x].\n\n[d]: https://example.com/docs \"Docs\"\n```\n[fake]: https://no\n```\n  [x]: other.md\n[^1]: a footnote";
    expect(referenceDefinitions(text)).toBe("[d]: https://example.com/docs \"Docs\"\n  [x]: other.md");
    expect(hasFootnotes(text)).toBe(true);
    expect(hasFootnotes("No [footnotes] here, just [links](x).")).toBe(false);
  });
});

describe("the outline's headings match the preview's", () => {
  it("ignores lines in HTML comments, <pre> blocks and $$ math, like the preview", async () => {
    const { extractHeadings } = await import("../src/features/outline");
    const text = ["# Real", "<!--", "# commented out", "-->", "<pre>", "# preformatted", "</pre>", "$$", "# math", "$$", "```js", "# code", "```js", "# still code", "```", "## Also real"].join("\n");
    expect(extractHeadings(text).map((h) => h.text)).toEqual(["Real", "Also real"]);
  });
});
