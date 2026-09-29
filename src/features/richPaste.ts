import type { EditorView } from "@codemirror/view";
import { EditorSelection, StateEffect, StateField, type EditorState, type TransactionSpec } from "@codemirror/state";

interface PasteRange {
  from: number;
  to: number;
}

const trackPaste = StateEffect.define<{ id: number } & PasteRange>();
const untrackPaste = StateEffect.define<number>();

/**
 * Where pending pastes go. Converting a paste can take a moment (the converter
 * loads on first use); edits made meanwhile, such as typing on, move the
 * target so the paste still lands where it was made.
 */
export const pendingPastes = StateField.define<ReadonlyMap<number, PasteRange>>({
  create: () => new Map(),
  update(value, tr) {
    let next = value;
    if (tr.docChanged && value.size) {
      const mapped = new Map<number, PasteRange>();
      for (const [id, r] of value) mapped.set(id, { from: tr.changes.mapPos(r.from, -1), to: Math.max(tr.changes.mapPos(r.from, -1), tr.changes.mapPos(r.to, -1)) });
      next = mapped;
    }
    for (const e of tr.effects) {
      if (e.is(trackPaste)) next = new Map(next).set(e.value.id, { from: e.value.from, to: e.value.to });
      else if (e.is(untrackPaste) && next.has(e.value)) {
        const without = new Map(next);
        without.delete(e.value);
        next = without;
      }
    }
    return next;
  },
});

let nextPasteId = 1;

/**
 * Inserts `convert()`'s text where the selection is now, even if the document
 * changes while it runs. The cursor goes after the insert unless the user
 * edited in the meantime.
 */
async function pasteConverted(view: EditorView, convert: () => Promise<string>) {
  const tracked = view.state.field(pendingPastes, false) !== undefined;
  const start = view.state.doc;
  const id = nextPasteId++;
  const { from, to } = view.state.selection.main;
  if (tracked) view.dispatch({ effects: trackPaste.of({ id, from, to }) });
  let insert = "";
  try {
    insert = await convert();
  } finally {
    const range = (tracked && view.state.field(pendingPastes, false)?.get(id)) || { from, to };
    const unchanged = view.state.doc === start;
    view.dispatch({
      changes: insert ? { from: range.from, to: range.to, insert } : undefined,
      selection: insert && unchanged ? { anchor: range.from + insert.length } : undefined,
      effects: tracked ? untrackPaste.of(id) : undefined,
      scrollIntoView: unchanged,
      userEvent: "input.paste",
    });
  }
}

/**
 * Pastes clipboard HTML (from a browser, Word, Google Docs…) as Markdown.
 * Plain-looking HTML (e.g. from code editors, which wrap text in styled
 * spans) is pasted as the plain-text flavour instead.
 */
export function pasteHtmlAsMarkdown(view: EditorView, html: string, plain: string) {
  return pasteConverted(view, async () => {
    const { htmlToMarkdown, isRichHtml } = await import("../services/convert/html");
    if (!isRichHtml(html)) return plain;
    try {
      return htmlToMarkdown(html).replace(/\n$/, "");
    } catch {
      return plain;
    }
  });
}

/** Tab-separated text (copied from a spreadsheet) becomes a Markdown table; other text pastes as is. */
export function pastePlainTable(view: EditorView, text: string) {
  return pasteConverted(view, async () => {
    const { looksLikeTsv, rowsToMarkdownTable, parseDelimited } = await import("../services/convert/csv");
    return looksLikeTsv(text) ? rowsToMarkdownTable(parseDelimited(text, "\t")) + "\n" : text;
  });
}

const PASTED_URL = /^(?:https?:\/\/|mailto:)\S+$/i;

/**
 * Pasting a URL while text is selected turns the selection into a link:
 * select "our docs", paste https://example.com → [our docs](https://example.com).
 * Returns the transaction, or null when the normal paste should happen
 * (nothing selected, multi-line selection, the selection is itself a URL, or
 * the clipboard isn't a single URL).
 */
export function linkOverSelection(state: EditorState, pasted: string): TransactionSpec | null {
  const url = pasted.trim();
  if (!PASTED_URL.test(url)) return null;
  const ranges = state.selection.ranges;
  if (ranges.some((r) => r.empty)) return null;
  const texts = ranges.map((r) => state.sliceDoc(r.from, r.to));
  if (texts.some((t) => t.includes("\n") || PASTED_URL.test(t.trim()))) return null;
  const dest = /[()<>\s]/.test(url) ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url;
  return {
    ...state.changeByRange((range) => {
      const insert = `[${state.sliceDoc(range.from, range.to)}](${dest})`;
      return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + insert.length) };
    }),
    scrollIntoView: true,
    userEvent: "input.paste",
  };
}
