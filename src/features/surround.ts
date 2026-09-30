import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Characters that wrap a selection instead of replacing it, with their closing counterpart. */
const PAIRS: Record<string, string> = {
  "*": "*",
  _: "_",
  "`": "`",
  "~": "~",
  '"': '"',
  "(": ")",
  "[": "]",
};

/**
 * Typing one of the characters above while text is selected wraps each
 * selection in it and keeps the text selected, so typing `*` twice makes
 * `word` into `**word**` (as code editors do with brackets and quotes).
 */
export const surroundSelection = EditorView.inputHandler.of((view, _from, _to, text) => {
  const close = PAIRS[text];
  const { state } = view;
  if (!close || view.composing || state.readOnly || state.selection.ranges.some((r) => r.empty)) return false;
  const tr = state.changeByRange((range) => ({
    changes: [
      { from: range.from, insert: text },
      { from: range.to, insert: close },
    ],
    range: EditorSelection.range(range.anchor + text.length, range.head + text.length),
  }));
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.type" }));
  return true;
});
