/**
 * The command registry: every action the menus, the command palette, the
 * toolbar and the keyboard can run, by id. The commands themselves live in
 * commands/ (one file per area); this file joins them and handles shortcuts.
 */
import type { KeyBinding } from "@codemirror/view";
import { useUi } from "../stores/uiStore";
import { isMac, type Command } from "./commands/core";
import { formatCommands } from "./commands/format";
import { documentCommands } from "./commands/document";
import { editCommands } from "./commands/edit";
import { viewCommands } from "./commands/view";
import { aiCommands } from "./commands/ai";
import { helpCommands } from "./commands/help";

export { isMac, formatCommands, type Command };

export const commands: Record<string, Command> = {
  ...documentCommands,
  ...editCommands,
  ...viewCommands,
  ...aiCommands,
  ...helpCommands,
};

Object.assign(commands, formatCommands);

/** CodeMirror keymap for editor commands, derived from the shortcuts above. */
export function editorKeymap(): KeyBinding[] {
  const toKey = (shortcut: string) => shortcut.replace(/\+/g, "-").replace(/-([A-Z])$/, (_, k: string) => "-" + k.toLowerCase());
  // Every command that edits the text (Format and Edit menus, and shortcuts users assign to them).
  const format = Object.values(commands)
    .filter((c) => c.shortcut && c.editor)
    .map((c) => ({ key: toKey(c.shortcut!), run: c.editor!, preventDefault: true }));
  // App shortcuts CodeMirror would otherwise capture: some keyboards/IMEs report
  // Ctrl+Shift+F as a lowercase "f", which CodeMirror treats as Mod-f (find).
  const app = {
    any: (_view: unknown, e: KeyboardEvent) => {
      if (eventToShortcut(e) !== commands.findInFiles.shortcut) return false;
      e.preventDefault();
      void commands.findInFiles.run();
      return true;
    },
  };
  return [app, ...format];
}

/** Human-readable shortcut for menus and tooltips. */
export function formatShortcut(shortcut?: string): string {
  if (!shortcut) return "";
  if (isMac) {
    return shortcut
      .replace("Mod+", "⌘")
      .replace("Ctrl+", "⌃")
      .replace("Shift+", "⇧")
      .replace("Alt+", "⌥");
  }
  return shortcut.replace("Mod+", "Ctrl+");
}

/** Normalizes a keyboard event to the shortcut format used above. */
export function eventToShortcut(e: KeyboardEvent): string {
  const parts: string[] = [];
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod) parts.push("Mod");
  if (isMac && e.ctrlKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let key = e.key;
  if (key === "+") key = "=";
  if (key.length === 1) key = key.toUpperCase();
  // With Shift held, some layouts report the shifted symbol; use the code instead.
  if (e.code?.startsWith("Digit")) key = e.code.slice(5);
  if (e.code === "Backslash") key = "\\";
  if (e.code === "Comma") key = ",";
  if (e.code === "Period") key = ".";
  if (e.code === "Equal") key = "=";
  if (e.code === "Minus") key = "-";
  if (e.code?.startsWith("Key") && (e.altKey || e.shiftKey)) key = e.code.slice(3);
  parts.push(key);
  return parts.join("+");
}

const EDITOR_OWNED = new Set(["undo", "redo", "selectAll", "find", "replace", "gotoLine"]);

/** "Ctrl+Tab" on Windows/Linux is "Mod+Tab" after normalization. */
const normalizeShortcut = (shortcut: string) => (!isMac ? shortcut.replace(/^Ctrl\+/, "Mod+") : shortcut);

function buildShortcutMap() {
  const map = new Map<string, Command>();
  for (const c of Object.values(commands)) if (c.shortcut) map.set(normalizeShortcut(c.shortcut), c);
  return map;
}
let byShortcut = buildShortcutMap();

/** Each command's built-in shortcut, before the user's changes. */
const DEFAULT_SHORTCUTS = new Map(Object.values(commands).map((c) => [c.id, c.shortcut] as const));

export function defaultShortcut(id: string): string | undefined {
  return DEFAULT_SHORTCUTS.get(id);
}

/**
 * Applies the user's shortcuts (Settings `keybindings`: command id → shortcut,
 * or `null` for none) over the built-in ones. Menus, the command palette and
 * the global and editor key handling all read `command.shortcut`.
 */
export function applyKeybindings(overrides: Record<string, string | null>) {
  for (const c of Object.values(commands)) {
    const id = c.id;
    c.shortcut = Object.hasOwn(overrides, id) ? (overrides[id] ?? undefined) : DEFAULT_SHORTCUTS.get(id);
  }
  byShortcut = buildShortcutMap();
}

/** The command that already uses a shortcut, if any (besides `exceptId`). */
export function commandWithShortcut(shortcut: string, exceptId?: string): Command | undefined {
  const c = byShortcut.get(normalizeShortcut(shortcut));
  return c && c.id !== exceptId ? c : undefined;
}

export function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;
  if (e.key === "Escape" && useUi.getState().focusMode && useUi.getState().dialogs.length === 0) {
    useUi.getState().setFocusMode(false);
    return;
  }
  const shortcut = eventToShortcut(e);
  const cmd = shortcut === "F1" ? commands.commandPalette : byShortcut.get(shortcut);
  if (!cmd) return;
  const inEditor = (e.target as HTMLElement | null)?.closest?.(".cm-editor");
  if ((EDITOR_OWNED.has(cmd.id) || cmd.editor) && inEditor) return;
  // Leave clipboard/undo shortcuts alone inside ordinary text fields.
  const inField = (e.target as HTMLElement | null)?.closest?.("input, textarea, select");
  if (inField && ["undo", "redo", "selectAll"].includes(cmd.id)) return;
  if (useUi.getState().dialogs.length > 0) return;
  if (cmd.enabled && !cmd.enabled()) return;
  e.preventDefault();
  void cmd.run();
}
