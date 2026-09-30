import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MenuBar } from "../src/components/MenuBar";
import { commands } from "../src/features/commands";
import { nativeMenus, runMenuCommand } from "../src/features/nativeMenu";
import type { NativeMenu } from "../src/services/backend";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

describe("native menu bar", () => {
  it("sends commands by id with menu labels, keeps submenus, drops recent files and empty submenus", () => {
    const sep = { type: "separator" } as const;
    const menus = nativeMenus([
      {
        label: "Table",
        items: [
          sep,
          { type: "command", id: "newFile" },
          sep,
          { type: "submenu", label: "Open Recent", items: [{ type: "recent" }, sep] },
          sep,
          { type: "command", id: "save", label: "Save Now" },
          { type: "command", id: "tableRowAbove" },
          { type: "submenu", label: "Export", items: [{ type: "command", id: "exportPdf", label: "PDF…" }, sep] },
          sep,
        ],
      },
    ]);
    expect(menus).toEqual([
      {
        label: "Table",
        items: [
          { type: "command", id: "newFile", label: "New File" },
          { type: "separator" },
          { type: "command", id: "save", label: "Save Now" },
          { type: "command", id: "tableRowAbove", label: "Insert Row Above" },
          { type: "submenu", label: "Export", items: [{ type: "command", id: "exportPdf", label: "PDF…" }] },
        ],
      },
    ]);
  });

  it("runs a chosen command, but not while a dialog is open", () => {
    setupBackend();
    const run = vi.spyOn(commands.toggleTheme, "run").mockImplementation(() => {});
    runMenuCommand("toggleTheme");
    expect(run).toHaveBeenCalledTimes(1);
    useUi.setState({ dialogs: [{ id: 1, kind: "confirm", title: "x", message: "", buttons: [], cancelId: "x" } as never] });
    runMenuCommand("toggleTheme");
    runMenuCommand("noSuchCommand");
    expect(run).toHaveBeenCalledTimes(1);
    run.mockRestore();
    useUi.setState({ dialogs: [] });
  });

  it("hides the in-app menus when the host shows them in the system menu bar", async () => {
    const backend = setupBackend();
    let sent: NativeMenu[] = [];
    let choose: ((id: string) => void) | undefined;
    backend.setNativeMenu = async (menus) => {
      sent = menus;
      return true;
    };
    backend.onMenuCommand = async (handler) => {
      choose = handler;
      return () => {};
    };
    render(<MenuBar />);
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Application menu" })).toBeNull());
    expect(sent.map((m) => m.label)).toContain("Edit");
    const file = sent.find((m) => m.label === "File")!;
    expect(file.items.some((i) => i.type === "submenu" && i.label === "Export")).toBe(true);
    // Open Recent only holds the recent list (in-app) and Clear Recent.
    expect(file.items.find((i) => i.type === "submenu" && i.label === "Open Recent")).toEqual({
      type: "submenu",
      label: "Open Recent",
      items: [{ type: "command", id: "clearRecent", label: "Clear Recent" }],
    });
    const run = vi.spyOn(commands.toggleTheme, "run").mockImplementation(() => {});
    act(() => choose?.("toggleTheme"));
    expect(run).toHaveBeenCalledTimes(1);
    run.mockRestore();
  });

  it("keeps the in-app menus where there's no system menu bar", async () => {
    setupBackend();
    render(<MenuBar />);
    expect(await screen.findByRole("navigation", { name: "Application menu" })).toBeTruthy();
  });
});
