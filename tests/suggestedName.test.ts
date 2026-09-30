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

  it("starts in the folder of another open file when no folder is open", async () => {
    setupBackend();
    let offered = "";
    // Open File is answered with a file in Downloads; Save As records where it starts, then cancels.
    const b = new MemoryBackend({
      files: { "/downloads/a.md": "# A" },
      prompt: (m, d) => (m.startsWith("Open file") ? "/downloads/a.md" : ((offered = d), null)),
    });
    setBackend(b);
    await b.pickOpenFile();
    const { openPath } = await import("../src/features/documents");
    await openPath("/downloads/a.md");
    const id = newDocument("# Notes\n");
    await saveDocument(id);
    expect(offered).toBe("/downloads/Notes.md");
  });
});
