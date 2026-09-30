import type { NativeMenu } from "../services/backend";
import { useUi } from "../stores/uiStore";
import { commands, type Command } from "./commands";

/**
 * The native menu bar (macOS) for the in-app menus' command items. Recent
 * files stay in the in-app lists, and runs of separators left around them
 * collapse to one. Items carry no accelerators: keys keep going through the
 * app's own shortcut handling, so the editor still gets the ones it owns.
 */
export function nativeMenus(menus: Array<{ label: string; items: Array<{ type: string; command?: Command; label?: string }> }>): NativeMenu[] {
  return menus.map((m) => {
    const items: NativeMenu["items"] = [];
    for (const item of m.items) {
      if (item.type === "separator") {
        if (items.length && items[items.length - 1].type !== "separator") items.push({ type: "separator" });
      } else if (item.type === "command" && item.command) {
        items.push({ type: "command", id: item.command.id, label: item.label ?? item.command.label });
      }
    }
    if (items[items.length - 1]?.type === "separator") items.pop();
    return { label: m.label, items };
  });
}

/** Runs a command chosen in the native menu, if it's available now (not behind a dialog). */
export function runMenuCommand(id: string) {
  const command = (commands as Record<string, Command>)[id];
  if (!command || useUi.getState().dialogs.length > 0) return;
  if (command.enabled && !command.enabled()) return;
  void command.run();
}
