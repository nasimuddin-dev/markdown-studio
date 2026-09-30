import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fuzzyFilter, fuzzyScore } from "../src/features/fuzzy";
import { CommandPalette } from "../src/components/CommandPalette";
import { useUi } from "../src/stores/uiStore";
import { useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

describe("fuzzy matching", () => {
  it("matches characters in order and rejects others", () => {
    expect(fuzzyScore("sv", "Save")).not.toBeNull();
    expect(fuzzyScore("vs", "Save")).toBeNull();
    expect(fuzzyScore("", "anything")).toEqual({ score: 0, indices: [] });
  });

  it("ranks word-start and consecutive matches first", () => {
    const labels = ["Close Tab", "Save As", "Save", "Select All"];
    expect(fuzzyFilter(labels, "save", (s) => s).map((r) => r.item)).toEqual(["Save", "Save As"]);
    expect(fuzzyFilter(labels, "sa", (s) => s)[0].item).toBe("Save");
    expect(fuzzyFilter(labels, "ct", (s) => s)[0].item).toBe("Close Tab");
  });
});

describe("command palette", () => {
  it("filters commands and runs the chosen one with the keyboard", async () => {
    setupBackend();
    useSettings.setState((s) => ({ settings: { ...s.settings, viewMode: "split" } }));
    render(<CommandPalette />);
    act(() => useUi.getState().setPaletteOpen(true));

    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    await userEvent.type(input, "preview only");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Preview Only");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");
    expect(useUi.getState().paletteOpen).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(useSettings.getState().settings.viewMode).toBe("preview");
  });

  it("closes on Escape and shows an empty state", async () => {
    setupBackend();
    render(<CommandPalette />);
    act(() => useUi.getState().setPaletteOpen(true));
    await userEvent.type(screen.getByRole("combobox"), "zzzzqqq");
    expect(screen.getByText("No matching commands")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(useUi.getState().paletteOpen).toBe(false);
  });
});

describe("go to heading", () => {
  it("lists the document's headings and jumps to the chosen one", async () => {
    const { openPath } = await import("../src/features/documents");
    const editorBridge = await import("../src/features/editorBridge");
    setupBackend({ "/ws/a.md": "# Title\n\n## Install\n\ntext\n\n### Windows\n\n## Usage\n" });
    useSettings.setState((s) => ({ settings: { ...s.settings, viewMode: "editor" } }));
    await openPath("/ws/a.md");
    const revealed: number[] = [];
    const spy = vi.spyOn(editorBridge, "revealLine").mockImplementation((line) => void revealed.push(line));
    render(<CommandPalette />);
    act(() => useUi.getState().openHeadingPicker());
    expect(screen.getByRole("dialog", { name: "Go to heading" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "TitleH1 · line 1", "InstallH2 · line 3", "WindowsH3 · line 7", "UsageH2 · line 9",
    ]);
    await userEvent.type(screen.getByRole("combobox"), "win");
    await userEvent.keyboard("{Enter}");
    await new Promise((r) => setTimeout(r, 0));
    expect(revealed).toEqual([7]);
    spy.mockRestore();
  });
});
