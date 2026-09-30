import { describe, expect, it } from "vitest";
import { openPath } from "../src/features/documents";
import { setLineEnding } from "../src/features/lineEndings";
import { activeDoc, useDocuments } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

describe("changing a document's line endings", () => {
  it("saves a clean document right away with the new line endings", async () => {
    const backend = setupBackend({ "/ws/a.md": "one\ntwo\n" });
    await openPath("/ws/a.md");
    expect(activeDoc()!.lineEnding).toBe("lf");
    await setLineEnding("crlf");
    expect(activeDoc()!.lineEnding).toBe("crlf");
    expect((await backend.readTextFile("/ws/a.md")).lineEnding).toBe("crlf");
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Saved with CRLF line endings.");
  });

  it("waits for the next save when there are unsaved changes", async () => {
    const backend = setupBackend({ "/ws/b.md": "one\n" });
    const id = (await openPath("/ws/b.md"))!;
    useDocuments.getState().setContent(id, "one\nedited\n");
    await setLineEnding("crlf");
    expect(activeDoc()!.lineEnding).toBe("crlf");
    expect((await backend.readTextFile("/ws/b.md")).lineEnding).toBe("lf");
    expect(useUi.getState().toasts.at(-1)?.message).toBe("CRLF line endings will be used when the document is saved.");
  });
});
