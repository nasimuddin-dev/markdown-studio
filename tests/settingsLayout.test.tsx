import { describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

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
});
