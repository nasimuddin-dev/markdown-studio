import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { ShortcutsDialog } from "../src/components/ShortcutsDialog";
import { commands, handleGlobalKeydown } from "../src/features/commands";
import { newDocument } from "../src/features/documents";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

// The app loads this dialog on first use; load it up front so a cold import doesn't use up a test's time.
beforeAll(() => import("../src/components/ShortcutsDialog"), 30_000);

afterEach(() => useUi.setState({ focusMode: false, shortcutsOpen: false }));

describe("keyboard shortcuts reference", () => {
  it("lists commands by group and filters them", async () => {
    render(<ShortcutsDialog />);
    act(() => useUi.getState().setShortcutsOpen(true));
    expect(screen.getByRole("heading", { name: "Format" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Bold Ctrl\+B/ })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Filter commands" }), "find in files");
    expect(screen.getAllByRole("row").map((r) => [...r.querySelectorAll("td")].slice(0, 2).map((td) => td.textContent).join(""))).toEqual(["Find in FilesCtrl+Shift+F"]);
    await userEvent.clear(screen.getByRole("textbox", { name: "Filter commands" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Filter commands" }), "zzqqxx");
    expect(screen.getByText("No matching commands.")).toBeInTheDocument();
  });
});

describe("focus mode", () => {
  it("hides tabs, status bar and sidebar, and Escape exits", () => {
    setupBackend();
    render(<App />);
    act(() => {
      newDocument("# Draft");
    });
    expect(screen.getByRole("tablist", { name: "Open documents" })).toBeInTheDocument();

    act(() => void commands.focusMode.run());
    expect(screen.queryByRole("tablist", { name: "Open documents" })).toBeNull();
    expect(screen.queryByLabelText("Status bar")).toBeNull();
    expect(screen.queryByLabelText("File explorer")).toBeNull();
    expect(document.querySelector(".app")).toHaveClass("focus-mode");

    act(() => handleGlobalKeydown(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(useUi.getState().focusMode).toBe(false);
    expect(screen.getByRole("tablist", { name: "Open documents" })).toBeInTheDocument();
  });
});
