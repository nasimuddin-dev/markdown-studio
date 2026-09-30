import type { StateCommand } from "@codemirror/state";
import { findLinkDefinitions, findLinks, fixChanges, maskCode } from "./lint";

/**
 * Converting links between inline style (`[text](address "title")`) and
 * reference style (`[text][1]` with a `[1]: address "title"` line at the end).
 * Both work on the selection, or the whole document when nothing is selected,
 * and return the edits (positions in the original text).
 */

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

const normalize = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

interface Definition {
  label: string;
  /** The address as written (with `<>` when it has them). */
  destination: string;
  /** The title as written, with its quotes, or "". */
  title: string;
  /** The definition's whole line, with its line break. */
  from: number;
  to: number;
}

function definitions(text: string): Definition[] {
  return findLinkDefinitions(text)
    .filter((d) => !d.text.startsWith("^"))
    .map((d) => {
      const bracketed = text[d.targetFrom - 1] === "<";
      const destination = bracketed ? `<${d.target}>` : d.target;
      const lineEnd = text.indexOf("\n", d.from);
      const end = lineEnd < 0 ? text.length : lineEnd;
      return { label: d.text, destination, title: text.slice(d.to, end).trim(), from: d.from, to: lineEnd < 0 ? end : end + 1 };
    });
}

/** Turns inline links and images into reference-style ones, reusing definitions that have the same address and title. */
export function toReferenceLinks(text: string, from = 0, to = text.length): TextChange[] {
  const defs = definitions(text);
  const labels = new Set(defs.map((d) => normalize(d.label)));
  const byTarget = new Map<string, string>();
  for (const d of defs) if (!byTarget.has(`${d.destination}\0${d.title}`)) byTarget.set(`${d.destination}\0${d.title}`, d.label);
  let next = 1;
  const added: string[] = [];
  const changes: TextChange[] = [];
  for (const link of findLinks(text)) {
    if (link.from < from || link.to > to || !link.target) continue;
    const bracketed = text[link.targetFrom - 1] === "<";
    const destination = bracketed ? `<${link.target}>` : link.target;
    const destinationEnd = link.targetFrom + link.target.length + (bracketed ? 1 : 0);
    const title = text.slice(destinationEnd, link.to - 1).trim();
    const key = `${destination}\0${title}`;
    let label = byTarget.get(key);
    if (!label) {
      while (labels.has(String(next))) next++;
      label = String(next);
      labels.add(label);
      byTarget.set(key, label);
      added.push(`[${label}]: ${destination}${title ? " " + title : ""}`);
    }
    // Everything up to and including the text's closing bracket stays as written.
    const textEnd = link.from + (link.image ? 2 : 1) + link.text.length + 1;
    changes.push({ from: textEnd, to: link.to, insert: `[${label}]` });
  }
  if (added.length) changes.push(...fixChanges({ label: "", edits: [{ at: "end", insert: added.join("\n") + "\n" }] }, 0, text));
  return changes;
}

/**
 * Turns reference-style links (`[text][id]`, `[id][]`, and `[id]` when `id`
 * is defined) into inline ones, and removes definitions nothing uses anymore.
 */
export function toInlineLinks(text: string, from = 0, to = text.length): TextChange[] {
  const defs = definitions(text);
  const byLabel = new Map<string, Definition>();
  for (const d of defs) if (!byLabel.has(normalize(d.label))) byLabel.set(normalize(d.label), d);
  const masked = maskCode(text);
  const changes: TextChange[] = [];
  const converted = new Set<string>();
  const stillUsed = new Set<string>();
  const covered: Array<[number, number]> = [];
  const visit = (start: number, end: number, bang: string, linkText: string, label: string) => {
    const id = normalize(label);
    const def = byLabel.get(id);
    if (!def) return;
    covered.push([start, end]);
    if (start < from || end > to) {
      stillUsed.add(id);
      return;
    }
    converted.add(id);
    changes.push({ from: start, to: end, insert: `${bang}[${linkText}](${def.destination}${def.title ? " " + def.title : ""})` });
  };
  for (const m of masked.matchAll(/(!?)\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\[([^\]\n]*)\]/g)) {
    if (masked[m.index - 1] === "\\") continue;
    const start = m.index;
    const inner = text.slice(start + m[1].length + 1, start + m[1].length + 1 + m[2].length);
    visit(start, start + m[0].length, m[1], inner, m[3].trim() ? m[3] : inner);
  }
  for (const m of masked.matchAll(/(!?)\[([^[\]\n]+)\](?![([:])/g)) {
    const start = m.index;
    const end = start + m[0].length;
    if (masked[start - 1] === "\\" || masked[start - 1] === "]" || covered.some(([a, b]) => start < b && end > a)) continue;
    visit(start, end, m[1], text.slice(start + m[1].length + 1, end - 1), m[2]);
  }
  const removed = defs.filter((d) => converted.has(normalize(d.label)) && !stillUsed.has(normalize(d.label))).sort((a, b) => b.from - a.from);
  // When the removed definitions end the document, the blank lines before them go too.
  let tail = text.length;
  for (const d of removed) {
    if (text.slice(d.to, tail).trim()) break;
    tail = d.from;
  }
  if (tail < text.length) {
    const contentEnd = text.slice(0, tail).trimEnd().length;
    changes.push({ from: contentEnd, to: text.length, insert: contentEnd ? "\n" : "" });
  }
  for (const d of removed) if (d.from < tail) changes.push({ from: d.from, to: d.to, insert: "" });
  return changes;
}

/** Applies changes made against `text` (for tests and previews). */
export function applyChanges(text: string, changes: TextChange[]): string {
  return [...changes].sort((a, b) => b.from - a.from || b.to - a.to).reduce((t, c) => t.slice(0, c.from) + c.insert + t.slice(c.to), text);
}

function linkCommand(convert: typeof toReferenceLinks): StateCommand {
  return ({ state, dispatch }) => {
    const sel = state.selection.main;
    const text = state.doc.toString();
    const changes = sel.empty ? convert(text) : convert(text, sel.from, sel.to);
    if (!changes.length) return false;
    dispatch(state.update({ changes: [...changes].sort((a, b) => a.from - b.from), userEvent: "input.transform", scrollIntoView: true }));
    return true;
  };
}

export const convertToReferenceLinks = linkCommand(toReferenceLinks);
export const convertToInlineLinks = linkCommand(toInlineLinks);
