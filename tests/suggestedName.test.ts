import { describe, expect, it } from "vitest";
import { newDocument, saveDocument, suggestedFileName } from "../src/features/documents";
import { setBackend } from "../src/services";
import { MemoryBackend } from "../src/services/memoryBackend";
import { setupBackend } from "./helpers";

describe("the name Save As suggests", () => {
  it("comes from the title, cleaned for file names", () => {
    expect(suggestedFileName("# Hello World\n\ntext", "Untitled-1.md")).toBe("Hello World.md");
    expect(suggestedFileName("---\ntitle: Q3 Plan: Draft?\n---\n# Other", "x.md")).toBe("Q3 Plan Draft.md");
    expect(suggestedFileName("## Not a title\n\ntext", "Untitled-2.md")).toBe("Untitled-2.md");
    expect(suggestedFileName("# **Bold** <tag> a/b\\c.", "x.md")).toBe("Bold a b c.md");
    expect(suggestedFileName("# " + "long ".repeat(40), "x.md")).toHaveLength(79 + 3);
    expect(suggestedFileName("", "Untitled-3.md")).toBe("Untitled-3.md");
  });

  it("is offered when a new document is saved", async () => {
    setupBackend();
    let offered = "";
    setBackend(new MemoryBackend({ files: { "/ws/keep.md": "" }, approved: ["/ws"], prompt: (_m, d) => ((offered = d), null) }));
    const id = newDocument("# Meeting Notes\n");
    await saveDocument(id);
    expect(offered).toMatch(/Meeting Notes\.md$/);
  });
});
