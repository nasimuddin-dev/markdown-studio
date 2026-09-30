import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Welcome } from "../src/components/Welcome";
import { setupBackend } from "./helpers";

describe("recent files and folders", () => {
  it("removes one entry, or clears the list, without deleting files", async () => {
    // Files chosen in the Open dialog are remembered as recent.
    const backend = setupBackend({ "/ws/a.md": "a", "/ws/b.md": "b" }, ["/ws/b.md", "/ws/a.md"]);
    await backend.pickOpenFile();
    await backend.pickOpenFile();
    render(<Welcome />);
    expect(await screen.findByRole("button", { name: "Remove a.md from Recent" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove a.md from Recent" }));
    expect(await backend.listRecent()).toEqual([expect.objectContaining({ path: "/ws/b.md" })]);
    await screen.findByRole("button", { name: "Remove b.md from Recent" });
    expect(screen.queryByRole("button", { name: "Remove a.md from Recent" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Clear recent files and folders" }));
    expect(await backend.listRecent()).toEqual([]);
    await act(async () => {});
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("a");
  });
});
