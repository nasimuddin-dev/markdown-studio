import { describe, expect, it } from "vitest";
import { openPath } from "../src/features/documents";
import { collectFolderHeadings } from "../src/features/workspace";
import { useDocuments } from "../src/stores/documentsStore";
import { setupBackend } from "./helpers";

describe("headings of every document in the folder", () => {
  it("lists them in folder order, using open tabs' unsaved text", async () => {
    setupBackend({ "/ws/a.md": "# A\n\n## A two\n", "/ws/docs/b.md": "# B\n", "/ws/c.txt": "# not markdown\n" });
    const id = await openPath("/ws/docs/b.md");
    useDocuments.getState().setContent(id!, "# B edited\n");
    const found = await collectFolderHeadings("/ws");
    expect(found.map(({ path, heading }) => `${path}:${heading.line} ${heading.text}`).sort()).toEqual(["/ws/a.md:1 A", "/ws/a.md:3 A two", "/ws/docs/b.md:1 B edited"]);
  });
});
