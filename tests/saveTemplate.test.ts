import { describe, expect, it } from "vitest";
import { openPath } from "../src/features/documents";
import { listTemplates, saveAsTemplate } from "../src/features/templates";
import { setWorkspace } from "../src/features/workspace";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

function answerPrompt(value: string) {
  const unsub = useUi.subscribe((s) => {
    const d = s.dialogs[0];
    if (!d) return;
    unsub();
    queueMicrotask(() => useUi.getState().closeDialog(d.id, { button: "ok", value }));
  });
}

describe("Save as Template", () => {
  it("copies the document into the folder's templates/ folder, where New from Template finds it", async () => {
    const backend = setupBackend({ "/ws/notes.md": "# {{title}}\n\n{{cursor}}\n" });
    await setWorkspace("/ws");
    await openPath("/ws/notes.md");
    answerPrompt("Meeting");
    await saveAsTemplate();
    expect((await backend.readTextFile("/ws/templates/Meeting.md")).content).toBe("# {{title}}\n\n{{cursor}}\n");
    expect((await listTemplates()).map((t) => t.name)).toContain("Meeting");
    // The same name again is refused.
    answerPrompt("Meeting.md");
    await saveAsTemplate();
    expect(useUi.getState().toasts.at(-1)?.message).toBe("A template named “Meeting.md” already exists.");
  });

  it("needs an open folder", async () => {
    setupBackend({ "/ws/a.md": "x" });
    await openPath("/ws/a.md");
    await saveAsTemplate();
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Open a folder first: templates are kept in its “templates” folder.");
  });
});
