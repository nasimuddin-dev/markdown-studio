import type { NativeMenu, NativeMenuItem } from "../services/backend";
import { useUi } from "../stores/uiStore";
import { commands, type Command } from "./commands";
import { menuLabel, type MenuDef, type MenuItem } from "./menus";

/**
 * The native menu bar (macOS) for the in-app menus: commands by id and label,
 * submenus, and separators. Recent files stay in the in-app lists; submenus
 * left empty are dropped, and runs of separators collapse to one. Items carry
 * no accelerators: keys keep going through the app's own shortcut handling,
 * so the editor still gets the ones it owns.
 */
export function nativeMenus(menus: MenuDef[]): NativeMenu[] {
  const convert = (items: MenuItem[], menu: string): NativeMenuItem[] => {
    const out: NativeMenuItem[] = [];
    for (const item of items) {
      if (item.type === "separator") {
        if (out.length && out[out.length - 1].type !== "separator") out.push({ type: "separator" });
      } else if (item.type === "command") {
        out.push({ type: "command", id: item.id, label: menuLabel(item, menu) });
      } else if (item.type === "submenu") {
        const children = convert(item.items, menu);
        if (children.some((c) => c.type !== "separator")) out.push({ type: "submenu", label: item.label, items: children });
      }
    }
    if (out[out.length - 1]?.type === "separator") out.pop();
    return out;
  };
  return menus.map((m) => ({ label: m.label, items: convert(m.items, m.label) }));
}

/** Runs a command chosen in the native menu, if it's available now (not behind a dialog). */
export function runMenuCommand(id: string) {
  const command = (commands as Record<string, Command>)[id];
  if (!command || useUi.getState().dialogs.length > 0) return;
  if (command.enabled && !command.enabled()) return;
  void command.run();
}
