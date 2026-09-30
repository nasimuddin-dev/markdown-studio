import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar } from "../src/components/MenuBar";
import { commands } from "../src/features/commands";
import { commandLocations, MENUS, type MenuItem } from "../src/features/menus";
import { useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

const allCommandIds = (items: MenuItem[]): string[] =>
  items.flatMap((i) => (i.type === "command" ? [i.id] : i.type === "submenu" ? allCommandIds(i.items) : []));

describe("menu model", () => {
  it("refers only to commands that exist", () => {
    const ids = MENUS.flatMap((m) => allCommandIds(m.items));
    expect(ids.filter((id) => !commands[id])).toEqual([]);
    expect(ids.length).toBeGreaterThan(150);
  });

  it("keeps every menu and submenu short enough to scan", () => {
    const check = (items: MenuItem[], path: string) => {
      const entries = items.filter((i) => i.type !== "separator");
      expect(entries.length, path).toBeLessThanOrEqual(30);
      for (const i of items) {
        if (i.type === "submenu") {
          expect(i.items.some((x) => x.type === "submenu"), `${path} › ${i.label} nests too deep`).toBe(false);
          check(i.items, `${path} › ${i.label}`);
        }
      }
    };
    for (const m of MENUS) check(m.items, m.label);
  });

  it("knows where each command lives", () => {
    const where = commandLocations();
    expect(where.get("heading2")).toBe("Format › Heading");
    expect(where.get("exportPdf")).toBe("File › Export");
    expect(where.get("save")).toBe("File");
    expect(where.get("commandPalette")).toBe("View"); // the first place wins
  });
});

describe("menu bar", () => {
  it("opens submenus on hover or click and runs their commands", async () => {
    setupBackend();
    const user = userEvent.setup();
    render(<MenuBar />);
    await user.click(await screen.findByRole("button", { name: "File" }));
    const exportRow = screen.getByRole("menuitem", { name: "Export" });
    expect(exportRow).toHaveAttribute("aria-haspopup", "menu");
    await user.hover(exportRow);
    const flyout = await screen.findByRole("menu", { name: "Export" });
    expect(exportRow).toHaveAttribute("aria-expanded", "true");
    expect(flyout).toHaveTextContent("PDF…");
    // Hovering a plain row closes it again.
    await user.hover(screen.getByRole("menuitem", { name: /^Print/ }));
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Export" })).toBeNull());
  });

  it("is fully keyboard operable", async () => {
    setupBackend();
    const user = userEvent.setup();
    render(<MenuBar />);
    const file = await screen.findByRole("button", { name: "File" });
    file.focus();
    await user.keyboard("{ArrowDown}");
    const recent = screen.getByRole("menuitem", { name: "Open Recent" });
    // Move to the Open Recent row (disabled rows are skipped).
    for (let i = 0; i < 20 && document.activeElement !== recent; i++) await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(recent);
    await user.keyboard("{ArrowRight}");
    const flyout = await screen.findByRole("menu", { name: "Open Recent" });
    await waitFor(() => expect(document.activeElement).toHaveTextContent("Clear Recent"));
    expect(flyout.contains(document.activeElement)).toBe(true);
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Open Recent" })).toBeNull());
    expect(document.activeElement).toBe(recent);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "File" })).toBeNull();
    expect(document.activeElement).toBe(file);
  });

  it("shows check marks for settings that are on", async () => {
    setupBackend();
    act(() => useSettings.getState().update({ lineWrapping: true, lineNumbers: false, viewMode: "split" }));
    const user = userEvent.setup();
    render(<MenuBar />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    expect(screen.getByRole("menuitemcheckbox", { name: /Split View/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: /Editor Only/ })).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("menuitem", { name: "Editor" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: /Word Wrap/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: /Line Numbers/ })).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Line Numbers/ }));
    expect(useSettings.getState().settings.lineNumbers).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lists recent files in the Open Recent submenu", async () => {
    const backend = setupBackend({ "/ws/a.md": "x" });
    backend.listRecent = async () => [{ path: "/ws/a.md", kind: "file" } as never];
    const user = userEvent.setup();
    render(<MenuBar />);
    await user.click(await screen.findByRole("button", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: "Open Recent" }));
    const flyout = await screen.findByRole("menu", { name: "Open Recent" });
    expect(flyout).toHaveTextContent("a.md");
    expect(flyout).toHaveTextContent("Clear Recent");
  });
});
