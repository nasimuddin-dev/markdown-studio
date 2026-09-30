import { describe, expect, it } from "vitest";
import { buildHtmlDocument, printPageStyle } from "../src/services/exportHtml";

describe("print page style", () => {
  it("puts the title at the top and page numbers at the bottom", () => {
    const css = printPageStyle('Q3 "Plan" \\ draft');
    expect(css).toContain('@top-center { content: "Q3 \\"Plan\\" \\\\ draft";');
    expect(css).toContain('@bottom-center { content: counter(page) " / " counter(pages);');
    expect(printPageStyle("a\nb")).toContain('content: "a b"');
  });

  it("is part of exported HTML, so printing it from a browser gets them too", async () => {
    const html = await buildHtmlDocument({ markdown: "# Annual Report\n\ntext", name: "report.md", docPath: null });
    expect(html).toContain('@top-center { content: "Annual Report";');
  });
});
