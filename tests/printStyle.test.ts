import { describe, expect, it } from "vitest";
import { printPageStyle } from "../src/features/exporting";

describe("print page style", () => {
  it("puts the title at the top and page numbers at the bottom", () => {
    const css = printPageStyle('Q3 "Plan" \\ draft');
    expect(css).toContain('@top-center { content: "Q3 \\"Plan\\" \\\\ draft";');
    expect(css).toContain('@bottom-center { content: counter(page) " / " counter(pages);');
    expect(printPageStyle("a\nb")).toContain('content: "a b"');
  });
});
