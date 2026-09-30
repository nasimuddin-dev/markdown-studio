import type { Root } from "hast";

/**
 * Rehype plugin: marks each top-level block with the source line it starts on
 * (`data-line`), so the preview and the editor can scroll to the same place
 * and a double-click in the preview can find its source. Runs after
 * sanitizing, so the attribute isn't stripped.
 */
export function rehypeSourceLines() {
  return (tree: Root) => {
    for (const child of tree.children) {
      const line = child.type === "element" ? child.position?.start.line : undefined;
      if (child.type === "element" && line) child.properties = { ...child.properties, dataLine: String(line) };
    }
  };
}

/** A block of the preview: the source line it starts on and its top in pixels. */
export interface LineAnchor {
  line: number;
  top: number;
}

/**
 * Where a (fractional) source line is, interpolating between the anchors
 * around it. `anchor(i)` returns the anchors in document order (lines and tops
 * both increasing); the last one should be the end of the document.
 */
export function topForLine(count: number, anchor: (i: number) => LineAnchor, line: number): number | null {
  const i = lastAtOrBefore(count, (k) => anchor(k).line, line);
  return interpolate(count, anchor, i, line, "line", "top");
}

/** The (fractional) source line at a pixel offset: the inverse of `topForLine`. */
export function lineForTop(count: number, anchor: (i: number) => LineAnchor, top: number): number | null {
  const i = lastAtOrBefore(count, (k) => anchor(k).top, top);
  return interpolate(count, anchor, i, top, "top", "line");
}

/** Binary search: the last index whose key is at most `value`, or -1. */
function lastAtOrBefore(count: number, key: (i: number) => number, value: number): number {
  let lo = 0;
  let hi = count - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(mid) <= value) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

function interpolate(count: number, anchor: (i: number) => LineAnchor, i: number, value: number, from: keyof LineAnchor, to: keyof LineAnchor): number | null {
  if (!count) return null;
  // Before the first block: between the start of the document and it.
  const a = i < 0 ? { line: 1, top: 0 } : anchor(i);
  if (i >= count - 1) return a[to];
  const b = anchor(i + 1);
  const span = b[from] - a[from];
  return span > 0 ? a[to] + ((value - a[from]) / span) * (b[to] - a[to]) : a[to];
}
