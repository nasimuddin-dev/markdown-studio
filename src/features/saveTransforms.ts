import type { LineEnding, Settings } from "../types";
import { updateToc } from "./toc";
import { formatAllTables } from "./tables";

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Removes trailing whitespace while keeping Markdown hard line breaks (two
 * or more trailing spaces after text become exactly two) and leaving fenced
 * code blocks untouched.
 */
export function trimTrailingWhitespace(text: string): string {
  let fence: string | null = null;
  return text
    .split("\n")
    .map((line) => {
      const f = FENCE.exec(line);
      if (f) {
        if (!fence) fence = f[1];
        else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
        return line.replace(/[ \t]+$/, "");
      }
      if (fence) return line;
      const m = /^(.*?\S)?([ \t]+)$/.exec(line);
      if (!m) return line;
      const [, content = "", ws] = m;
      if (!content) return "";
      const hardBreak = /^ {2,}$/.test(ws);
      return hardBreak ? content + "  " : content;
    })
    .join("\n");
}

export function ensureFinalNewline(text: string): string {
  return text === "" || text.endsWith("\n") ? text : text + "\n";
}

/** Applies the user's on-save cleanups (Settings → Files). */
export function applySaveTransforms(
  text: string,
  s: Pick<Settings, "trimTrailingWhitespace" | "insertFinalNewline"> & Partial<Pick<Settings, "updateTocOnSave" | "formatTablesOnSave">>,
): string {
  let out = text;
  if (s.updateTocOnSave) out = updateToc(out);
  if (s.formatTablesOnSave) out = formatAllTables(out);
  if (s.trimTrailingWhitespace) out = trimTrailingWhitespace(out);
  if (s.insertFinalNewline) out = ensureFinalNewline(out);
  return out;
}

export function defaultLineEnding(pref: Settings["newFileLineEnding"]): LineEnding {
  if (pref === "lf" || pref === "crlf") return pref;
  const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.platform || navigator.userAgent);
  return isWindows ? "crlf" : "lf";
}

/**
 * Smallest single replacement turning `a` into `b` (common prefix/suffix), so
 * editors can apply external changes without resetting the cursor or undo.
 */
export function minimalChange(a: string, b: string): { from: number; to: number; insert: string } | null {
  if (a === b) return null;
  let start = 0;
  const max = Math.min(a.length, b.length);
  while (start < max && a.charCodeAt(start) === b.charCodeAt(start)) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a.charCodeAt(endA - 1) === b.charCodeAt(endB - 1)) {
    endA--;
    endB--;
  }
  return { from: start, to: endA, insert: b.slice(start, endB) };
}
