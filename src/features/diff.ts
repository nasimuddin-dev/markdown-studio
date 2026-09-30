export type DiffLine = { kind: "same" | "add" | "del"; text: string; oldNo?: number; newNo?: number };
export type DiffRow = DiffLine | { kind: "gap"; hidden: number };

const MAX_CELLS = 4_000_000;

/**
 * Line diff (LCS). `a` is the old text, `b` the new one. Returns `null` when
 * the inputs are too large to diff interactively.
 */
export function diffLines(a: string, b: string, maxCells = MAX_CELLS): DiffLine[] | null {
  const A = a.split("\n");
  const B = b.split("\n");
  // Trim common prefix/suffix first; most edits are local.
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start++;
  let endA = A.length;
  let endB = B.length;
  while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) {
    endA--;
    endB--;
  }
  const a2 = A.slice(start, endA);
  const b2 = B.slice(start, endB);
  if (a2.length * b2.length > maxCells) return null;

  // LCS table over the differing middle.
  const n = a2.length;
  const m = b2.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a2[i] === b2[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  for (let k = 0; k < start; k++) out.push({ kind: "same", text: A[k], oldNo: k + 1, newNo: k + 1 });
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a2[i] === b2[j]) {
      out.push({ kind: "same", text: a2[i], oldNo: start + i + 1, newNo: start + j + 1 });
      i++;
      j++;
      // On a tie the removed line comes first, as in `git diff`.
    } else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      out.push({ kind: "del", text: a2[i], oldNo: start + i + 1 });
      i++;
    } else {
      out.push({ kind: "add", text: b2[j], newNo: start + j + 1 });
      j++;
    }
  }
  for (let k = 0; k < A.length - endA; k++) {
    out.push({ kind: "same", text: A[endA + k], oldNo: endA + k + 1, newNo: endB + k + 1 });
  }
  return out;
}

/** Collapses unchanged runs, keeping `context` lines around each change. */
export function withContext(lines: DiffLine[], context = 3): DiffRow[] {
  const changed = lines.map((l) => l.kind !== "same");
  const keep = lines.map((_, i) => {
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) if (changed[k]) return true;
    return false;
  });
  const rows: DiffRow[] = [];
  let hidden = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (hidden) rows.push({ kind: "gap", hidden });
      hidden = 0;
      rows.push(l);
    } else hidden++;
  });
  if (hidden) rows.push({ kind: "gap", hidden });
  return rows;
}

export function diffStats(lines: DiffLine[]) {
  return {
    added: lines.filter((l) => l.kind === "add").length,
    removed: lines.filter((l) => l.kind === "del").length,
  };
}

/** A piece of a changed line; `changed` pieces differ from the paired line. */
export interface Segment {
  text: string;
  changed: boolean;
}

const TOKEN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

/**
 * Word-level differences between an old and a new version of a line: runs of
 * words, spaces or punctuation that aren't in both. `null` when the lines
 * share too little for a word diff to help (under a third of their words), or
 * are too long.
 */
export function wordDiff(a: string, b: string, maxCells = 250_000): { old: Segment[]; new: Segment[] } | null {
  const A = a.match(TOKEN) ?? [];
  const B = b.match(TOKEN) ?? [];
  if (!A.length || !B.length || A.length * B.length > maxCells) return null;
  const dp = Array.from({ length: A.length + 1 }, () => new Uint32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const words = (tokens: string[]) => tokens.filter((t) => t.trim()).length;
  const common: string[] = [];
  const oldSeg: Segment[] = [];
  const newSeg: Segment[] = [];
  const push = (list: Segment[], text: string, changed: boolean) => {
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.text += text;
    else list.push({ text, changed });
  };
  let i = 0;
  let j = 0;
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) {
      common.push(A[i]);
      push(oldSeg, A[i++], false);
      push(newSeg, B[j++], false);
    } else if (j < B.length && (i >= A.length || dp[i][j + 1] >= dp[i + 1][j])) push(newSeg, B[j++], true);
    else push(oldSeg, A[i++], true);
  }
  if (words(common) * 3 < Math.max(words(A), words(B))) return null;
  return { old: oldSeg, new: newSeg };
}

/**
 * Word diffs for changed lines: in each run of changed lines, the k-th
 * removed line is paired with the k-th added one.
 */
export function pairedWordDiffs(lines: DiffLine[]): Map<DiffLine, Segment[]> {
  const out = new Map<DiffLine, Segment[]>();
  for (let i = 0; i < lines.length; ) {
    if (lines[i].kind === "same") {
      i++;
      continue;
    }
    let end = i;
    while (end < lines.length && lines[end].kind !== "same") end++;
    const run = lines.slice(i, end);
    const removed = run.filter((l) => l.kind === "del");
    const added = run.filter((l) => l.kind === "add");
    for (let k = 0; k < Math.min(removed.length, added.length); k++) {
      const diff = wordDiff(removed[k].text, added[k].text);
      if (!diff) continue;
      out.set(removed[k], diff.old);
      out.set(added[k], diff.new);
    }
    i = end;
  }
  return out;
}
