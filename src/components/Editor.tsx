import { useEffect, useRef } from "react";
import { Annotation, EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, placeholder, highlightSpecialChars,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches, search, gotoLine } from "@codemirror/search";
import {
  syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap, indentUnit,
} from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { tags as t } from "@lezer/highlight";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { useUi } from "../stores/uiStore";
import type { Settings } from "../types";
import { editorShowing, openReplacePanel, registerEditorView } from "../features/editorBridge";
import { followLinks } from "../features/followLink";
import { paragraphFocus } from "../features/paragraphFocus";
import { editorTopLine, scrollEditorToLine, scrollSync } from "../features/scrollSync";
import { editorKeymap } from "../features/commands";
import { minimalChange } from "../features/saveTransforms";
import { moveTableCell } from "../features/tables";
import { insertImageFiles, isImageFile } from "../features/images";
import { linkOverSelection, pasteHtmlAsMarkdown, pastePlainTable, pendingPastes } from "../features/richPaste";
import { markdownLinter } from "../features/lintExtension";
import { linkCompletion } from "../features/completion";
import { gitChangeGutter, refreshGitBase } from "../features/gitGutter";
import { surroundSelection } from "../features/surround";

/**
 * Markdown-aware syntax colours (FR-020). Colours come from CSS variables so
 * the same style follows the light/dark theme.
 */
const markdownHighlight = HighlightStyle.define([
  { tag: t.heading1, fontWeight: "700", fontSize: "1.3em", color: "var(--hl-heading)" },
  { tag: t.heading2, fontWeight: "700", fontSize: "1.18em", color: "var(--hl-heading)" },
  { tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: "700", color: "var(--hl-heading)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--hl-link)" },
  { tag: t.monospace, color: "var(--hl-code)", fontFamily: "var(--font-mono)" },
  { tag: t.quote, color: "var(--hl-quote)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.contentSeparator, t.list], color: "var(--hl-meta)" },
  { tag: t.meta, color: "var(--hl-meta)" },
  { tag: t.keyword, color: "var(--hl-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--hl-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--hl-number)" },
  { tag: t.comment, color: "var(--hl-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--hl-function)" },
  { tag: [t.typeName, t.className, t.tagName], color: "var(--hl-type)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--hl-property)" },
  { tag: t.invalid, color: "var(--danger)" },
]);

const appearance = new Compartment();
/** The editor's key bindings; reconfigured when the user changes shortcuts. */
const keys = new Compartment();

function editorKeys(): Extension {
  return keymap.of([
    { key: "Mod-g", run: gotoLine, preventDefault: true },
    { key: "Mod-h", run: openReplacePanel, preventDefault: true },
    ...editorKeymap(),
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    // In a table, Tab and Shift+Tab move between cells; elsewhere they indent.
    { key: "Tab", run: moveTableCell(true), shift: moveTableCell(false) },
    indentWithTab,
  ]);
}
const gutters = new Compartment();
const wrapping = new Compartment();
const tabs = new Compartment();
const linting = new Compartment();
const spelling = new Compartment();
/** Labels for CodeMirror's find/replace, go-to-line and lint panels, in the app's capitalization. */
const PHRASES: Record<string, string> = {
  next: "Next",
  previous: "Previous",
  all: "Select All",
  "match case": "Match case",
  "by word": "Whole word",
  regexp: "Regex",
  replace: "Replace",
  "replace all": "Replace All",
  close: "Close",
  "Go to line": "Go to line",
  go: "Go",
  Diagnostics: "Problems",
  "No diagnostics": "No problems",
};
const locking = new Compartment();
const typewriter = new Compartment();
const dimming = new Compartment();
/** Typewriter scrolling: every edit or cursor move keeps the cursor's line in the middle of the editor. */
const typewriterExt = (on: boolean): Extension =>
  on
    ? EditorState.transactionExtender.of((tr) =>
        tr.docChanged || tr.selection ? { effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: "center" }) } : null,
      )
    : [];
/** Marks changes that come from outside the editor (reload from disk), which a read-only document still takes. */
const externalSync = Annotation.define<boolean>();
/** Read-only documents: no typing, and commands (formatting, revert…) can't change the text either. */
const lockExt = (locked: boolean): Extension =>
  locked ? [EditorState.readOnly.of(true), EditorState.changeFilter.of((tr) => !!tr.annotation(externalSync))] : [];
const isLocked = (docId: string) => !!useDocuments.getState().docs.find((d) => d.id === docId)?.readOnly;
const spellAttr = (on: boolean) => EditorView.contentAttributes.of({ spellcheck: on ? "true" : "false" });

function appearanceExt(s: Settings): Extension {
  const font = s.fontFamily ? `${s.fontFamily}, var(--font-mono)` : "var(--font-mono)";
  return EditorView.theme({
    "&": { fontSize: `${s.fontSize}px` },
    ".cm-content, .cm-gutters": { fontFamily: font },
    // A limited line length centers the text (with its gutters, about 8 characters wide) in a wide pane.
    ...(s.editorLineLength > 0 && {
      ".cm-scroller": { fontFamily: font, paddingInline: `max(0px, calc((100% - ${s.editorLineLength + 8}ch) / 2))` },
    }),
  });
}

function reconfigure(s: Settings) {
  return [
    appearance.reconfigure(appearanceExt(s)),
    gutters.reconfigure(s.lineNumbers ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []),
    wrapping.reconfigure(s.lineWrapping ? EditorView.lineWrapping : []),
    tabs.reconfigure([EditorState.tabSize.of(s.tabSize), indentUnit.of(" ".repeat(s.tabSize))]),
    linting.reconfigure(s.lintMarkdown ? markdownLinter() : []),
    spelling.reconfigure(spellAttr(s.spellCheck)),
    typewriter.reconfigure(typewriterExt(s.typewriterScrolling)),
    dimming.reconfigure(s.dimOtherParagraphs ? paragraphFocus() : []),
    keys.reconfigure(editorKeys()),
  ];
}

/** Editor states per document, so each tab keeps its own undo history and selection. */
const states = new Map<string, EditorState>();
/** Last text synced from the editor into the store, per document. */
const synced = new Map<string, string>();

export function Editor() {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const currentId = useRef<string | null>(null);
  const activeId = useDocuments((s) => s.activeId);
  const readOnly = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.readOnly);
  const content = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content);
  const settings = useSettings((s) => s.settings);

  const createState = (docId: string, text: string) => {
    const s = useSettings.getState().settings;
    synced.set(docId, text);
    return EditorState.create({
      doc: text,
      extensions: [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true }),
        linkCompletion(),
        followLinks(),
        pendingPastes,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(markdownHighlight),
        placeholder("Start writing Markdown…"),
        EditorView.contentAttributes.of({ "aria-label": "Markdown editor" }),
        EditorState.phrases.of(PHRASES),
        surroundSelection,
        spelling.of(spellAttr(s.spellCheck)),
        typewriter.of(typewriterExt(s.typewriterScrolling)),
        dimming.of(s.dimOtherParagraphs ? paragraphFocus() : []),
        locking.of(lockExt(isLocked(docId))),
        // Pasted or dropped images are saved to assets/ and linked.
        EditorView.domEventHandlers({
          paste: (e, view) => {
            const files = [...(e.clipboardData?.files ?? [])];
            if (files.some(isImageFile)) {
              e.preventDefault();
              void insertImageFiles(files);
              return true;
            }
            // Rich text from browsers/Word becomes Markdown (Ctrl+Shift+V still pastes plain text).
            const html = e.clipboardData?.getData("text/html");
            const plainText = e.clipboardData?.getData("text/plain") ?? "";
            const link = linkOverSelection(view.state, plainText);
            if (link) {
              e.preventDefault();
              view.dispatch(link);
              return true;
            }
            if (!useSettings.getState().settings.pasteRichTextAsMarkdown) return false;
            if (!html) {
              if (!plainText.includes("\t")) return false;
              e.preventDefault();
              void pastePlainTable(view, plainText);
              return true;
            }
            e.preventDefault();
            void pasteHtmlAsMarkdown(view, html, e.clipboardData?.getData("text/plain") ?? "");
            return true;
          },
          drop: (e, view) => {
            const files = [...(e.dataTransfer?.files ?? [])];
            if (!files.some(isImageFile)) return false;
            e.preventDefault();
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos !== null) view.dispatch({ selection: { anchor: pos } });
            void insertImageFiles(files);
            return true;
          },
        }),
        keys.of(editorKeys()),
        appearance.of(appearanceExt(s)),
        gutters.of(s.lineNumbers ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []),
        gitChangeGutter(),
        wrapping.of(s.lineWrapping ? EditorView.lineWrapping : []),
        tabs.of([EditorState.tabSize.of(s.tabSize), indentUnit.of(" ".repeat(s.tabSize))]),
        linting.of(s.lintMarkdown ? markdownLinter() : []),
        EditorView.updateListener.of((u) => {
          const id = currentId.current;
          if (!id) return;
          if (u.docChanged) {
            const text = u.state.doc.toString();
            synced.set(id, text);
            useDocuments.getState().setContent(id, text);
          }
          if (u.docChanged || u.selectionSet) {
            const sel = u.state.selection.main;
            const line = u.state.doc.lineAt(sel.head);
            useUi.getState().setCursor({
              line: line.number,
              col: sel.head - line.from + 1,
              selected: u.state.selection.ranges.reduce((n, r) => n + (r.to - r.from), 0),
            });
          }
        }),
      ],
    });
  };

  // Mount a single EditorView.
  useEffect(() => {
    const view = new EditorView({ parent: host.current! });
    viewRef.current = view;
    registerEditorView(view);
    const onScroll = () => {
      const el = view.scrollDOM;
      const max = el.scrollHeight - el.clientHeight;
      scrollSync.emit("editor", { ratio: max > 0 ? el.scrollTop / max : 0, line: editorTopLine(view) });
    };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    const off = scrollSync.on("preview", ({ ratio, line }) => {
      const el = view.scrollDOM;
      // The very top and bottom stay aligned; in between, the same source line goes to the top.
      if (line === null || ratio <= 0 || ratio >= 1) {
        el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
        return;
      }
      scrollEditorToLine(view, line);
    });
    // Forget editor state for closed tabs.
    const unsub = useDocuments.subscribe((s) => {
      for (const id of states.keys()) {
        if (!s.docs.some((d) => d.id === id)) {
          states.delete(id);
          synced.delete(id);
        }
      }
    });
    return () => {
      // Keep the current document's state (undo history) across remounts.
      if (currentId.current) states.set(currentId.current, view.state);
      currentId.current = null;
      editorShowing(null);
      unsub();
      off();
      registerEditorView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Switch documents when the active tab changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (currentId.current) states.set(currentId.current, view.state);
    currentId.current = activeId;
    if (!activeId) return;
    const doc = useDocuments.getState().docs.find((d) => d.id === activeId);
    if (!doc) return;
    const cached = states.get(activeId);
    const state = cached && cached.doc.toString() === doc.content ? cached : createState(activeId, doc.content);
    view.setState(state);
    view.dispatch({ effects: reconfigure(useSettings.getState().settings) });
    editorShowing(activeId);
    void refreshGitBase();
    const sel = state.selection.main;
    const line = state.doc.lineAt(sel.head);
    useUi.getState().setCursor({ line: line.number, col: sel.head - line.from + 1, selected: 0 });
    requestAnimationFrame(() => view.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Apply content changed outside the editor (reload from disk, recovery).
  useEffect(() => {
    const view = viewRef.current;
    const id = currentId.current;
    if (!view || !id || content === undefined || content === synced.get(id)) return;
    synced.set(id, content);
    const change = minimalChange(view.state.doc.toString(), content);
    if (change) view.dispatch({ changes: change, annotations: externalSync.of(true) });
  }, [content]);

  // Lock or unlock editing when the document's read-only state changes.
  useEffect(() => {
    viewRef.current?.dispatch({ effects: locking.reconfigure(lockExt(!!readOnly)) });
  }, [readOnly, activeId]);

  // Apply settings changes (FR-025).
  useEffect(() => {
    viewRef.current?.dispatch({ effects: reconfigure(settings) });
  }, [settings.fontSize, settings.fontFamily, settings.lineNumbers, settings.lineWrapping, settings.tabSize, settings.lintMarkdown, settings.lintDisabledRules, settings.spellCheck, settings.typewriterScrolling, settings.dimOtherParagraphs, settings.editorLineLength]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="editor-host" ref={host} />;
}
