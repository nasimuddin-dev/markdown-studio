import { describe, expect, it, vi } from "vitest";
import { MemoryBackend } from "../src/services/memoryBackend";
import { setBackend } from "../src/services";
import { useUi } from "../src/stores/uiStore";
import { useWorkspace } from "../src/stores/workspaceStore";
import { publishFolderToGitHubPages } from "../src/features/siteExport";

function repo() {
  const files = { "/ws/README.md": "# Notes\n\nSee [setup](guide/setup.md).", "/ws/guide/setup.md": "# Setup" };
  const backend = new MemoryBackend({ files, approved: ["/ws"], gitHead: files });
  setBackend(backend);
  useWorkspace.getState().setRoot("/ws");
  useUi.setState({ toasts: [], dialogs: [] });
  return backend;
}

/** Waits for the next dialog and answers it; returns what it said. */
async function answer(button: string) {
  await vi.waitFor(() => expect(useUi.getState().dialogs.length).toBeGreaterThan(0));
  const dialog = useUi.getState().dialogs[0];
  useUi.setState({ dialogs: [] });
  dialog.resolve({ button });
  return dialog;
}

describe("Publish Folder to GitHub Pages", () => {
  it("builds every page with a contents page and publishes them, then offers the site", async () => {
    const backend = repo();
    const publish = vi.spyOn(backend, "gitPublishPages").mockResolvedValue({ commit: "abc1234", remote: "origin", url: "https://owner.github.io/notes/", unchanged: false });
    const open = vi.spyOn(backend, "openExternal").mockResolvedValue();
    const done = publishFolderToGitHubPages();
    expect((await answer("publish")).message).toMatch(/^2 pages will be built from “ws”, committed to the gh-pages branch/);
    const published = await answer("open");
    await done;

    const [root, files, message] = publish.mock.calls[0];
    expect(root).toBe("/ws");
    expect(message).toBe("Publish 2 pages from ws");
    expect(files.map((f) => f.path)).toEqual(["README.html", "guide/setup.html", "index.html"]);
    // Links between documents point at the pages; each page links back to the contents.
    expect(files[0].content).toContain('href="guide/setup.html"');
    expect(files[1].content).toContain('href="../index.html"');
    expect(published.message).toBe("Published 2 pages (commit abc1234) to the gh-pages branch on origin.");
    expect(published.detail).toContain("https://owner.github.io/notes/");
    expect(open).toHaveBeenCalledWith("https://owner.github.io/notes/");
  });

  it("does nothing when cancelled", async () => {
    const backend = repo();
    const publish = vi.spyOn(backend, "gitPublishPages");
    const done = publishFolderToGitHubPages();
    await answer("cancel");
    await done;
    expect(publish).not.toHaveBeenCalled();
  });

  it("says so in a message when the remote isn't on GitHub or nothing changed", async () => {
    const backend = repo();
    vi.spyOn(backend, "gitPublishPages").mockResolvedValue({ commit: "abc1234", remote: "origin", url: null, unchanged: true });
    const done = publishFolderToGitHubPages();
    await answer("publish");
    await done;
    expect(useUi.getState().dialogs).toEqual([]);
    expect(useUi.getState().toasts.at(-1)?.message).toBe("The pages haven't changed since they were last published to the gh-pages branch on origin.");
  });

  it("explains Git's refusal, such as a repository without a remote", async () => {
    repo();
    const done = publishFolderToGitHubPages();
    await answer("publish");
    await done;
    expect(useUi.getState().toasts.at(-1)?.message).toBe("Couldn't publish the folder: This repository has no remote to publish to. Add one (for example on GitHub) with your Git tool first.");
  });
});
