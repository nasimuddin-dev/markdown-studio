import { codeFolding, ensureSyntaxTree, foldable, foldEffect, foldedRanges, foldState, unfoldEffect } from "@codemirror/language";
import { StateEffect, type StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { extractHeadings } from "./outline";

/**
 * Fold to Level n: every section whose heading is at level n or deeper is
 * folded, so only the headings down to level n (and the text above them)
 * stay open, like a table of contents. Earlier folds are opened first.
 */
export function foldToLevel(level: number): StateCommand {
  return ({ state, dispatch }) => {
    ensureSyntaxTree(state, state.doc.length, 500);
    const effects: StateEffect<unknown>[] = [];
    foldedRanges(state).between(0, state.doc.length, (from, to) => {
      effects.push(unfoldEffect.of({ from, to }));
    });
    let foldedUntil = -1;
    for (const h of extractHeadings(state.doc.toString())) {
      if (h.level < level) continue;
      const line = state.doc.line(h.line);
      if (line.from <= foldedUntil) continue;
      const range = foldable(state, line.from, line.to);
      if (!range) continue;
      effects.push(foldEffect.of(range));
      foldedUntil = range.to;
    }
    if (!effects.length) return false;
    // Folding needs its state field, which the fold gutter adds (it's off without line numbers).
    if (!state.field(foldState, false)) effects.push(StateEffect.appendConfig.of(codeFolding()));
    dispatch(state.update({ effects: [...effects, EditorView.scrollIntoView(state.selection.main.head, { y: "center" })] }));
    return true;
  };
}
