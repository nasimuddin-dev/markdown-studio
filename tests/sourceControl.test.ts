import { describe, expect, it } from "vitest";
import { MemoryBackend } from "../src/services/memoryBackend";
import { setBackend } from "../src/services";
import { useUi } from "../src/stores/uiStore";
import { useWorkspace } from "../src/stores/workspaceStore";
import { changeLabel, commit, loadChanges, stage, unstage } from "../src/features/sourceControl";

/** A demo-style repository: the committed files, then the working files. */
function repo(committed: Record<string, string>, working: Record<string, string>) {
  const backend = new MemoryBackend({ files: working, approved: ["/ws"], gitHead: committed });
  setBackend(backend);
  useWorkspace.getState().setRoot("/ws");
  useUi.setState({ toasts: [] });
  return backend;
}

describe("Source Control", () => {
  it("lists new, changed and deleted files, with nothing staged yet", async () => {
    repo({ "/ws/a.md": "A", "/ws/b.md": "B", "/ws/c.md": "C" }, { "/ws/a.md": "A changed", "/ws/c.md": "C", "/ws/new.md": "N" });
    const result = await loadChanges();
    expect(result).toEqual({
      changes: [
        { path: "/ws/a.md", staged: null, unstaged: "M", conflict: false },
        { path: "/ws/b.md", staged: null, unstaged: "D", conflict: false },
        { path: "/ws/new.md", staged: null, unstaged: "U", conflict: false },
      ],
    });
  });

  it("stages, unstages and commits; the committed text becomes the new base", async () => {
    const backend = repo({ "/ws/a.md": "A" }, { "/ws/a.md": "A changed", "/ws/new.md": "N" });
    expect(await stage(["/ws/a.md", "/ws/new.md"])).toBe(true);
    expect(await loadChanges()).toEqual({
      changes: [
        { path: "/ws/a.md", staged: "M", unstaged: null, conflict: false },
        { path: "/ws/new.md", staged: "A", unstaged: null, conflict: false },
      ],
    });
    expect(await unstage(["/ws/new.md"])).toBe(true);
    expect(await commit("Change a")).toBe(true);
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Committed (demo001): Change a");
    // The new file wasn't staged, so it's still untracked; a.md is committed.
    expect(await loadChanges()).toEqual({ changes: [{ path: "/ws/new.md", staged: null, unstaged: "U", conflict: false }] });
    expect(await backend.gitHeadText("/ws/a.md")).toBe("A changed");
  });

  it("explains a refused commit in Git's words", async () => {
    repo({ "/ws/a.md": "A" }, { "/ws/a.md": "A changed" });
    expect(await commit("Nothing staged")).toBe(false);
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Couldn't commit: Nothing is staged. Stage the changes to commit first.");
  });

  it("says when the folder isn't in a repository", async () => {
    setBackend(new MemoryBackend({ files: { "/ws/a.md": "A" }, approved: ["/ws"] }));
    useWorkspace.getState().setRoot("/ws");
    const result = await loadChanges();
    expect(result && "error" in result && result.error).toMatch(/not a git repository/);
  });

  it("names each kind of change", () => {
    expect([changeLabel("M"), changeLabel("A"), changeLabel("D"), changeLabel("U"), changeLabel(null)]).toEqual(["Modified", "Added", "Deleted", "Untracked", "Changed"]);
  });
});
