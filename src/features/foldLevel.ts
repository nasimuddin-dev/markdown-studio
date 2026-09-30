import { codeFolding, foldEffect, foldedRanges, foldState, unfoldEffect } from "@codemirror/language";
import { StateEffect, type StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { extractHeadings } from "./outline";

/**
 * Fold to Level n: every section whose heading is at level n or deeper is
 * folded, so only the headings down to level n (and the text above them)
 * stay open, like a table of contents. Earlier folds are opened first.
 * Sections come from the headings themselves (a heading's section runs to the
 * next heading at its level or above), so this doesn't wait for the parser.
 */
export function foldToLevel(level: number): StateCommand {
  return ({ state, dispatch }) => {
    const doc = state.doc;
    const effects: StateEffect<unknown>[] = [];
    foldedRanges(state).between(0, doc.length, (from, to) => {
      effects.push(unfoldEffect.of({ from, to }));
    });
    const headings = extractHeadings(doc.toString());
    let foldedUntil = -1;
    headings.forEach((h, i) => {
      if (h.level < level) return;
      const line = doc.line(h.line);
      if (line.from <= foldedUntil) return;
      const next = headings.slice(i + 1).find((o) => o.level <= h.level);
      let last = next ? next.line - 1 : doc.lines;
      // Blank lines before the next heading stay visible.
      while (last > h.line && !doc.line(last).text.trim()) last--;
      if (last <= h.line) return;
      const range = { from: line.to, to: doc.line(last).to };
      effects.push(foldEffect.of(range));
      foldedUntil = range.to;
    });
    if (!effects.length) return false;
    // Folding needs its state field, which the fold gutter adds (it's off without line numbers).
    if (!state.field(foldState, false)) effects.push(StateEffect.appendConfig.of(codeFolding()));
    dispatch(state.update({ effects: [...effects, EditorView.scrollIntoView(state.selection.main.head, { y: "center" })] }));
    return true;
  };
}
