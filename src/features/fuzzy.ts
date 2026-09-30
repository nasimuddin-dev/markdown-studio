/**
 * Small fuzzy matcher for the command palette: every query character must
 * appear in order. Scores favour matches at word starts and consecutive runs.
 * Returns `null` when the text does not match.
 */
export function fuzzyScore(query: string, text: string): { score: number; indices: number[] } | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const t = text.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    const atWordStart = found === 0 || /[\s\-_/.:>]/.test(t[found - 1]);
    score += 1;
    if (atWordStart) score += 3;
    if (found === prev + 1) score += 4;
    score -= Math.min(found - ti, 5) * 0.1;
    indices.push(found);
    prev = found;
    ti = found + 1;
  }
  // A whole word typed out ("tab" in "Close Tab") beats a prefix of a longer word ("Table").
  const word = q.replace(/\s+/g, "");
  const whole = new RegExp(`(^|[\\s\\-_/.:>])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s\\-_/.:>])`).exec(t);
  if (whole) {
    score += 6;
    const start = whole.index + whole[1].length;
    indices.splice(0, indices.length, ...Array.from({ length: word.length }, (_, i) => start + i));
  }
  // Prefer shorter labels when scores tie.
  score -= text.length * 0.01;
  return { score, indices };
}

export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string) {
  return items
    .map((item) => ({ item, match: fuzzyScore(query, getText(item)) }))
    .filter((r): r is { item: T; match: { score: number; indices: number[] } } => r.match !== null)
    .sort((a, b) => b.match.score - a.match.score);
}
