import { describe, expect, it } from "vitest";
import { splitSlides } from "../src/features/slides";

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
