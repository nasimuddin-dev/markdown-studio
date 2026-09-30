import { describe, expect, it } from "vitest";
import { splitNotes, splitSlides } from "../src/features/slides";

describe("splitting a document into slides", () => {
  it("splits at --- lines that follow a blank line, not at heading underlines or in code", () => {
    const text = ["---", "title: Deck", "---", "# Intro", "", "Hello", "", "---", "", "Setext", "---", "", "```", "", "---", "```", "", "---", "Last"].join("\n");
    expect(splitSlides(text)).toEqual(["# Intro\n\nHello", "Setext\n---\n\n```\n\n---\n```", "Last"]);
  });

  it("uses # and ## headings when there are no separators", () => {
    expect(splitSlides("Opening words\n\n# One\ntext\n\n## Two\n### Detail\n\n```\n# not a heading\n```")).toEqual([
      "Opening words",
      "# One\ntext",
      "## Two\n### Detail\n\n```\n# not a heading\n```",
    ]);
  });

  it("always returns at least one slide", () => {
    expect(splitSlides("")).toEqual([""]);
    expect(splitSlides("Just text")).toEqual(["Just text"]);
  });
});

describe("speaker notes", () => {
  it("takes everything after a Note: line out of the slide", () => {
    expect(splitNotes("# Results\n\nUp 20%.\n\nNote: mention the new region.\nAnd thank the team.")).toEqual({
      body: "# Results\n\nUp 20%.",
      notes: "mention the new region.\nAnd thank the team.",
    });
    expect(splitNotes("## Plan\n\nnotes: short")).toEqual({ body: "## Plan", notes: "short" });
    expect(splitNotes("No notes here")).toEqual({ body: "No notes here", notes: "" });
  });

  it("ignores Note: inside code", () => {
    const slide = "```yaml\nNote: not a note\n```";
    expect(splitNotes(slide)).toEqual({ body: slide, notes: "" });
  });
});
