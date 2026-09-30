import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { useUi } from "../src/stores/uiStore";
import { useSettings } from "../src/stores/settingsStore";
import { autoAnswer, setupBackend } from "./helpers";

describe("settings sections", () => {
  it("lists the sections and jumps to one", async () => {
    setupBackend();
    render(<SettingsDialog />);
    act(() => useUi.getState().setSettingsOpen(true));
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Appearance", "Editor", "Files", "Preview", "Export", "AI Assistant", "Startup"]);
    expect(buttons[0]).toHaveAttribute("aria-current", "true");
    // jsdom has no layout, so only the highlight and focus are checked.
    (HTMLElement.prototype as unknown as { scrollTo(): void }).scrollTo ??= () => {};
    await userEvent.click(buttons[4]);
    expect(buttons[4]).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Page size for PDF and Word")).toHaveFocus();
  });

  it("filters settings by the search text", async () => {
    setupBackend();
    render(<SettingsDialog />);
    act(() => useUi.getState().setSettingsOpen(true));
    const visible = (text: RegExp) => {
      const el = screen.getByText(text).closest("label, section") as HTMLElement;
      return el.style.display !== "none" && (el.closest("section") as HTMLElement).style.display !== "none";
    };
    await userEvent.type(screen.getByRole("searchbox", { name: "Search settings" }), "wrap");
    expect(visible(/Wrap long lines/)).toBe(true);
    expect(visible(/Show line numbers/)).toBe(false);
    expect(visible(/Reopen last folder/)).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("1 setting found");

    // A section's name shows all of its settings.
    await userEvent.clear(screen.getByRole("searchbox", { name: "Search settings" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search settings" }), "startup");
    expect(visible(/Reopen last folder/)).toBe(true);
    expect(visible(/Check for updates/)).toBe(true);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search settings" }), "zzz");
    expect(screen.getByText(/No settings match/)).toBeInTheDocument();
    // Escape clears the search before it would close the dialog.
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("searchbox", { name: "Search settings" })).toHaveValue("");
    expect(useUi.getState().settingsOpen).toBe(true);
    expect(visible(/Show line numbers/)).toBe(true);
  });
});

describe("reset to defaults", () => {
  it("asks first and only resets when confirmed", async () => {
    setupBackend();
    render(<SettingsDialog />);
    act(() => useUi.getState().setSettingsOpen(true));
    act(() => useSettings.getState().update({ lineNumbers: false, fontSize: 19 }));
    const reset = screen.getByRole("button", { name: "Reset to Defaults…" });

    let answered = autoAnswer("cancel");
    await userEvent.click(reset);
    answered.stop();
    expect(answered.titles).toEqual(["Reset settings"]);
    expect(useSettings.getState().settings).toMatchObject({ lineNumbers: false, fontSize: 19 });

    answered = autoAnswer("reset");
    await userEvent.click(reset);
    answered.stop();
    await vi.waitFor(() => expect(useSettings.getState().settings).toMatchObject({ lineNumbers: true, fontSize: 15 }));
  });
});
