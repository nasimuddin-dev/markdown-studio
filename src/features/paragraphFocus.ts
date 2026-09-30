import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

/**
 * The lines (1-based, inclusive) of the paragraph the cursor is in: the run of
 * non-blank lines around it. On a blank line, just that line.
 */
export function paragraphAt(state: EditorState, pos: number): { first: number; last: number } {
  const doc = state.doc;
  const line = doc.lineAt(pos).number;
  const blank = (n: number) => !doc.line(n).text.trim();
  if (blank(line)) return { first: line, last: line };
  let first = line;
  let last = line;
  while (first > 1 && !blank(first - 1)) first--;
  while (last < doc.lines && !blank(last + 1)) last++;
  return { first, last };
}

const dimmed = Decoration.line({ class: "cm-dimmed" });

function build(view: EditorView): DecorationSet {
  const { first, last } = paragraphAt(view.state, view.state.selection.main.head);
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (line.number < first || line.number > last) builder.add(line.from, line.from, dimmed);
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

/** Dims every paragraph except the one being written (View → Dim Other Paragraphs). */
export function paragraphFocus(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = build(view);
        }
        update(u: ViewUpdate) {
          if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = build(u.view);
        }
      },
      { decorations: (p) => p.decorations },
    ),
    EditorView.theme({ ".cm-line.cm-dimmed": { opacity: "0.35", transition: "opacity 0.15s" } }),
  ];
}
