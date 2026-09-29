/**
 * Small path helpers that work with both POSIX ("/") and Windows ("\") paths.
 * Real validation happens in the native backend; these only format and join.
 */

/** Matches either path separator. */
const SEP = /[\\/]/;
const TRAILING_SEPS = /[\\/]+$/;
const BACKSLASHES = /\\/g;
const DRIVE_ROOT = /^[a-zA-Z]:[\\/]/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function separatorOf(path: string): "/" | "\\" {
  return path.includes("\\") && !path.includes("/") ? "\\" : "/";
}

export function basename(path: string): string {
  const parts = path.split(SEP).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (idx < 0) return "";
  if (idx === 0) return path[0];
  // Keep "C:\" rather than "C:".
  if (idx === 2 && path[1] === ":") return path.slice(0, 3);
  return path.slice(0, idx);
}

export function join(dir: string, name: string): string {
  const sep = separatorOf(dir);
  return dir.endsWith("/") || dir.endsWith("\\") ? dir + name : dir + sep + name;
}

function isAbsolute(path: string): boolean {
  return path.startsWith("/") || path.startsWith("\\\\") || DRIVE_ROOT.test(path);
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

export function isInside(path: string, dir: string): boolean {
  const norm = (p: string) => p.replace(TRAILING_SEPS, "").replace(BACKSLASHES, "/").toLowerCase();
  const p = norm(path);
  const d = norm(dir);
  return p === d || p.startsWith(d + "/");
}

/**
 * Resolves a link target found in a document (e.g. `../img/a.png`) against the
 * document's folder, collapsing `.` and `..` segments. Returns `null` when the
 * target escapes the filesystem root or isn't a local path.
 */
export function resolveRelative(docPath: string, target: string): string | null {
  if (!target || (URL_SCHEME.test(target) && !DRIVE_ROOT.test(target))) return null;
  let decoded: string;
  try {
    decoded = decodeURI(target.split("#")[0].split("?")[0]);
  } catch {
    return null;
  }
  if (!decoded) return null;
  if (isAbsolute(decoded)) return decoded;
  const sep = separatorOf(docPath);
  const baseDir = dirname(docPath);
  const drive = /^[a-zA-Z]:/.test(baseDir) ? baseDir.slice(0, 2) : "";
  const stack = baseDir.slice(drive.length).split(SEP).filter(Boolean);
  for (const seg of decoded.split(SEP)) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (stack.length === 0) return null;
      stack.pop();
    } else stack.push(seg);
  }
  const lead = docPath.startsWith("\\\\") ? "\\\\" : sep;
  return drive + lead + stack.join(sep);
}

/**
 * Relative path from folder `fromDir` to `to`, using "/" separators (as
 * Markdown links do). Returns `null` if they are on different drives.
 */
export function relativePath(fromDir: string, to: string): string | null {
  const split = (p: string) => p.split(SEP).filter(Boolean);
  const a = split(fromDir);
  const b = split(to);
  const win = /^[a-zA-Z]:/.test(fromDir) || fromDir.startsWith("\\\\");
  const eq = (x: string, y: string) => (win ? x.toLowerCase() === y.toLowerCase() : x === y);
  if (a.length && b.length && /:$/.test(a[0]) && !eq(a[0], b[0])) return null;
  let i = 0;
  while (i < a.length && i < b.length && eq(a[i], b[i])) i++;
  const up = a.slice(i).map(() => "..");
  return [...up, ...b.slice(i)].join("/");
}

/** Shortens a path for display, e.g. in the status bar or recent list. */
export function displayPath(path: string, max = 60): string {
  if (path.length <= max) return path;
  return "…" + path.slice(path.length - max + 1);
}
