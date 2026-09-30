/**
 * Folder hints for tabs whose file names are the same (two README.md files):
 * the shortest end of each one's folder path that tells them apart, such as
 * "docs" and "notes", or "api/docs" and "web/docs".
 */
export function tabHints(docs: ReadonlyArray<{ id: string; name: string; path: string | null }>): Map<string, string> {
  const hints = new Map<string, string>();
  const groups = new Map<string, Array<{ id: string; dirs: string[] }>>();
  for (const d of docs) {
    if (!d.path) continue;
    const parts = d.path.split(/[\\/]/).filter(Boolean);
    const key = d.name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), { id: d.id, dirs: parts.slice(0, -1) }]);
  }
  const suffix = (dirs: string[], depth: number) => dirs.slice(-depth).join("/");
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const g of group) {
      // Each tab gets the shortest end of its folder path that no other tab in the group shares.
      let depth = 1;
      while (depth < g.dirs.length && group.some((o) => o !== g && suffix(o.dirs, depth).toLowerCase() === suffix(g.dirs, depth).toLowerCase())) depth++;
      if (g.dirs.length) hints.set(g.id, suffix(g.dirs, depth));
    }
  }
  return hints;
}
