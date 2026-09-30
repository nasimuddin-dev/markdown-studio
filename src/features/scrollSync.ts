import { EditorView } from "@codemirror/view";
import { useSettings } from "../stores/settingsStore";

type Source = "editor" | "preview";
/** Where a pane is scrolled: its fraction of the way down, and the source line at its top when known. */
export interface ScrollPosition {
  ratio: number;
  line: number | null;
}
type Listener = (position: ScrollPosition) => void;

const listeners: Record<Source, Set<Listener>> = { editor: new Set(), preview: new Set() };
let lockedBy: Source | null = null;
let unlockTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Scroll synchronisation between the editor and preview panes: by source line
 * when both sides know it (the preview marks its blocks with `data-line`),
 * otherwise proportional.
 * Scroll events caused by the sync itself are ignored to avoid feedback loops.
 */
export const scrollSync = {
  emit(source: Source, position: ScrollPosition) {
    if (!useSettings.getState().settings.syncScroll) return;
    if (lockedBy && lockedBy !== source) return;
    lockedBy = source;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => (lockedBy = null), 120);
    for (const l of listeners[source]) l(position);
  },
  /** Ignores the other pane's scrolling for a moment, while `source` moves it on purpose. */
  hold(source: Source) {
    lockedBy = source;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => (lockedBy = null), 250);
  },
  on(source: Source, listener: Listener) {
    listeners[source].add(listener);
    return () => listeners[source].delete(listener);
  },
};

/** The document's top within the editor's scrolling content, in pixels. */
function documentOffset(view: EditorView): number {
  const el = view.scrollDOM;
  return view.documentTop - el.getBoundingClientRect().top + el.scrollTop;
}

/** The (fractional) source line at the top of the editor. */
export function editorTopLine(view: EditorView): number {
  const y = Math.max(0, view.scrollDOM.scrollTop - documentOffset(view));
  const block = view.lineBlockAtHeight(y);
  const fraction = (y - block.top) / Math.max(1, block.height);
  return view.state.doc.lineAt(block.from).number + Math.min(1, Math.max(0, fraction));
}

/** The start of a (fractional) source line, and how many pixels of the line go above the top of the editor. */
function lineTarget(view: EditorView, line: number): { pos: number; offset: number } {
  const doc = view.state.doc;
  const n = Math.max(1, Math.min(doc.lines, Math.floor(line)));
  const pos = doc.line(n).from;
  return { pos, offset: Math.min(1, Math.max(0, line - n)) * view.lineBlockAt(pos).height };
}

/** Scrolls the editor so a (fractional) source line is at its top. */
export function scrollEditorToLine(view: EditorView, line: number) {
  // CodeMirror scrolls first: it draws and measures lines it had only estimated.
  const { pos, offset } = lineTarget(view, line);
  view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: -offset }) });
  // It aligns the text rather than the line's box (they differ on taller heading lines); correct that once measured.
  requestAnimationFrame(() => {
    if (pos > view.state.doc.length) return;
    const { offset } = lineTarget(view, line);
    const top = documentOffset(view) + view.lineBlockAt(pos).top + offset;
    if (Math.abs(view.scrollDOM.scrollTop - top) > 1) view.scrollDOM.scrollTop = top;
  });
}
