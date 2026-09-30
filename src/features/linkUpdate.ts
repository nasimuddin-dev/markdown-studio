import { backend } from "../services";
import { describeError } from "../services/errors";
import { basename, dirname, isInside, isMarkdownPath, relativePath, resolveRelative } from "../services/paths";
import { isDirty, useDocuments } from "../stores/documentsStore";
import { ask, notify } from "../stores/uiStore";
import type { FileContent } from "../types";
import { reloadDocument } from "./documents";
import { findAllLinks, localTargets } from "./lint";

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
 * Rewrites the relative links, images and reference definitions of a document that was at `oldDocPath`
 * and is now at `newDocPath`, given where every path moved (`moved`). Only
 * links that would otherwise point somewhere else change; `#anchors`, `?query`
 * parts, a leading `./` and `<…>` brackets are kept.
 */
export function rewriteLinks(text: string, oldDocPath: string, newDocPath: string, moved: (path: string) => string): { text: string; count: number } {
  const edits: Array<{ from: number; to: number; insert: string }> = [];
  for (const { link, path } of localTargets(findAllLinks(text), oldDocPath)) {
    if (link.wiki) continue;
    if (!path || /^([a-zA-Z]:)?[\\/]/.test(link.target)) continue; // absolute paths are left alone
    const target = moved(path);
    const now = resolveRelative(newDocPath, link.target);
    if (now && samePath(now, target)) continue;
    const rel = relativePath(dirname(newDocPath), target);
    if (rel === null) continue;
    const cut = link.target.search(/[?#]/);
    const suffix = cut < 0 ? "" : link.target.slice(cut);
    const prefix = link.target.startsWith("./") && !rel.startsWith("..") ? "./" : "";
    const start = link.targetFrom;
    const bracketed = text[start - 1] === "<";
    let insert = prefix + (bracketed ? rel : escapeTarget(rel)) + suffix;
    // An HTML attribute written with entities keeps them.
    if (link.sourceLength !== undefined) insert = insert.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    edits.push({ from: start, to: start + (link.sourceLength ?? link.target.length), insert });
  }
  let out = text;
  for (const e of edits.reverse()) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return { text: out, count: edits.length };
}

/**
 * After `from` was renamed or moved to `to` inside the workspace, finds the
 * links that now point to the wrong place, asks, and rewrites them.
 */
export async function updateLinksAfterMove(root: string, from: string, to: string): Promise<number> {
  const moved = mover(from, to);
  const movedBack = mover(to, from);
  return rewriteWorkspaceLinks(
    root,
    (text, path) => rewriteLinks(text, movedBack(path), path, moved),
    (links, files) =>
      `${links} ${links === 1 ? "link" : "links"} in ${files} ${files === 1 ? "file" : "files"} would no longer point to the right place after moving “${basename(to)}”. Update ${links === 1 ? "it" : "them"}?`,
  );
}

/**
 * Rewrites links in the workspace's Markdown files with `rewrite`, after
 * asking (`question` gets the number of links and files). Files open with
 * unsaved changes are skipped; each rewritten file keeps its previous version
 * in File History, and open tabs are reloaded. Returns the files changed.
 */
export async function rewriteWorkspaceLinks(
  root: string,
  rewrite: (text: string, path: string) => { text: string; count: number },
  question: (links: number, files: number) => string,
  skip?: string,
): Promise<number> {
  const b = backend();
  const unsaved = new Set(useDocuments.getState().docs.filter((d) => d.path && isDirty(d)).map((d) => d.path!));
  let paths: string[];
  try {
    paths = (await b.listWorkspaceFiles(root)).filter((p) => isMarkdownPath(p) && !(skip && samePath(p, skip)));
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
    const { text, count } = rewrite(file.content, path);
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
    message: question(links, planned.length),
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
