import { EditorSelection, type EditorState, type Transaction, type StateCommand } from "@codemirror/state";

/**
 * Markdown formatting commands. They are plain CodeMirror `StateCommand`s so
 * they can be bound to keys, run from menus, and unit-tested without a view.
 */

type Dispatch = (tr: Transaction) => void;

/** Toggles an inline marker (e.g. `**`) around each selection range. */
function toggleInline(marker: string): StateCommand {
  return ({ state, dispatch }) => {
    const len = marker.length;
    const tr = state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - len, range.from);
      const after = state.sliceDoc(range.to, range.to + len);
      const text = state.sliceDoc(range.from, range.to);

      // Markers just outside the selection: unwrap.
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - len, to: range.from, insert: "" },
            { from: range.to, to: range.to + len, insert: "" },
          ],
          range: EditorSelection.range(range.from - len, range.to - len),
        };
      }
      // Markers inside the selection: unwrap.
      if (text.length >= len * 2 && text.startsWith(marker) && text.endsWith(marker)) {
        return {
          changes: { from: range.from, to: range.to, insert: text.slice(len, text.length - len) },
          range: EditorSelection.range(range.from, range.to - len * 2),
        };
      }
      // Wrap (or insert an empty pair with the cursor in the middle).
      return {
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + len, range.to + len),
      };
    });
    dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

export const toggleBold = toggleInline("**");
export const toggleItalic = toggleInline("*");
export const toggleStrikethrough = toggleInline("~~");
export const toggleInlineCode = toggleInline("`");

/** Wraps the selection as `[text](url)` and selects the placeholder that needs editing. */
export const insertLink: StateCommand = ({ state, dispatch }) => {
  const tr = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    const looksLikeUrl = /^(https?:\/\/|mailto:)\S+$/i.test(text);
    if (looksLikeUrl) {
      const insert = `[](${text})`;
      return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + 1) };
    }
    const label = text || "link text";
    const insert = `[${label}](https://)`;
    const urlStart = range.from + label.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: text
        ? EditorSelection.range(urlStart, urlStart + "https://".length)
        : EditorSelection.range(range.from + 1, range.from + 1 + label.length),
    };
  });
  dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.format" }));
  return true;
};

/** Distinct lines touched by the selection, in document order. */
function selectedLines(state: EditorState) {
  const seen = new Set<number>();
  const lines = [];
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to; ) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        lines.push(line);
      }
      pos = line.to + 1;
    }
  }
  return lines.sort((a, b) => a.number - b.number);
}

const HEADING = /^(#{1,6})\s+/;
const LIST_PREFIX = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/;

/** Sets the heading level of each selected line; applying the same level again removes it. */
export function setHeading(level: number): StateCommand {
  return ({ state, dispatch }) => {
    const changes = selectedLines(state).map((line) => {
      const m = HEADING.exec(line.text);
      const current = m ? m[1].length : 0;
      const prefix = current === level || level === 0 ? "" : "#".repeat(level) + " ";
      return { from: line.from, to: line.from + (m ? m[0].length : 0), insert: prefix };
    });
    dispatch(state.update({ changes, scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

/**
 * Moves each selected heading up (`delta` < 0, fewer `#`) or down a level,
 * staying within H1–H6. Lines that aren't headings are left alone.
 */
function shiftHeadingLevel(delta: -1 | 1): StateCommand {
  return ({ state, dispatch }) => {
    const changes = selectedLines(state).flatMap((line) => {
      const m = HEADING.exec(line.text);
      if (!m) return [];
      const level = Math.min(6, Math.max(1, m[1].length + delta));
      if (level === m[1].length) return [];
      return [{ from: line.from, to: line.from + m[1].length, insert: "#".repeat(level) }];
    });
    if (changes.length === 0) return false;
    dispatch(state.update({ changes, scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

export const promoteHeading = shiftHeadingLevel(-1);
export const demoteHeading = shiftHeadingLevel(1);

const TASK_BOX = /^((?:\s*>)*\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/;

/**
 * Checks or unchecks the task on each selected line. If any selected task is
 * open, all of them are checked; otherwise they are unchecked. Returns false
 * when no selected line is a task, so the key falls through to its default.
 */
export const toggleTaskCheck: StateCommand = ({ state, dispatch }) => {
  const tasks = selectedLines(state)
    .map((line) => ({ line, m: TASK_BOX.exec(line.text) }))
    .filter((t): t is { line: (typeof t)["line"]; m: RegExpExecArray } => t.m !== null);
  if (tasks.length === 0) return false;
  const check = tasks.some((t) => t.m[2] === " ");
  const changes = tasks.map(({ line, m }) => ({
    from: line.from + m[1].length,
    to: line.from + m[1].length + 1,
    insert: check ? "x" : " ",
  }));
  dispatch(state.update({ changes, userEvent: "input.toggleTask" }));
  return true;
};

/**
 * Inserts the next footnote reference `[^n]` at the cursor and its definition
 * at the end of the document, then moves the cursor to the definition.
 */
export const insertFootnote: StateCommand = ({ state, dispatch }) => {
  const text = state.doc.toString();
  const used = [...text.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1]));
  const n = used.length ? Math.max(...used) + 1 : 1;
  const at = state.selection.main.to;
  const end = state.doc.length;
  // Keep definitions together; otherwise separate them from the text by a blank line.
  const afterDefinition = /(^|\n)\[\^[^\]\n]+\]:[^\n]*\n?$/.test(text);
  const newlines = text === "" ? 0 : (text.match(/\n*$/)?.[0].length ?? 0);
  const wanted = text === "" ? 0 : afterDefinition ? 1 : 2;
  const definition = `${"\n".repeat(Math.max(0, wanted - newlines))}[^${n}]: `;
  const ref = `[^${n}]`;
  dispatch(
    state.update({
      changes: [
        { from: at, insert: ref },
        { from: end, insert: definition },
      ],
      selection: { anchor: end + ref.length + definition.length },
      scrollIntoView: true,
      userEvent: "input.footnote",
    }),
  );
  return true;
};

type LineKind = "bullet" | "ordered" | "task" | "quote";

function prefixFor(kind: LineKind, index: number) {
  switch (kind) {
    case "bullet":
      return "- ";
    case "ordered":
      return `${index + 1}. `;
    case "task":
      return "- [ ] ";
    case "quote":
      return "> ";
  }
}

function hasKind(text: string, kind: LineKind) {
  switch (kind) {
    case "bullet":
      return /^\s*[-*+]\s+(?!\[[ xX]\])/.test(text);
    case "ordered":
      return /^\s*\d+[.)]\s+/.test(text);
    case "task":
      return /^\s*[-*+]\s+\[[ xX]\]\s+/.test(text);
    case "quote":
      return /^\s*>/.test(text);
  }
}

/**
 * Toggles a line prefix (list, task, quote) on the selected lines. If every
 * non-empty line already has that kind, it is removed; otherwise any existing
 * list/quote prefix is replaced.
 */
function toggleLinePrefix(kind: LineKind): StateCommand {
  return ({ state, dispatch }) => {
    const lines = selectedLines(state);
    const content = lines.filter((l) => l.text.trim() !== "" || lines.length === 1);
    const remove = content.length > 0 && content.every((l) => hasKind(l.text, kind));
    let n = 0;
    const changes = content.map((line) => {
      const m = LIST_PREFIX.exec(line.text);
      const indent = m ? m[1] : (/^\s*/.exec(line.text)?.[0] ?? "");
      const existing = m ? m[0].length : indent.length;
      const insert = remove ? indent : indent + prefixFor(kind, n++);
      return { from: line.from, to: line.from + existing, insert };
    });
    dispatch(state.update({ changes, scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

export const toggleBulletList = toggleLinePrefix("bullet");
export const toggleOrderedList = toggleLinePrefix("ordered");
export const toggleTaskList = toggleLinePrefix("task");
export const toggleQuote = toggleLinePrefix("quote");

/** Inserts a block, making sure it sits on its own lines. */
function insertBlock(build: (selected: string) => { text: string; cursorOffset: number; selectLength?: number }): StateCommand {
  return ({ state, dispatch }) => {
    const range = state.selection.main;
    const selected = state.sliceDoc(range.from, range.to);
    const { text, cursorOffset, selectLength = 0 } = build(selected);
    const lineStart = state.doc.lineAt(range.from);
    const lineEnd = state.doc.lineAt(range.to);
    const needsLeadingBreak = range.from > lineStart.from ? "\n\n" : lineStart.number > 1 && state.doc.line(lineStart.number - 1).text.trim() !== "" ? "\n" : "";
    const needsTrailingBreak = range.to < lineEnd.to ? "\n\n" : "\n";
    const insert = needsLeadingBreak + text + needsTrailingBreak;
    const anchor = range.from + needsLeadingBreak.length + cursorOffset;
    dispatch(
      state.update({
        changes: { from: range.from, to: range.to, insert },
        selection: EditorSelection.range(anchor, anchor + selectLength),
        scrollIntoView: true,
        userEvent: "input.format",
      }),
    );
    return true;
  };
}

export const insertCodeBlock = insertBlock((selected) => ({
  text: "```\n" + selected + (selected.endsWith("\n") || !selected ? "" : "\n") + "```",
  cursorOffset: 3,
}));

/** Replaces each selection (or inserts at each cursor) with text made when the command runs. */
export function insertText(make: () => string): StateCommand {
  return ({ state, dispatch }) => {
    const text = make();
    dispatch(state.update(state.replaceSelection(text), { scrollIntoView: true, userEvent: "input" }));
    return true;
  };
}

/**
 * Inserts a GitHub alert (callout): `> [!NOTE]` and a quoted line, or the
 * selected text quoted under it. The cursor goes to where the text is typed.
 */
export function insertCallout(kind: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION"): StateCommand {
  return insertBlock((selected) => {
    const head = `> [!${kind}]\n`;
    const body = selected.trim() ? selected.replace(/\n+$/, "").split("\n").map((l) => (l.trim() ? `> ${l}` : ">")).join("\n") : "> ";
    return { text: head + body, cursorOffset: head.length + body.length };
  });
}

/** Inserts a table with `columns` columns and `rows` body rows; the first header cell is selected. */
export function insertTableOf(columns: number, rows: number): StateCommand {
  return insertBlock(() => {
    const cols = Array.from({ length: columns }, (_, i) => `Column ${i + 1}`);
    const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
    const lines = [
      row(cols),
      row(cols.map((c) => "-".repeat(c.length))),
      ...Array.from({ length: rows }, () => row(cols.map((c) => "Cell".padEnd(c.length)))),
    ];
    return { text: lines.join("\n"), cursorOffset: 2, selectLength: "Column 1".length };
  });
}

export const insertTable = insertTableOf(2, 1);

export const insertHorizontalRule = insertBlock(() => ({ text: "---", cursorOffset: 4 }));

/** Runs a command against a plain state (used by tests). */
export function applyCommand(state: EditorState, command: StateCommand): EditorState {
  let next = state;
  command({ state, dispatch: ((tr: Transaction) => (next = tr.state)) as Dispatch });
  return next;
}
