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
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push({ kind: "add", text: b2[j], newNo: start + j + 1 });
      j++;
    } else {
      out.push({ kind: "del", text: a2[i], oldNo: start + i + 1 });
      i++;
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
