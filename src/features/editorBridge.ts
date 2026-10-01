import { EditorView } from "@codemirror/view";
import type { StateCommand } from "@codemirror/state";
import { undo, redo, selectAll } from "@codemirror/commands";
import { openSearchPanel, gotoLine } from "@codemirror/search";
import { foldAll, unfoldAll } from "@codemirror/language";

/** The mounted editor view, so menu commands can drive the editor. */
let view: EditorView | null = null;

export function registerEditorView(v: EditorView | null) {
  view = v;
}

export function getEditorView() {
  return view;
}

/**
 * The element to give focus back to when an overlay closes: what had focus when it
 * opened, unless that was nothing (`<body>`, as when a menu closed before a dialog
 * loaded on first use). Call when the overlay opens; call the result when it closes.
 */
export function rememberFocus(): () => void {
  const active = document.activeElement as HTMLElement | null;
  const previous = active && active !== document.body ? active : null;
  // A menu item that started the overlay has gone by then; the editor is the place to return to.
  return () => (previous?.isConnected ? previous.focus() : view?.focus());
}

/** Runs a CodeMirror command against the active editor and returns focus to it. */
export function runOnEditor(command: StateCommand) {
  if (!view) return;
  command({ state: view.state, dispatch: view.dispatch });
  view.focus();
}

/** Moves the cursor to the start of a line and scrolls it to the top of the editor. */
export function revealLine(line: number) {
  if (!view) return;
  const doc = view.state.doc;
  const pos = doc.line(Math.max(1, Math.min(line, doc.lines))).from;
  view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 12 }) });
  view.focus();
}

/** Moves the cursor to the start of a line, scrolled `top` pixels below the top of the editor. */
export function revealLineAt(line: number, top: number) {
  if (!view) return;
  const doc = view.state.doc;
  const pos = doc.line(Math.max(1, Math.min(line, doc.lines))).from;
  view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: Math.max(0, top) }) });
  view.focus();
}

/** A selection to apply once a given document is shown in the editor. */
let pendingReveal: { docId: string; line: number; column: number; length: number } | null = null;
let currentDocId: string | null = null;

/** Called by the editor whenever it switches documents. */
export function editorShowing(docId: string | null) {
  currentDocId = docId;
  if (pendingReveal && pendingReveal.docId === docId) {
    const r = pendingReveal;
    pendingReveal = null;
    // Wait for the new state to be laid out before scrolling.
    requestAnimationFrame(() => selectRange(r.line, r.column, r.length));
  }
}

/** Selects `length` characters at line/column (UTF-16) and scrolls them into view. */
function selectRange(line: number, column: number, length: number) {
  if (!view) return;
  const doc = view.state.doc;
  const l = doc.line(Math.max(1, Math.min(line, doc.lines)));
  const from = Math.min(l.from + column, l.to);
  const to = Math.min(from + length, l.to);
  view.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: "center" }) });
  view.focus();
}

/** Reveals a match in a document, now if it is showing or as soon as it is. */
export function requestReveal(docId: string, line: number, column: number, length: number) {
  if (currentDocId === docId && view) selectRange(line, column, length);
  else pendingReveal = { docId, line, column, length };
}

/** Opens the Problems (lint) panel. */
export async function showProblems() {
  if (!view) return;
  const { openLintPanel } = await import("@codemirror/lint");
  openLintPanel(view);
}

/** Opens the search panel and moves focus to its Replace field (FR-051). */
export function openReplacePanel(v: EditorView): boolean {
  openSearchPanel(v);
  // CodeMirror focuses the search field asynchronously; move focus after it.
  setTimeout(() => {
    const input = v.dom.querySelector<HTMLInputElement>(".cm-search input[name=replace]");
    input?.focus();
    input?.select();
  }, 30);
  return true;
}

export type EditorCommandName = "undo" | "redo" | "find" | "replace" | "gotoLine" | "selectAll" | "foldAll" | "unfoldAll";

export function editorCommand(name: EditorCommandName) {
  if (!view) return;
  switch (name) {
    case "undo":
      undo(view);
      view.focus();
      break;
    case "redo":
      redo(view);
      view.focus();
      break;
    case "selectAll":
      selectAll(view);
      view.focus();
      break;
    case "find":
      openSearchPanel(view);
      break;
    case "replace":
      openReplacePanel(view);
      break;
    case "gotoLine":
      gotoLine(view);
      break;
    case "foldAll":
      foldAll(view);
      view.focus();
      break;
    case "unfoldAll":
      unfoldAll(view);
      view.focus();
      break;
  }
}

/** The id of the document the editor is showing, if any. */
export function editorDocId() {
  return view ? currentDocId : null;
}
