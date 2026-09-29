import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsDialog } from "../src/components/ShortcutsDialog";
import { applyKeybindings, commands, commandWithShortcut, defaultShortcut, handleGlobalKeydown } from "../src/features/commands";
import { sanitizeSettings, useSettings } from "../src/stores/settingsStore";
import { useUi } from "../src/stores/uiStore";
import { autoAnswer, setupBackend } from "./helpers";


// Keep command.shortcut in sync with the settings, as the app does at startup.
useSettings.subscribe((s, prev) => {
  if (s.settings.keybindings !== prev.settings.keybindings) applyKeybindings(s.settings.keybindings);
});

afterEach(() => {
  act(() => useSettings.getState().update({ keybindings: {} }));
});

describe("custom keyboard shortcuts", () => {
  it("keeps only valid shortcuts in settings", () => {
    const k = sanitizeSettings({ keybindings: { save: "Mod+Shift+K", print: null, bold: "Hyper+Q", "bad id": "Mod+J", zoomIn: "F13" } }).keybindings;
    expect(k).toEqual({ save: "Mod+Shift+K", print: null, zoomIn: "F13" });
  });

  it("applies, removes and restores shortcuts", () => {
    applyKeybindings({ save: "Mod+Shift+K", print: null });
    expect(commands.save.shortcut).toBe("Mod+Shift+K");
    expect(commands.print.shortcut).toBeUndefined();
    expect(commandWithShortcut("Mod+Shift+K")?.id).toBe("save");
    expect(commandWithShortcut("Mod+S")).toBeUndefined();
    applyKeybindings({});
    expect(commands.save.shortcut).toBe(defaultShortcut("save"));
    expect(commandWithShortcut("Mod+S")?.id).toBe("save");
  });

  it("records a new shortcut in the dialog, and the command runs with it", async () => {
    setupBackend();
    render(<ShortcutsDialog />);
    act(() => useUi.getState().setShortcutsOpen(true));
    await userEvent.click(screen.getByRole("button", { name: "Change shortcut for Toggle Focus Mode" }));
    expect(screen.getByText("Press a shortcut…")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Shift" }); // a modifier alone is ignored
    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true, altKey: true });
    expect(useSettings.getState().settings.keybindings).toEqual({ focusMode: "Mod+Alt+K" });
    expect(screen.getByRole("row", { name: /Toggle Focus Mode Ctrl\+Alt\+K/ })).toBeInTheDocument();
    // The new shortcut works everywhere.
    act(() => handleGlobalKeydown(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, altKey: true })));
    expect(useUi.getState().focusMode).toBe(true);
    act(() => useUi.getState().setFocusMode(false));
    await userEvent.click(screen.getByRole("button", { name: "Reset shortcut for Toggle Focus Mode" }));
    expect(useSettings.getState().settings.keybindings).toEqual({});
    // Role queries over the full command list are slow in jsdom when every test file runs at once.
  }, 20_000);

  it("asks before taking a shortcut from another command", async () => {
    setupBackend();
    render(<ShortcutsDialog />);
    act(() => useUi.getState().setShortcutsOpen(true));
    const answered = autoAnswer("replace");
    await userEvent.click(screen.getByRole("button", { name: "Change shortcut for Toggle Focus Mode" }));
    await act(async () => {
      fireEvent.keyDown(window, { key: "b", code: "KeyB", ctrlKey: true });
      await new Promise((r) => setTimeout(r, 0));
    });
    answered.stop();
    expect(answered.titles).toEqual(["Shortcut already in use"]);
    expect(useSettings.getState().settings.keybindings).toEqual({ bold: null, focusMode: "Mod+B" });
  });
});
