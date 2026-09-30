/**
 * Include and exclude globs for Find in Files and Replace in Files, mirroring
 * the native search (`PathFilter` in src-tauri/src/search.rs). Globs are
 * comma-separated; `**` crosses folders, `*` and `?` don't. A glob without `/`
 * matches a file or folder name anywhere (`drafts`, `*.draft.md`); one with `/`
 * is anchored at the folder (`docs/api`). A match on a folder covers
 * everything in it. Matching ignores case.
 */

function globRegex(glob: string): RegExp | null {
  let g = glob.trim().replace(/\\/g, "/");
  if (g.startsWith("./")) g = g.slice(2);
  g = g.replace(/\/+$/, "");
  if (!g) return null;
  const anchored = g.includes("/");
  if (anchored) g = g.replace(/^\/+/, "");
  let body = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") {
      if (g[i + 2] === "/") {
        body += "(?:.*/)?";
        i++;
      } else body += ".*";
      i++;
    } else if (c === "*") body += "[^/]*";
    else if (c === "?") body += "[^/]";
    else body += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${anchored ? "^" : "(?:^|/)"}${body}(?:/|$)`, "i");
}

const parse = (list = "") => list.split(",").map(globRegex).filter((r): r is RegExp => r !== null);

/** A test for folder-relative paths (`/` separators): true when the file should be searched. */
export function pathFilter(include?: string, exclude?: string): (relPath: string) => boolean {
  const inc = parse(include);
  const exc = parse(exclude);
  return (rel) => (!inc.length || inc.some((r) => r.test(rel))) && !exc.some((r) => r.test(rel));
}

/** The path of `path` inside `root`, with `/` separators. */
export function relativeTo(root: string, path: string): string {
  const r = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const p = path.replace(/\\/g, "/");
  return p.toLowerCase().startsWith(r.toLowerCase() + "/") ? p.slice(r.length + 1) : p;
}
