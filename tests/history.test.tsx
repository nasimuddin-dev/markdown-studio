import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { diffLines, diffStats, withContext } from "../src/features/diff";
import { HistoryDialog, relativeTime } from "../src/components/HistoryDialog";
import { openPath, saveDocument } from "../src/features/documents";
import { useDocuments } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { docs, setupBackend } from "./helpers";
import { setBackend } from "../src/services";
import { MemoryBackend } from "../src/services/memoryBackend";

describe("line diff", () => {
  it("finds added and removed lines", () => {
    const d = diffLines("a\nb\nc\nd", "a\nB\nc\nd\ne")!;
    expect(d.map((l) => `${l.kind}:${l.text}`)).toEqual(["same:a", "add:B", "del:b", "same:c", "same:d", "add:e"]);
    expect(diffStats(d)).toEqual({ added: 2, removed: 1 });
  });

  it("collapses unchanged runs around changes", () => {
    const old = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const now = old.replace("line 10", "LINE 10");
    const rows = withContext(diffLines(old, now)!, 2);
    expect(rows[0]).toEqual({ kind: "gap", hidden: 8 });
    expect(rows.filter((r) => r.kind !== "gap")).toHaveLength(6);
    expect(rows.at(-1)).toEqual({ kind: "gap", hidden: 7 });
  });

  it("formats relative times", () => {
    const now = Date.UTC(2026, 8, 23, 12);
    expect(relativeTime(now - 10_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toMatch(/5 minutes ago/);
    expect(relativeTime(now - 3 * 3600_000, now)).toMatch(/3 hours ago/);
  });
});

describe("file history", () => {
  it("keeps the previous version on save and restores it as an undoable edit", async () => {
    const backend = setupBackend({ "/ws/a.md": "first draft\n" });
    const id = (await openPath("/ws/a.md"))!;
    useDocuments.getState().setContent(id, "second draft\n");
    await saveDocument(id);
    useDocuments.getState().setContent(id, "third draft\n");
    await saveDocument(id);

    const versions = await backend.listHistory("/ws/a.md");
    expect(versions).toHaveLength(2);
    expect(await backend.readHistory("/ws/a.md", versions[1].id)).toBe("first draft\n");

    render(<HistoryDialog />);
    act(() => useUi.getState().setHistoryDocId(id));
    const options = within(await screen.findByRole("list", { name: "Versions" })).getAllByRole("button");
    expect(options).toHaveLength(2);
    await userEvent.click(options[1]);
    await waitFor(() => expect(screen.getByText(/− 1 in this version/)).toBeInTheDocument());
    expect(document.querySelector(".diff-del")?.textContent).toContain("first draft");

    await userEvent.click(screen.getByRole("button", { name: "Restore This Version" }));
    expect(docs()[0].content).toBe("first draft\n");
    expect(docs()[0].savedContent).toBe("third draft\n"); // dirty until saved
    expect(useUi.getState().historyDocId).toBeNull();
  });

  it("explains when there is no history yet", async () => {
    setupBackend({ "/ws/new.md": "x" });
    const id = (await openPath("/ws/new.md"))!;
    render(<HistoryDialog />);
    act(() => useUi.getState().setHistoryDocId(id));
    expect(await screen.findByText(/No earlier versions yet/)).toBeInTheDocument();
  });

  it("shows unsaved changes against the saved file, and can discard them", async () => {
    setupBackend({ "/ws/a.md": "saved line\n" });
    const id = (await openPath("/ws/a.md"))!;
    useDocuments.getState().setContent(id, "unsaved line\n");
    render(<HistoryDialog />);
    act(() => useUi.getState().setHistoryDocId(id));
    const entry = await screen.findByRole("button", { name: /Saved file/ });
    expect(entry).toHaveAttribute("aria-current", "true");
    await waitFor(() => expect(document.querySelector(".diff-del")?.textContent).toContain("saved line"));
    expect(document.querySelector(".diff-add")?.textContent).toContain("unsaved line");
    await userEvent.click(screen.getByRole("button", { name: "Restore This Version" }));
    expect(docs()[0].content).toBe("saved line\n");
  });

  it("offers the last Git commit to compare with and restore", async () => {
    setupBackend();
    setBackend(new MemoryBackend({ files: { "/ws/a.md": "edited line\n" }, approved: ["/ws"], gitHead: { "/ws/a.md": "committed line\n" } }));
    const id = (await openPath("/ws/a.md"))!;
    render(<HistoryDialog />);
    act(() => useUi.getState().setHistoryDocId(id));
    const entry = await screen.findByRole("button", { name: /Last commit/ });
    expect(entry).toHaveAttribute("aria-current", "true"); // no saved versions yet
    await waitFor(() => expect(document.querySelector(".diff-del")?.textContent).toContain("committed line"));
    await userEvent.click(screen.getByRole("button", { name: "Restore This Version" }));
    expect(docs()[0].content).toBe("committed line\n");
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/Restored the last committed version/);
  });
});
