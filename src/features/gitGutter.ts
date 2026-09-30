import { RangeSet, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { EditorView, GutterMarker, gutter } from "@codemirror/view";
import { backend } from "../services";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { diffLines } from "./diff";
import { getEditorView } from "./editorBridge";

/**
 * Change markers in the editor's gutter: lines added, changed or deleted since
 * the last Git commit, like the change bars of code editors. The committed
 * text (the "base") comes from the backend; the comparison runs in the editor.
 */

export type ChangeKind = "added" | "modified" | "deleted";

/** Keeps each comparison fast enough to run on every keystroke. */
const MAX_CELLS = 1_000_000;
const MAX_DOCUMENT_CHARS = 1_000_000;

/**
 * Line number (1-based) → change, comparing the committed text with the
 * current one. A deletion is shown on the line after it (or the last line).
 * Returns null when the texts differ too much to compare quickly.
 */
export function changeMarkers(base: string, current: string): Map<number, ChangeKind> | null {
  const lines = diffLines(base, current, MAX_CELLS);
  if (!lines) return null;
  const out = new Map<number, ChangeKind>();
  const lastLine = current.split("\n").length;
  for (let i = 0; i < lines.length; ) {
    if (lines[i].kind === "same") {
      i++;
      continue;
    }
    // A run of deletions and additions.
    let deleted = 0;
    const added: number[] = [];
    for (; i < lines.length && lines[i].kind !== "same"; i++) {
      if (lines[i].kind === "del") deleted++;
      else added.push(lines[i].newNo!);
    }
    // Added lines replace deleted ones first (changed); any beyond that are new.
    if (added.length) added.forEach((n, k) => out.set(n, k < deleted ? "modified" : "added"));
    else {
      const next = lines[i]?.newNo ?? lastLine;
      if (!out.has(next)) out.set(next, "deleted");
    }
  }
  return out;
}

const TITLES: Record<ChangeKind, string> = {
  added: "Added since the last commit",
  modified: "Changed since the last commit",
  deleted: "Lines deleted here since the last commit",
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

const baseField = StateField.define<string | null>({
  create: () => null,
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(setGitBase)) value = e.value;
    return value;
  },
});

function buildMarkers(state: EditorState): RangeSet<GutterMarker> {
  const base = state.field(baseField);
  // Very large documents (as for the live preview) aren't compared, to keep typing fast.
  if (base === null || state.doc.length > MAX_DOCUMENT_CHARS) return RangeSet.empty;
  const changes = changeMarkers(base, state.doc.toString());
  if (!changes) return RangeSet.empty;
  const ranges = [...changes]
    .filter(([line]) => line <= state.doc.lines)
    .sort((a, b) => a[0] - b[0])
    .map(([line, kind]) => MARKERS[kind].range(state.doc.line(line).from));
  return RangeSet.of(ranges);
}

const markersField = StateField.define<RangeSet<GutterMarker>>({
  create: buildMarkers,
  update: (value, tr) => (tr.docChanged || tr.effects.some((e) => e.is(setGitBase)) ? buildMarkers(tr.state) : value),
});

/** The committed text the editor compares with, or null. */
export const gitBaseOf = (state: EditorState) => state.field(baseField, false) ?? null;

/** The editor extension: the base text, the markers and their gutter. */
export function gitChangeGutter(): Extension {
  return [
    baseField,
    markersField,
    gutter({ class: "cm-git-gutter", markers: (view) => view.state.field(markersField) }),
    EditorView.baseTheme({
      ".cm-git-gutter": { width: "4px", paddingLeft: "1px" },
      ".cm-git-gutter .cm-gutterElement": { padding: "0" },
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
