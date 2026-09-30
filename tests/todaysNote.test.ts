import { describe, expect, it } from "vitest";
import { openTodaysNote } from "../src/features/templates";
import { setWorkspace } from "../src/features/workspace";
import { activeDoc } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

describe("Open Today's Note", () => {
  const now = new Date(2026, 8, 30, 9, 5);

  it("creates journal/YYYY-MM-DD.md from the Daily journal template, then opens the same file", async () => {
    const backend = setupBackend({ "/ws/a.md": "" });
    await setWorkspace("/ws");
    await openTodaysNote(now);
    const note = await backend.readTextFile("/ws/journal/2026-09-30.md");
    expect(note.content.startsWith("# 2026-09-30\n\n## Today's focus\n\n- [ ] \n")).toBe(true);
    expect(activeDoc()?.path).toBe("/ws/journal/2026-09-30.md");
    // A second time it opens what's there, unchanged.
    await backend.writeTextFile({ path: "/ws/journal/2026-09-30.md", content: "kept", lineEnding: "lf", bom: false, expectedMtime: null, force: true });
    await openTodaysNote(now);
    expect((await backend.readTextFile("/ws/journal/2026-09-30.md")).content).toBe("kept");
  });

  it("uses the folder's own Daily journal template", async () => {
    const backend = setupBackend({ "/ws/templates/Daily journal.md": "Log for {{date}}\n" });
    await setWorkspace("/ws");
    await openTodaysNote(now);
    expect((await backend.readTextFile("/ws/journal/2026-09-30.md")).content).toBe("Log for 2026-09-30\n");
  });

  it("needs an open folder", async () => {
    setupBackend({});
    await openTodaysNote(now);
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Open a folder first: daily notes go in its “journal” folder.");
  });
});
