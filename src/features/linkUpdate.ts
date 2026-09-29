import { backend } from "../services";
import { describeError } from "../services/errors";
import { basename, dirname, isInside, isMarkdownPath, relativePath, resolveRelative } from "../services/paths";
import { isDirty, useDocuments } from "../stores/documentsStore";
import { ask, notify } from "../stores/uiStore";
import type { FileContent } from "../types";
import { reloadDocument } from "./documents";
import { findLinks, localTargets } from "./lint";

/**
 * Keeps relative links working when a file or folder is renamed or moved in
 * the explorer: links in other documents that pointed to it, and the moved
 * documents' own links to other files, are rewritten.
 */

const samePath = (a: string, b: string) => isInside(a, b) && isInside(b, a);

/** Where a path is after moving `from` to `to` (unchanged if it wasn't inside `from`). */
function mover(from: string, to: string) {
  return (path: string) => (isInside(path, from) ? to + path.slice(from.length) : path);
}

/** Characters that can't appear unescaped in an inline link destination. */
const escapeTarget = (path: string) => path.replace(/[%\s()<>]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));

/**
 * Rewrites the relative links and images of a document that was at `oldDocPath`
 * and is now at `newDocPath`, given where every path moved (`moved`). Only
 * links that would otherwise point somewhere else change; `#anchors`, `?query`
 * parts, a leading `./` and `<…>` brackets are kept.
 */
export function rewriteLinks(text: string, oldDocPath: string, newDocPath: string, moved: (path: string) => string): { text: string; count: number } {
  const edits: Array<{ from: number; to: number; insert: string }> = [];
  for (const { link, path } of localTargets(findLinks(text), oldDocPath)) {
    if (!path || /^([a-zA-Z]:)?[\\/]/.test(link.target)) continue; // absolute paths are left alone
    const target = moved(path);
    const now = resolveRelative(newDocPath, link.target);
    if (now && samePath(now, target)) continue;
    const rel = relativePath(dirname(newDocPath), target);
    if (rel === null) continue;
    const cut = link.target.search(/[?#]/);
    const suffix = cut < 0 ? "" : link.target.slice(cut);
    const prefix = link.target.startsWith("./") && !rel.startsWith("..") ? "./" : "";
    // The destination starts after "](", optional spaces and an optional "<".
    let start = link.from + (link.image ? 1 : 0) + 1 + link.text.length + 2;
    while (/\s/.test(text[start])) start++;
    const bracketed = text[start] === "<";
    if (bracketed) start++;
    const insert = prefix + (bracketed ? rel : escapeTarget(rel)) + suffix;
    edits.push({ from: start, to: start + link.target.length, insert });
  }
  let out = text;
  for (const e of edits.reverse()) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return { text: out, count: edits.length };
}

/**
 * After `from` was renamed or moved to `to` inside the workspace, finds the
 * links that now point to the wrong place, asks, and rewrites them. Files open
 * with unsaved changes are skipped; each rewritten file keeps its previous
 * version in File History.
 */
export async function updateLinksAfterMove(root: string, from: string, to: string): Promise<number> {
  const b = backend();
  const moved = mover(from, to);
  const movedBack = mover(to, from);
  const unsaved = new Set(useDocuments.getState().docs.filter((d) => d.path && isDirty(d)).map((d) => d.path!));
  let paths: string[];
  try {
    paths = (await b.listWorkspaceFiles(root)).filter(isMarkdownPath);
  } catch {
    return 0;
  }
  const planned: Array<{ file: FileContent; text: string }> = [];
  const skipped: string[] = [];
  let links = 0;
  for (const path of paths) {
    let file: FileContent;
    try {
      file = await b.readTextFile(path);
    } catch {
      continue;
    }
    const { text, count } = rewriteLinks(file.content, movedBack(path), path, moved);
    if (!count) continue;
    if (unsaved.has(path)) {
      skipped.push(basename(path));
      continue;
    }
    planned.push({ file, text });
    links += count;
  }
  if (!planned.length) {
    if (skipped.length) notify("info", `Links in files with unsaved changes weren't updated: ${skipped.join(", ")}.`);
    return 0;
  }
  const choice = await ask({
    title: "Update links?",
    message: `${links} ${links === 1 ? "link" : "links"} in ${planned.length} ${planned.length === 1 ? "file" : "files"} would no longer point to the right place after moving “${basename(to)}”. Update ${links === 1 ? "it" : "them"}?`,
    detail:
      (skipped.length ? `Skipped, because they have unsaved changes: ${skipped.join(", ")}. ` : "") + "The previous version of each file is kept in File History.",
    buttons: [
      { id: "keep", label: "Don't Update" },
      { id: "update", label: "Update Links", variant: "primary" },
    ],
    cancelId: "keep",
  });
  if (choice !== "update") return 0;
  let files = 0;
  const failed: string[] = [];
  for (const { file, text } of planned) {
    try {
      await b.writeTextFile({ path: file.path, content: text, lineEnding: file.lineEnding, bom: file.bom, expectedMtime: file.mtime, force: false });
      files++;
      const open = useDocuments.getState().docs.find((d) => d.path === file.path);
      if (open && !isDirty(open)) await reloadDocument(open.id);
    } catch (e) {
      failed.push(basename(file.path));
      b.log("warn", "links.update", describeError(e, "update links"));
    }
  }
  if (failed.length) notify("warning", `Updated links in ${files} ${files === 1 ? "file" : "files"}. Couldn't write ${failed.join(", ")}.`);
  else notify("success", `Updated links in ${files} ${files === 1 ? "file" : "files"}.`);
  return files;
}
