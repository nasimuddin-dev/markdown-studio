import { RangeSet, StateEffect, StateField, type EditorState, type Extension, type StateCommand, type Transaction } from "@codemirror/state";
import { EditorView, GutterMarker, gutter, showTooltip, type Tooltip } from "@codemirror/view";
import { backend } from "../services";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { diffLines } from "./diff";
import { getEditorView } from "./editorBridge";

/**
 * Change markers in the editor's gutter: lines added, changed or deleted since
 * the last Git commit, like the change bars of code editors. The committed
 * text (the "base") comes from the backend; the comparison runs in the editor.
 * Clicking a bar (or Show Change) shows the committed lines and can revert them.
 */

export type ChangeKind = "added" | "modified" | "deleted";

/** One changed region: `count` lines from line `start` (1-based) replaced the committed `old` lines. */
export interface Hunk {
  start: number;
  /** 0 for a deletion; `start` is then the line after it (one past the last line at the end). */
  count: number;
  old: string[];
}

/** Keeps each comparison fast enough to run on every keystroke. */
const MAX_CELLS = 1_000_000;
const MAX_DOCUMENT_CHARS = 1_000_000;

/** The changed regions between the committed text and the current one, or null when they differ too much to compare quickly. */
export function changeHunks(base: string, current: string): Hunk[] | null {
  const lines = diffLines(base, current, MAX_CELLS);
  if (!lines) return null;
  const hunks: Hunk[] = [];
  let nextNew = 1;
  for (let i = 0; i < lines.length; ) {
    if (lines[i].kind === "same") {
      nextNew = lines[i].newNo! + 1;
      i++;
      continue;
    }
    const hunk: Hunk = { start: nextNew, count: 0, old: [] };
    for (; i < lines.length && lines[i].kind !== "same"; i++) {
      if (lines[i].kind === "del") hunk.old.push(lines[i].text);
      else hunk.count++;
    }
    nextNew += hunk.count;
    hunks.push(hunk);
  }
  return hunks;
}

/**
 * Line number (1-based) → change. Added lines replace deleted ones first
 * (changed); any beyond that are new. A deletion is shown on the line after
 * it (or the last line).
 */
export function hunkMarkers(hunks: Hunk[], lastLine: number): Map<number, ChangeKind> {
  const out = new Map<number, ChangeKind>();
  for (const h of hunks) {
    for (let k = 0; k < h.count; k++) out.set(h.start + k, k < h.old.length ? "modified" : "added");
    const at = Math.min(h.start, lastLine);
    if (!h.count && !out.has(at)) out.set(at, "deleted");
  }
  return out;
}

export function changeMarkers(base: string, current: string): Map<number, ChangeKind> | null {
  const hunks = changeHunks(base, current);
  return hunks && hunkMarkers(hunks, current.split("\n").length);
}

/** The change shown on `line`, if any. */
export function hunkAtLine(hunks: Hunk[], line: number, lastLine: number): Hunk | undefined {
  return hunks.find((h) => (h.count ? line >= h.start && line < h.start + h.count : line === Math.min(h.start, lastLine)));
}

const TITLES: Record<ChangeKind, string> = {
  added: "Added since the last commit. Click to see the change",
  modified: "Changed since the last commit. Click to see the change",
  deleted: "Lines deleted here since the last commit. Click to see them",
};

class ChangeMarker extends GutterMarker {
  constructor(readonly kind: ChangeKind) {
    super();
  }
  eq(other: GutterMarker) {
    return other instanceof ChangeMarker && other.kind === this.kind;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = `cm-git-change cm-git-${this.kind}`;
    el.title = TITLES[this.kind];
    return el;
  }
}
const MARKERS = { added: new ChangeMarker("added"), modified: new ChangeMarker("modified"), deleted: new ChangeMarker("deleted") };

/** Sets the committed text to compare with (null: no markers). */
export const setGitBase = StateEffect.define<string | null>();
/** Shows the change on a line in a pop-up (null closes it). */
const setPeek = StateEffect.define<number | null>();

const baseField = StateField.define<string | null>({
  create: () => null,
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(setGitBase)) value = e.value;
    return value;
  },
});

interface Changes {
  hunks: Hunk[];
  markers: RangeSet<GutterMarker>;
}

function compare(state: EditorState): Changes {
  const base = state.field(baseField);
  // Very large documents (as for the live preview) aren't compared, to keep typing fast.
  if (base === null || state.doc.length > MAX_DOCUMENT_CHARS) return { hunks: [], markers: RangeSet.empty };
  const hunks = changeHunks(base, state.doc.toString()) ?? [];
  const ranges = [...hunkMarkers(hunks, state.doc.lines)]
    .filter(([line]) => line <= state.doc.lines)
    .sort((a, b) => a[0] - b[0])
    .map(([line, kind]) => MARKERS[kind].range(state.doc.line(line).from));
  return { hunks, markers: RangeSet.of(ranges) };
}

const changesField = StateField.define<Changes>({
  create: compare,
  update: (value, tr) => (tr.docChanged || tr.effects.some((e) => e.is(setGitBase)) ? compare(tr.state) : value),
});

/** The line whose change is shown in the pop-up; closed by any edit. */
const peekField = StateField.define<number | null>({
  create: () => null,
  update: (value, tr) => {
    if (tr.docChanged) value = null;
    for (const e of tr.effects) if (e.is(setPeek)) value = e.value;
    return value;
  },
  provide: (f) => showTooltip.compute([f, changesField], (state) => peekTooltip(state, state.field(f))),
});

/** The committed text the editor compares with, or null. */
export const gitBaseOf = (state: EditorState) => state.field(baseField, false) ?? null;
/** The changed regions in the editor, compared with the last commit. */
export const gitHunksOf = (state: EditorState) => state.field(changesField, false)?.hunks ?? [];

/** Replaces a change with the committed lines. */
function revertHunk(state: EditorState, dispatch: (tr: Transaction) => void, hunk: Hunk) {
  const { doc } = state;
  const old = hunk.old.join("\n");
  let change: { from: number; to?: number; insert?: string };
  if (hunk.count) {
    const first = doc.line(hunk.start);
    const last = doc.line(hunk.start + hunk.count - 1);
    if (hunk.old.length) change = { from: first.from, to: last.to, insert: old };
    // Lines that were only added go away with their line break.
    else if (last.number < doc.lines) change = { from: first.from, to: last.to + 1 };
    else change = { from: Math.max(0, first.from - 1), to: last.to };
  } else if (hunk.start <= doc.lines) change = { from: doc.line(hunk.start).from, insert: old + "\n" };
  else change = { from: doc.length, insert: "\n" + old };
  dispatch(state.update({ changes: change, selection: { anchor: change.from }, scrollIntoView: true, effects: setPeek.of(null), userEvent: "input.revert" }));
}

function button(label: string, onClick: () => void, primary = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = primary ? "button primary" : "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function peekTooltip(state: EditorState, line: number | null): Tooltip | null {
  if (line === null || line > state.doc.lines) return null;
  const hunk = hunkAtLine(state.field(changesField).hunks, line, state.doc.lines);
  if (!hunk) return null;
  return {
    pos: state.doc.line(line).from,
    above: false,
    create: (view) => {
      const dom = document.createElement("div");
      dom.className = "cm-git-peek";
      dom.setAttribute("role", "dialog");
      dom.setAttribute("aria-label", "Change since the last commit");
      const title = document.createElement("div");
      title.className = "cm-git-peek-title";
      const lines = (n: number) => `${n} line${n === 1 ? "" : "s"}`;
      title.textContent = !hunk.old.length
        ? `${lines(hunk.count)} added since the last commit.`
        : hunk.count
          ? `Changed since the last commit. Before (${lines(hunk.old.length)}):`
          : `${lines(hunk.old.length)} deleted here since the last commit:`;
      dom.append(title);
      if (hunk.old.length) {
        const pre = document.createElement("pre");
        pre.className = "cm-git-peek-old";
        pre.textContent = hunk.old.join("\n");
        dom.append(pre);
      }
      const close = () => {
        view.dispatch({ effects: setPeek.of(null) });
        view.focus();
      };
      const actions = document.createElement("div");
      actions.className = "cm-git-peek-actions";
      const revert = button(hunk.count && !hunk.old.length ? "Remove Added Lines" : "Revert Change", () => {
          revertHunk(view.state, view.dispatch, hunk);
          view.focus();
        }, true);
      actions.append(revert, button("Close", close));
      dom.append(actions);
      dom.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      });
      // After the caller (a menu, the palette) has returned focus to the editor.
      return { dom, mount: () => void setTimeout(() => dom.isConnected && revert.focus()) };
    },
  };
}

function cursorLine(state: EditorState) {
  return state.doc.lineAt(state.selection.main.head).number;
}

/** Moves the cursor to the next (or previous) change, wrapping around. */
function gotoChange(forward: boolean): StateCommand {
  return ({ state, dispatch }) => {
    const hunks = gitHunksOf(state);
    if (!hunks.length) return false;
    const line = cursorLine(state);
    const starts = hunks.map((h) => Math.min(h.start, state.doc.lines));
    const target = forward ? (starts.find((s) => s > line) ?? starts[0]) : ([...starts].reverse().find((s) => s < line) ?? starts[starts.length - 1]);
    dispatch(state.update({ selection: { anchor: state.doc.line(target).from }, scrollIntoView: true }));
    return true;
  };
}

export const nextChange = gotoChange(true);
export const previousChange = gotoChange(false);

/** Shows the committed version of the change at the cursor. */
export const showChangeAtCursor: StateCommand = ({ state, dispatch }) => {
  const line = cursorLine(state);
  if (!hunkAtLine(gitHunksOf(state), line, state.doc.lines)) return false;
  dispatch(state.update({ effects: setPeek.of(line) }));
  return true;
};

/** Reverts the change at the cursor to the last commit (undoable). */
export const revertChangeAtCursor: StateCommand = ({ state, dispatch }) => {
  const hunk = hunkAtLine(gitHunksOf(state), cursorLine(state), state.doc.lines);
  if (!hunk) return false;
  revertHunk(state, dispatch, hunk);
  return true;
};

/** The editor extension: the base text, the changes, their gutter and the pop-up. */
export function gitChangeGutter(): Extension {
  return [
    baseField,
    changesField,
    peekField,
    gutter({
      class: "cm-git-gutter",
      markers: (view) => view.state.field(changesField).markers,
      domEventHandlers: {
        mousedown: (view, block) => {
          const line = view.state.doc.lineAt(block.from).number;
          if (!hunkAtLine(view.state.field(changesField).hunks, line, view.state.doc.lines)) return false;
          view.dispatch({ effects: setPeek.of(view.state.field(peekField) === line ? null : line) });
          return true;
        },
      },
    }),
    EditorView.baseTheme({
      ".cm-git-gutter": { width: "5px", paddingLeft: "1px" },
      ".cm-git-gutter .cm-gutterElement": { padding: "0", cursor: "pointer" },
      ".cm-git-change": { width: "3px", height: "100%" },
      ".cm-git-added": { background: "var(--git-added)" },
      ".cm-git-modified": { background: "var(--git-modified)" },
      ".cm-git-deleted": { height: "0", borderTop: "4px solid transparent", borderLeft: "4px solid var(--danger)", borderBottom: "4px solid transparent", marginTop: "-4px" },
    }),
  ];
}

let generation = 0;

/**
 * Loads the committed text of the document in the editor and shows its
 * changes. Called when the document in the editor changes, after saves and
 * when the window regains focus (a commit made elsewhere).
 */
export async function refreshGitBase() {
  const view = getEditorView();
  const { docs, activeId } = useDocuments.getState();
  const doc = docs.find((d) => d.id === activeId);
  const run = ++generation;
  let base: string | null = null;
  if (view && doc?.path && useSettings.getState().settings.showGitStatus) {
    try {
      base = await backend().gitHeadText(doc.path);
    } catch {
      // Git is optional: no markers rather than an error.
    }
  }
  const now = getEditorView();
  if (!now || run !== generation || useDocuments.getState().activeId !== activeId) return;
  if (gitBaseOf(now.state) !== base) now.dispatch({ effects: setGitBase.of(base) });
}
