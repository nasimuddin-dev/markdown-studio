import { backend } from "../services";
import { buildSearchRegex } from "../services/search";
import { pathFilter, relativeTo } from "../services/pathFilter";
import { describeError } from "../services/errors";
import { basename, isMarkdownPath } from "../services/paths";
import { isDirty, useDocuments } from "../stores/documentsStore";
import { ask, notify } from "../stores/uiStore";
import type { FileContent, SearchOptions } from "../types";
import { reloadDocument } from "./documents";

/**
 * Replaces every match in one text, line by line like Find in Files (so `^`
 * and `$` mean line starts and ends). In regex mode the replacement can use
 * `$1`, `$&` and so on; otherwise it's inserted literally.
 */
export function replaceInText(text: string, opts: SearchOptions, replacement: string): { text: string; count: number } {
  const re = buildSearchRegex(opts);
  let count = 0;
  const lines = text.split("\n").map((line) => {
    const cr = line.endsWith("\r") ? "\r" : "";
    const body = cr ? line.slice(0, -1) : line;
    re.lastIndex = 0;
    const replaced = body.replace(re, (...args: unknown[]) => {
      const match = args[0] as string;
      if (!match) return match;
      count++;
      if (!opts.regex) return replacement;
      // Expand $1, $&, $<name> and $$ from this match's groups, as String.replace would.
      const hasNamed = typeof args[args.length - 1] === "object" && args[args.length - 1] !== null;
      const groups = args.slice(1, args.length - (hasNamed ? 3 : 2)) as Array<string | undefined>;
      const named = (hasNamed ? args[args.length - 1] : {}) as Record<string, string | undefined>;
      return replacement.replace(/\$(\$|&|\d{1,2}|<([^>]+)>)/g, (token, what: string, name?: string) => {
        if (what === "$") return "$";
        if (what === "&") return match;
        if (name !== undefined) return named[name] ?? "";
        const n = Number(what);
        return n >= 1 && n <= groups.length ? groups[n - 1] ?? "" : token;
      });
    });
    return replaced + cr;
  });
  return { text: lines.join("\n"), count };
}

export interface ReplaceSummary {
  replaced: number;
  files: number;
  skippedUnsaved: string[];
  failed: string[];
}

/**
 * Replace All for Find in Files: counts the matches in every Markdown file of
 * the folder, asks for confirmation, then rewrites the files. Files open with
 * unsaved changes are skipped; a file changed on disk since it was read is
 * refused; every overwritten file keeps its previous version in File History.
 */
export async function replaceInWorkspace(root: string, opts: SearchOptions, replacement: string): Promise<ReplaceSummary | null> {
  const b = backend();
  const docs = useDocuments.getState().docs;
  const unsaved = new Set(docs.filter((d) => d.path && isDirty(d)).map((d) => d.path!));
  const allowed = pathFilter(opts.include, opts.exclude);
  const paths = (await b.listWorkspaceFiles(root)).filter((p) => isMarkdownPath(p) && allowed(relativeTo(root, p)));

  const planned: Array<{ file: FileContent; text: string; count: number }> = [];
  const skippedUnsaved: string[] = [];
  const failed: string[] = [];
  for (const path of paths) {
    let file: FileContent;
    try {
      file = await b.readTextFile(path);
    } catch {
      continue; // unreadable files aren't searched either
    }
    const { text, count } = replaceInText(file.content, opts, replacement);
    if (!count) continue;
    if (unsaved.has(path)) skippedUnsaved.push(basename(path));
    else planned.push({ file, text, count });
  }

  const total = planned.reduce((n, p) => n + p.count, 0);
  if (!total) {
    notify("info", skippedUnsaved.length ? `Nothing replaced: the matches are in files with unsaved changes (${skippedUnsaved.join(", ")}).` : "No matches to replace.");
    return null;
  }
  const choice = await ask({
    title: "Replace in files",
    message: `Replace ${total} ${total === 1 ? "match" : "matches"} in ${planned.length} ${planned.length === 1 ? "file" : "files"} with “${replacement}”?`,
    detail:
      (skippedUnsaved.length ? `Skipped, because they have unsaved changes: ${skippedUnsaved.join(", ")}. ` : "") +
      "The previous version of each file is kept in File History.",
    buttons: [
      { id: "cancel", label: "Cancel" },
      { id: "replace", label: "Replace All", variant: "primary" },
    ],
    cancelId: "cancel",
  });
  if (choice !== "replace") return null;

  let replaced = 0;
  let files = 0;
  for (const { file, text, count } of planned) {
    try {
      await b.writeTextFile({ path: file.path, content: text, lineEnding: file.lineEnding, bom: file.bom, expectedMtime: file.mtime, force: false });
      replaced += count;
      files++;
      const open = useDocuments.getState().docs.find((d) => d.path === file.path);
      if (open && !isDirty(open)) await reloadDocument(open.id);
    } catch (e) {
      failed.push(basename(file.path));
      b.log("warn", "replace.write", describeError(e, "replace"));
    }
  }
  const summary = `Replaced ${replaced} ${replaced === 1 ? "match" : "matches"} in ${files} ${files === 1 ? "file" : "files"}.`;
  if (failed.length) notify("warning", `${summary} Couldn't write ${failed.join(", ")} (changed on disk or not writable).`);
  else notify("success", summary + (skippedUnsaved.length ? ` Skipped ${skippedUnsaved.length} with unsaved changes.` : ""));
  return { replaced, files, skippedUnsaved, failed };
}
