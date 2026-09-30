/**
 * Commands recently run from the command palette, newest first, so an empty
 * palette offers them at the top. A per-computer convenience kept in local
 * storage; if storage isn't available, the palette just keeps its usual order.
 */

const KEY = "markpion.recentCommands";
const MAX = 5;

export function recentCommands(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberCommand(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...recentCommands().filter((c) => c !== id)].slice(0, MAX)));
  } catch {
    // Storage unavailable: nothing to remember.
  }
}
