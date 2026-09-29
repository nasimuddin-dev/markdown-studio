import { describe, expect, it } from "vitest";
import { moveEntry, moveEntryTo } from "../src/features/workspace";
import { openPath } from "../src/features/documents";
import { useWorkspace } from "../src/stores/workspaceStore";
import { activeDoc } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

const file = (path: string) => ({ path, name: path.split("/").pop()!, isDir: false });
const folder = (path: string) => ({ ...file(path), isDir: true });
const lastToast = () => useUi.getState().toasts.at(-1);

/** Answers the next Move To prompt with `value`. */
function answerPrompt(value: string | null) {
  const unsub = useUi.subscribe((s) => {
    const d = s.dialogs[0];
    if (!d) return;
    unsub();
    queueMicrotask(() => useUi.getState().closeDialog(d.id, value === null ? { button: "cancel" } : { button: "ok", value }));
  });
}

describe("moving files and folders", () => {
  it("moves a file into a folder, and its open tab follows", async () => {
    const backend = setupBackend({ "/ws/a.md": "# A", "/ws/docs/b.md": "# B" });
    useWorkspace.getState().setRoot("/ws");
    await openPath("/ws/a.md");
    await moveEntry(file("/ws/a.md"), "/ws/docs");
    expect((await backend.readTextFile("/ws/docs/a.md")).content).toBe("# A");
    await expect(backend.readTextFile("/ws/a.md")).rejects.toBeTruthy();
    expect(activeDoc()?.path).toBe("/ws/docs/a.md");
    expect(useWorkspace.getState().selected).toBe("/ws/docs/a.md");
    expect(lastToast()?.message).toMatch(/Moved “a\.md” to “docs”/);
  });

  it("moves a folder with its contents, and tabs inside it follow", async () => {
    const backend = setupBackend({ "/ws/notes/n.md": "# N", "/ws/archive/x.md": "x" });
    useWorkspace.getState().setRoot("/ws");
    await openPath("/ws/notes/n.md");
    await moveEntry(folder("/ws/notes"), "/ws/archive");
    expect((await backend.readTextFile("/ws/archive/notes/n.md")).content).toBe("# N");
    expect(activeDoc()?.path).toBe("/ws/archive/notes/n.md");
  });

  it("refuses name clashes and moving a folder into itself", async () => {
    const backend = setupBackend({ "/ws/a.md": "mine", "/ws/docs/a.md": "theirs", "/ws/docs/sub/c.md": "c" });
    useWorkspace.getState().setRoot("/ws");
    await moveEntry(file("/ws/a.md"), "/ws/docs");
    expect(lastToast()).toMatchObject({ kind: "error" });
    expect(lastToast()?.message).toMatch(/already exists/);
    expect((await backend.readTextFile("/ws/docs/a.md")).content).toBe("theirs");
    await moveEntry(folder("/ws/docs"), "/ws/docs/sub");
    expect(lastToast()?.message).toMatch(/into itself/);
    expect((await backend.readTextFile("/ws/docs/sub/c.md")).content).toBe("c");
  });

  it("Move To asks for a folder relative to the workspace", async () => {
    const backend = setupBackend({ "/ws/docs/a.md": "# A", "/ws/guide/deep/x.md": "x" });
    useWorkspace.getState().setRoot("/ws");
    answerPrompt("guide\\deep");
    await moveEntryTo(file("/ws/docs/a.md"));
    expect((await backend.readTextFile("/ws/guide/deep/a.md")).content).toBe("# A");
    answerPrompt("/");
    await moveEntryTo(file("/ws/guide/deep/a.md"));
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("# A");
    answerPrompt("../outside");
    await moveEntryTo(file("/ws/a.md"));
    expect(lastToast()?.message).toMatch(/inside the open folder/);
    answerPrompt(null);
    await moveEntryTo(file("/ws/a.md"));
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("# A");
  });
});
