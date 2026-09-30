import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileExplorer } from "../src/components/FileExplorer";
import { DialogHost } from "../src/components/Dialogs";
import { openPath } from "../src/features/documents";
import { renameDocument } from "../src/features/pathActions";
import { setBackend } from "../src/services";
import { MemoryBackend } from "../src/services/memoryBackend";
import { useUi } from "../src/stores/uiStore";
import { docs, setupBackend } from "./helpers";

/** A backend where only one file is approved, as after File → Open without a folder. */
function singleFile() {
  setupBackend();
  const b = new MemoryBackend({ files: { "/notes/a.md": "# A", "/notes/other.md": "x" }, prompt: () => "/notes/a.md" });
  setBackend(b);
  return b;
}

/** Answers the next text prompt with `value`. */
function answerPrompt(value: string) {
  const unsub = useUi.subscribe((s) => {
    const d = s.dialogs[0];
    if (!d) return;
    unsub();
    queueMicrotask(() => useUi.getState().closeDialog(d.id, { button: "ok", value }));
  });
}

describe("renaming a file opened on its own", () => {
  it("renames it in its folder from a tab or the Explorer, without opening the folder", async () => {
    const b = singleFile();
    await act(async () => void (await b.pickOpenFile()));
    const id = (await openPath("/notes/a.md"))!;
    answerPrompt("renamed.md");
    await act(() => renameDocument(id));
    expect(docs()[0]).toMatchObject({ path: "/notes/renamed.md", name: "renamed.md" });
    expect((await b.readTextFile("/notes/renamed.md")).content).toBe("# A");
    // The approval moved with it; the rest of the folder is still out of reach.
    await expect(b.readTextFile("/notes/a.md")).rejects.toMatchObject({ kind: "outOfScope" });
    await expect(b.readTextFile("/notes/other.md")).rejects.toMatchObject({ kind: "outOfScope" });
    // The recent list follows the new name.
    expect((await b.listRecent()).map((r) => r.path)).toEqual(["/notes/renamed.md"]);
  });

  it("renames the active file from File → Rename File…", async () => {
    const b = singleFile();
    await act(async () => void (await b.pickOpenFile()));
    await openPath("/notes/a.md");
    const { commands } = await import("../src/features/commands");
    expect(commands.renameFile.enabled!()).toBe(true);
    answerPrompt("from-command.md");
    await act(async () => void (await commands.renameFile.run()));
    expect(docs()[0].path).toBe("/notes/from-command.md");
  });

  it("lists open files in the Explorer when no folder is open", async () => {
    const b = singleFile();
    await act(async () => void (await b.pickOpenFile()));
    render(
      <>
        <FileExplorer />
        <DialogHost />
      </>,
    );
    await act(async () => void (await openPath("/notes/a.md")));
    const list = screen.getByRole("region", { name: "Open files" });
    const row = screen.getByRole("button", { name: /a\.md/ });
    expect(list).toContainElement(row);
    expect(row).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Open “notes”" })).toBeInTheDocument();

    answerPrompt("b.md");
    row.focus();
    await userEvent.keyboard("{F2}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(await screen.findByRole("button", { name: /b\.md/ })).toBeInTheDocument();
  });
});
