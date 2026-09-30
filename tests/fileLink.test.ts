import { describe, expect, it } from "vitest";
import { fileLinkMarkdown } from "../src/features/pathActions";

describe("links to files dropped from the Explorer", () => {
  it("links documents by name and pictures as images, relative to the document", () => {
    expect(fileLinkMarkdown("/ws/docs/page.md", "/ws/docs/other doc.md")).toBe("[other doc](other%20doc.md)");
    expect(fileLinkMarkdown("/ws/docs/page.md", "/ws/README.md")).toBe("[README](../README.md)");
    expect(fileLinkMarkdown("/ws/page.md", "/ws/assets/my_logo.png")).toBe("![my logo](assets/my_logo.png)");
    expect(fileLinkMarkdown("/ws/page.md", "/ws/notes [draft] (v2).txt")).toBe("[notes \\[draft\\] (v2).txt](notes%20%5Bdraft%5D%20%28v2%29.txt)");
    expect(fileLinkMarkdown("C:\\ws\\a.md", "D:\\other\\b.md")).toBeNull();
  });
});
