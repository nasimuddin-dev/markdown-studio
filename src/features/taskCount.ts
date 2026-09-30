import { maskCode } from "./lint";

const TASK = /^(?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\[([ xX])\](?=[ \t]|$)/;

/**
 * Task list items of a document, by a light line scan (the status bar can't
 * load the Markdown parser): how many there are, how many are done, and the
 * 1-based lines of the open ones. Lines in code don't count.
 */
export function taskCounts(text: string): { total: number; done: number; open: number[] } {
  if (!text.includes("[")) return { total: 0, done: 0, open: [] };
  const lines = maskCode(text).split("\n");
  let total = 0;
  let done = 0;
  const open: number[] = [];
  lines.forEach((line, i) => {
    const m = TASK.exec(line);
    if (!m) return;
    total++;
    if (m[1] === " ") open.push(i + 1);
    else done++;
  });
  return { total, done, open };
}

/** The first open task after `line`, starting again from the top; null when all are done. */
export function nextOpenTask(open: number[], line: number): number | null {
  return open.find((l) => l > line) ?? open[0] ?? null;
}
