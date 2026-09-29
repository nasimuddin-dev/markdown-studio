import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileExplorer } from "../src/components/FileExplorer";
import { StatusBar } from "../src/components/StatusBar";
import { refreshGitStatus } from "../src/features/git";
import { setWorkspace, toggleDir } from "../src/features/workspace";
import { setBackend } from "../src/services";
import { MemoryBackend } from "../src/services/memoryBackend";
import { pathKey, useGit } from "../src/stores/gitStore";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";
import { useWorkspace } from "../src/stores/workspaceStore";
import type { GitStatus } from "../src/types";
import { setupBackend } from "./helpers";

const STATUS: GitStatus = {
  branch: "main",
  ahead: 1,
  behind: 0,
  files: [
    { path: "/ws/docs/guide.md", status: "M" },
    { path: "/ws/new.md", status: "U" },
  ],
};

function gitBackend(git?: GitStatus) {
  setupBackend(); // resets the stores
  const backend = new MemoryBackend({ files: { "/ws/new.md": "n", "/ws/docs/guide.md": "g", "/ws/docs/other.md": "o", "/ws/same.md": "s" }, approved: ["/ws"], git });
  setBackend(backend);
  useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
  return backend;
}

describe("Git status", () => {
  it("normalizes paths and marks folders that contain changes", () => {
    expect(pathKey("C:\\Repo\\Docs\\A.md")).toBe("c:/repo/docs/a.md");
    expect(pathKey("/home/me/Notes/")).toBe("/home/me/Notes");
    useGit.getState().set(STATUS);
    expect(useGit.getState().files.get("/ws/docs/guide.md")).toBe("M");
    expect([...useGit.getState().changedDirs].sort()).toEqual(["/ws", "/ws/docs"]);
    useGit.getState().set(null);
    expect(useGit.getState().files.size).toBe(0);
  });

  it("shows file states in the Explorer and the branch in the status bar", async () => {
    gitBackend(STATUS);
    render(
      <>
        <FileExplorer />
        <StatusBar />
      </>,
    );
    await act(async () => {
      await setWorkspace("/ws");
      await refreshGitStatus();
    });
    expect(await screen.findByLabelText("Git: untracked")).toHaveTextContent("U");
    expect(screen.getByLabelText("contains Git changes")).toBeInTheDocument();
    await act(async () => {
      await toggleDir("/ws/docs");
    });
    expect(screen.getByLabelText("Git: modified")).toHaveTextContent("M");
    expect(screen.getAllByLabelText(/^Git:/)).toHaveLength(2);
    expect(screen.getByText(/⎇ main/)).toHaveTextContent("⎇ main ↑1");
  });

  it("shows nothing when the setting is off or there is no repository", async () => {
    gitBackend(STATUS);
    await act(async () => {
      await setWorkspace("/ws");
    });
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, showGitStatus: false } });
    await refreshGitStatus();
    expect(useGit.getState().status).toBeNull();
    gitBackend(undefined);
    await act(async () => {
      await setWorkspace("/ws");
    });
    await refreshGitStatus();
    expect(useGit.getState().status).toBeNull();
  });

  it("Close Folder in the Explorer removes the folder from view without deleting anything", async () => {
    const backend = gitBackend();
    render(<FileExplorer />);
    await act(async () => {
      await setWorkspace("/ws");
    });
    await userEvent.click(screen.getByRole("button", { name: "Close folder" }));
    expect(useWorkspace.getState().root).toBeNull();
    expect((await backend.readTextFile("/ws/new.md")).content).toBe("n");
  });
});
