import { maskCode } from "./lint";
import type { TextChange } from "./referenceLinks";

/** A footnote label (`[^note]`) or a link reference label (`[text][id]`, `[id][]`, `[id]:`). */
export interface LabelTarget {
  kind: "footnote" | "reference";
  label: string;
}

const normalize = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

/** The footnote or reference label at `pos`, if the cursor is on one. */
export function labelAt(text: string, pos: number): LabelTarget | null {
  const masked = maskCode(text);
  const lineStart = masked.lastIndexOf("\n", pos - 1) + 1;
  const end = masked.indexOf("\n", pos);
  const line = masked.slice(lineStart, end < 0 ? masked.length : end);
  const at = pos - lineStart;
  const within = (m: RegExpMatchArray) => at >= m.index! && at <= m.index! + m[0].length;
  for (const m of line.matchAll(/\[\^([^\]\s]+)\]/g)) if (within(m)) return { kind: "footnote", label: m[1] };
  const def = /^ {0,3}\[([^\]\n]+)\]:/.exec(line);
  if (def && at <= def[0].length) return { kind: "reference", label: def[1] };
  for (const m of line.matchAll(/!?\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\[([^\]\n]*)\]/g)) {
    if (within(m)) return { kind: "reference", label: (m[2].trim() ? m[2] : m[1]).trim() };
  }
  return null;
}

/**
 * The edits that rename a footnote or reference label everywhere in the
 * document: its uses and its definition. A collapsed or shortcut reference
 * (`[id][]`, `[id]`) keeps its text and gets the new label (`[id][new]`).
 */
export function planLabelRename(text: string, target: LabelTarget, value: string): TextChange[] {
  const masked = maskCode(text);
  const old = normalize(target.label);
  const next = value.trim();
  const changes: TextChange[] = [];
  if (target.kind === "footnote") {
    for (const m of masked.matchAll(/\[\^([^\]\s]+)\]/g)) {
      if (normalize(m[1]) === old) changes.push({ from: m.index! + 2, to: m.index! + 2 + m[1].length, insert: next });
    }
    return changes;
  }
  const covered: Array<[number, number]> = [];
  for (const m of masked.matchAll(/^( {0,3}\[)([^\]\n]+)\]:/gm)) {
    covered.push([m.index!, m.index! + m[0].length]);
    if (normalize(m[2]) === old) changes.push({ from: m.index! + m[1].length, to: m.index! + m[1].length + m[2].length, insert: next });
  }
  for (const m of masked.matchAll(/(!?)\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\[([^\]\n]*)\]/g)) {
    covered.push([m.index!, m.index! + m[0].length]);
    const labelFrom = m.index! + m[1].length + m[2].length + 3;
    if (m[3].trim() ? normalize(m[3]) === old : normalize(m[2]) === old) changes.push({ from: labelFrom, to: labelFrom + m[3].length, insert: next });
  }
  // Shortcut references: [id] alone.
  for (const m of masked.matchAll(/\[([^[\]\n]+)\](?![([:])/g)) {
    const from = m.index!;
    if (masked[from - 1] === "\\" || masked[from - 1] === "]" || covered.some(([a, b]) => from >= a && from < b)) continue;
    if (normalize(m[1]) === old) changes.push({ from: from + m[0].length, to: from + m[0].length, insert: `[${next}]` });
  }
  return changes;
}
