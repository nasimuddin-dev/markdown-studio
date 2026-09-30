import { useDocuments, activeDoc } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { useUi } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { backend } from "../services";
import { notify } from "../stores/uiStore";
import type { ViewMode } from "../types";
import {
  closeDocument, hasClosedDocuments, newDocument, openFileDialog, reopenClosedDocument, saveAll, saveDocument, setReadOnly,
} from "./documents";
import { closeWorkspace, createFileIn, openFolderDialog } from "./workspace";
import { editorCommand, getEditorView, runOnEditor } from "./editorBridge";
import { nextDiagnostic, previousDiagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
// Export/print pull in the unified pipeline; load them on first use.
const exporting = () => import("./exporting");
const importing = () => import("./importing");
const ai = () => import("./ai");
import type { StateCommand } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";
import * as fmt from "./formatting";
import {
  alignColumn, deleteColumn, deleteRow, fixTableAtCursor, moveColumn, formatTableAtCursor, insertColumnLeft, insertColumnRight, insertRowAbove, insertRowBelow, sortTableAtCursor,
} from "./tables";
import { fixAllProblemsCommand } from "./lintExtension";
import { fillTemplate } from "./templates";
import { convertToInlineLinks, convertToReferenceLinks } from "./referenceLinks";
import { followLinkAtCursor } from "./followLink";
import { renameHeading } from "./renameHeading";
import { toggleComment } from "@codemirror/commands";
import { foldToLevel } from "./foldLevel";
import { changeCase, convertSelectionToTable, joinLines, removeDuplicateLines, sortLines } from "./textTransforms";
import { numberHeadingsCommand, removeHeadingNumbersCommand } from "./headingNumbers";
import { nextChange, previousChange, revertChangeAtCursor, showChangeAtCursor } from "./gitGutter";
import { insertOrUpdateToc } from "./toc";
import { moveSectionDown, moveSectionUp } from "./sections";

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export interface Command {
  id: string;
  label: string;
  /** Normalized shortcut, e.g. "Mod+Shift+S" (Mod = Cmd on macOS, Ctrl elsewhere). */
  shortcut?: string;
  run(): void | Promise<void>;
  enabled?(): boolean;
  /** Set for editor commands; they are also bound inside CodeMirror's keymap. */
  editor?: StateCommand;
}

const hasActive = () => !!activeDoc();

/** Runs a CodeMirror view command on the active editor and keeps focus there. */
function withEditor(command: (view: EditorView) => boolean) {
  const view = getEditorView();
  if (!view) return;
  command(view);
  view.focus();
}

function formatCommand(id: string, label: string, editor: StateCommand, shortcut?: string): Command {
  return { id, label, shortcut, editor, run: () => runOnEditor(editor), enabled: hasActive };
}

/** Markdown formatting (Format menu). */
export const formatCommands: Record<string, Command> = {
  bold: formatCommand("bold", "Bold", fmt.toggleBold, "Mod+B"),
  italic: formatCommand("italic", "Italic", fmt.toggleItalic, "Mod+I"),
  strikethrough: formatCommand("strikethrough", "Strikethrough", fmt.toggleStrikethrough, "Mod+Shift+X"),
  inlineCode: formatCommand("inlineCode", "Inline Code", fmt.toggleInlineCode, "Mod+E"),
  link: formatCommand("link", "Insert Link", fmt.insertLink, "Mod+K"),
  removeLink: formatCommand("removeLink", "Remove Link", fmt.removeLink),
  toggleComment: formatCommand("toggleComment", "Toggle Comment", toggleComment, "Mod+/"),
  inlineMath: formatCommand("inlineMath", "Inline Math", fmt.toggleInlineMath),
  mathBlock: formatCommand("mathBlock", "Insert Math Block", fmt.insertMathBlock),
  diagramFlowchart: formatCommand("diagramFlowchart", "Insert Flowchart (Mermaid)", fmt.insertDiagram("flowchart")),
  diagramSequence: formatCommand("diagramSequence", "Insert Sequence Diagram (Mermaid)", fmt.insertDiagram("sequence")),
  diagramGantt: formatCommand("diagramGantt", "Insert Gantt Chart (Mermaid)", fmt.insertDiagram("gantt")),
  diagramPie: formatCommand("diagramPie", "Insert Pie Chart (Mermaid)", fmt.insertDiagram("pie")),
  followLink: formatCommand("followLink", "Open Link at Cursor", followLinkAtCursor, "Alt+Enter"),
  renameHeading: { id: "renameHeading", label: "Rename Heading…", shortcut: "F2", run: () => renameHeading(), enabled: hasActive },
  referenceLinks: formatCommand("referenceLinks", "Convert Links to Reference Style", convertToReferenceLinks),
  inlineLinks: formatCommand("inlineLinks", "Convert Links to Inline Style", convertToInlineLinks),
  heading1: formatCommand("heading1", "Heading 1", fmt.setHeading(1), "Mod+Alt+1"),
  heading2: formatCommand("heading2", "Heading 2", fmt.setHeading(2), "Mod+Alt+2"),
  heading3: formatCommand("heading3", "Heading 3", fmt.setHeading(3), "Mod+Alt+3"),
  heading4: formatCommand("heading4", "Heading 4", fmt.setHeading(4), "Mod+Alt+4"),
  heading5: formatCommand("heading5", "Heading 5", fmt.setHeading(5), "Mod+Alt+5"),
  heading6: formatCommand("heading6", "Heading 6", fmt.setHeading(6), "Mod+Alt+6"),
  paragraph: formatCommand("paragraph", "Normal Text", fmt.setHeading(0), "Mod+Alt+0"),
  promoteHeading: formatCommand("promoteHeading", "Promote Heading", fmt.promoteHeading, "Mod+Alt+="),
  demoteHeading: formatCommand("demoteHeading", "Demote Heading", fmt.demoteHeading, "Mod+Alt+-"),
  moveSectionUp: formatCommand("moveSectionUp", "Move Section Up", moveSectionUp),
  moveSectionDown: formatCommand("moveSectionDown", "Move Section Down", moveSectionDown),
  bulletList: formatCommand("bulletList", "Bulleted List", fmt.toggleBulletList, "Mod+Shift+8"),
  orderedList: formatCommand("orderedList", "Numbered List", fmt.toggleOrderedList, "Mod+Shift+7"),
  taskList: formatCommand("taskList", "Task List", fmt.toggleTaskList, "Mod+Shift+9"),
  quote: formatCommand("quote", "Quote", fmt.toggleQuote, "Mod+Shift+."),
  // The same formats as templates' {{date}} and {{datetime}}.
  insertDate: formatCommand("insertDate", "Insert Date", fmt.insertText(() => fillTemplate("{{date}}", "").text)),
  insertDateTime: formatCommand("insertDateTime", "Insert Date and Time", fmt.insertText(() => fillTemplate("{{datetime}}", "").text)),
  calloutNote: formatCommand("calloutNote", "Insert Callout: Note", fmt.insertCallout("NOTE")),
  calloutTip: formatCommand("calloutTip", "Insert Callout: Tip", fmt.insertCallout("TIP")),
  calloutImportant: formatCommand("calloutImportant", "Insert Callout: Important", fmt.insertCallout("IMPORTANT")),
  calloutWarning: formatCommand("calloutWarning", "Insert Callout: Warning", fmt.insertCallout("WARNING")),
  calloutCaution: formatCommand("calloutCaution", "Insert Callout: Caution", fmt.insertCallout("CAUTION")),
  codeBlock: formatCommand("codeBlock", "Code Block", fmt.insertCodeBlock, "Mod+Alt+C"),
  toggleTaskCheck: formatCommand("toggleTaskCheck", "Check / Uncheck Task", fmt.toggleTaskCheck, "Mod+Enter"),
  footnote: formatCommand("footnote", "Insert Footnote", fmt.insertFootnote, "Mod+Alt+R"),
  table: formatCommand("table", "Insert Table", fmt.insertTable),
  convertToTable: formatCommand("convertToTable", "Convert Selection to Table", convertSelectionToTable),
  // A table with mistakes, or (for a selection without "|") comma- or tab-separated text.
  fixTable: formatCommand("fixTable", "Fix Table", (target) => fixTableAtCursor(target) || convertSelectionToTable(target)),
  formatTable: formatCommand("formatTable", "Format Table", formatTableAtCursor, "Mod+Alt+T"),
  sortTableAsc: formatCommand("sortTableAsc", "Sort Table by Column (A to Z)", sortTableAtCursor(false)),
  sortTableDesc: formatCommand("sortTableDesc", "Sort Table by Column (Z to A)", sortTableAtCursor(true)),
  tableRowAbove: formatCommand("tableRowAbove", "Table: Insert Row Above", insertRowAbove),
  tableRowBelow: formatCommand("tableRowBelow", "Table: Insert Row Below", insertRowBelow),
  tableColumnLeft: formatCommand("tableColumnLeft", "Table: Insert Column Left", insertColumnLeft),
  tableColumnRight: formatCommand("tableColumnRight", "Table: Insert Column Right", insertColumnRight),
  tableDeleteRow: formatCommand("tableDeleteRow", "Table: Delete Row", deleteRow),
  tableDeleteColumn: formatCommand("tableDeleteColumn", "Table: Delete Column", deleteColumn),
  tableAlignLeft: formatCommand("tableAlignLeft", "Table: Align Column Left", alignColumn("left")),
  tableAlignCenter: formatCommand("tableAlignCenter", "Table: Align Column Center", alignColumn("center")),
  tableAlignRight: formatCommand("tableAlignRight", "Table: Align Column Right", alignColumn("right")),
  tableMoveColumnLeft: formatCommand("tableMoveColumnLeft", "Table: Move Column Left", moveColumn(-1)),
  tableMoveColumnRight: formatCommand("tableMoveColumnRight", "Table: Move Column Right", moveColumn(1)),
  gitNextChange: formatCommand("gitNextChange", "Go to Next Change (Git)", nextChange, "Alt+F5"),
  gitPreviousChange: formatCommand("gitPreviousChange", "Go to Previous Change (Git)", previousChange, "Shift+Alt+F5"),
  gitShowChange: formatCommand("gitShowChange", "Show Change Since Last Commit", showChangeAtCursor),
  gitRevertChange: formatCommand("gitRevertChange", "Revert Change to Last Commit", revertChangeAtCursor),
  numberHeadings: formatCommand("numberHeadings", "Number Headings", numberHeadingsCommand),
  removeHeadingNumbers: formatCommand("removeHeadingNumbers", "Remove Heading Numbers", removeHeadingNumbersCommand),
  toc: formatCommand("toc", "Insert / Update Table of Contents", insertOrUpdateToc),
  horizontalRule: formatCommand("horizontalRule", "Horizontal Rule", fmt.insertHorizontalRule),
};
const VIEW_ORDER: ViewMode[] = ["split", "editor", "preview"];

export const commands: Record<string, Command> = {
  newFile: { id: "newFile", label: "New File", shortcut: "Mod+N", run: () => void newDocument() },
  newFromTemplate: { id: "newFromTemplate", label: "New from Template…", run: () => useUi.getState().openTemplatePicker() },
  newFileInWorkspace: {
    id: "newFileInWorkspace",
    label: "New File in Folder…",
    run: () => {
      const root = useWorkspace.getState().root;
      if (root) return createFileIn(root);
    },
    enabled: () => !!useWorkspace.getState().root,
  },
  openFile: { id: "openFile", label: "Open File…", shortcut: "Mod+O", run: openFileDialog },
  openFolder: { id: "openFolder", label: "Open Folder…", shortcut: "Mod+Shift+O", run: openFolderDialog },
  goToFile: {
    id: "goToFile",
    label: "Go to File…",
    shortcut: "Mod+Alt+O",
    run: () => useUi.getState().openFilePicker(),
    enabled: () => !!useWorkspace.getState().root,
  },
  renameFile: {
    id: "renameFile",
    label: "Rename File…",
    run: async () => {
      const doc = activeDoc();
      if (doc) await (await import("./pathActions")).renameDocument(doc.id);
    },
    enabled: () => !!activeDoc()?.path,
  },
  compareWithFile: {
    id: "compareWithFile",
    label: "Compare with File…",
    run: () => useUi.getState().openComparePicker(),
    enabled: () => hasActive() && !!useWorkspace.getState().root,
  },
  nextProblem: {
    id: "nextProblem",
    label: "Go to Next Problem",
    shortcut: "F8",
    run: () => withEditor(nextDiagnostic),
    enabled: hasActive,
  },
  previousProblem: {
    id: "previousProblem",
    label: "Go to Previous Problem",
    shortcut: "Shift+F8",
    run: () => withEditor(previousDiagnostic),
    enabled: hasActive,
  },
  goToHeading: {
    id: "goToHeading",
    label: "Go to Heading…",
    shortcut: "Mod+Alt+H",
    run: () => useUi.getState().openHeadingPicker(),
    enabled: hasActive,
  },
  goToFolderHeading: {
    id: "goToFolderHeading",
    label: "Go to Heading in Folder…",
    shortcut: "Mod+Shift+Alt+H",
    run: () => useUi.getState().openFolderHeadingPicker(),
    enabled: () => !!useWorkspace.getState().root,
  },
  clearRecent: {
    id: "clearRecent",
    label: "Clear Recent",
    run: async () => (await import("./recent")).clearRecent(),
  },
  closeFolder: {
    id: "closeFolder",
    label: "Close Folder",
    run: closeWorkspace,
    enabled: () => !!useWorkspace.getState().root,
  },
  save: {
    id: "save",
    label: "Save",
    shortcut: "Mod+S",
    run: async () => {
      const d = activeDoc();
      if (d) await saveDocument(d.id);
    },
    enabled: hasActive,
  },
  saveAs: {
    id: "saveAs",
    label: "Save As…",
    shortcut: "Mod+Shift+S",
    run: async () => {
      const d = activeDoc();
      if (d) await saveDocument(d.id, { saveAs: true });
    },
    enabled: hasActive,
  },
  saveAll: { id: "saveAll", label: "Save All", shortcut: "Mod+Alt+S", run: async () => void (await saveAll()) },
  fileHistory: {
    id: "fileHistory",
    label: "File History…",
    run: () => {
      const d = activeDoc();
      if (d?.path) useUi.getState().setHistoryDocId(d.id);
    },
    enabled: () => !!activeDoc()?.path,
  },
  importDocx: { id: "importDocx", label: "Import Word Document (.docx)…", run: async () => (await importing()).importDocument("docx") },
  importPdf: { id: "importPdf", label: "Import PDF (.pdf)…", run: async () => (await importing()).importDocument("pdf") },
  importCsv: { id: "importCsv", label: "Import CSV as Table…", run: async () => (await importing()).importDocument("csv") },
  insertImage: {
    id: "insertImage",
    label: "Insert Image…",
    run: async () => (await import("./images")).insertImageFromFile(),
    enabled: hasActive,
  },
  copyTableCsv: {
    id: "copyTableCsv",
    label: "Copy Table as CSV",
    run: async () => (await import("./tableCsv")).copyTableAsCsv(),
    enabled: hasActive,
  },
  convertFolder: {
    id: "convertFolder",
    label: "Convert Folder to Markdown…",
    run: async () => void (await (await import("./batchConvert")).convertWorkspaceDocuments()),
    enabled: () => !!useWorkspace.getState().root,
  },
  combineFolder: {
    id: "combineFolder",
    label: "Combine Folder into One Document…",
    run: async () => void (await (await import("./combine")).combineWorkspace()),
    enabled: () => !!useWorkspace.getState().root,
  },
  exportFolderHtml: {
    id: "exportFolderHtml",
    label: "Export Folder as HTML Site…",
    run: async () => (await import("./siteExport")).exportFolderAsHtmlSite(),
    enabled: () => !!useWorkspace.getState().root,
  },
  exportFolderPdf: {
    id: "exportFolderPdf",
    label: "Export Folder as One PDF…",
    run: async () => (await exporting()).exportFolder("pdf"),
    enabled: () => !!useWorkspace.getState().root,
  },
  exportFolderDocx: {
    id: "exportFolderDocx",
    label: "Export Folder as One Word Document…",
    run: async () => (await exporting()).exportFolder("docx"),
    enabled: () => !!useWorkspace.getState().root,
  },
  importHtml: { id: "importHtml", label: "Import Web Page (.html)…", run: async () => (await importing()).importDocument("html") },
  exportHtml: { id: "exportHtml", label: "Export as HTML…", run: async () => (await exporting()).exportActiveAsHtml(), enabled: hasActive },
  exportPdf: { id: "exportPdf", label: "Export as PDF…", run: async () => (await exporting()).exportActiveAsPdf(), enabled: hasActive },
  exportDocx: { id: "exportDocx", label: "Export as Word (.docx)…", run: async () => (await exporting()).exportActiveAsDocx(), enabled: hasActive },
  moveToNewFile: {
    id: "moveToNewFile",
    label: "Move Selection to New File…",
    run: async () => (await import("./extractFile")).moveSelectionToNewFile(),
    enabled: hasActive,
  },
  exportZip: {
    id: "exportZip",
    label: "Export as Markdown with Images (.zip)…",
    run: async () => (await import("./exportZip")).exportActiveAsZip(),
    enabled: hasActive,
  },
  copyPlainText: { id: "copyPlainText", label: "Copy as Plain Text", run: async () => (await exporting()).copyActiveAsPlainText(), enabled: hasActive },
  copyHtml: { id: "copyHtml", label: "Copy as HTML", run: async () => (await exporting()).copyActiveAsHtml(), enabled: hasActive },
  copyFormatted: { id: "copyFormatted", label: "Copy as Formatted Text", run: async () => (await exporting()).copyActiveAsFormattedText(), enabled: hasActive },
  printSlides: { id: "printSlides", label: "Print Slides…", run: async () => (await exporting()).printSlides(), enabled: hasActive },
  print: { id: "print", label: "Print / Save as PDF…", shortcut: "Mod+P", run: async () => (await exporting()).printActive(), enabled: hasActive },
  reopenClosedTab: {
    id: "reopenClosedTab",
    label: "Reopen Closed Tab",
    shortcut: "Mod+Shift+T",
    run: () => void reopenClosedDocument(),
    enabled: hasClosedDocuments,
  },
  closeTab: {
    id: "closeTab",
    label: "Close Tab",
    shortcut: "Mod+W",
    run: async () => {
      const d = activeDoc();
      if (d) await closeDocument(d.id);
    },
    enabled: hasActive,
  },
  nextTab: { id: "nextTab", label: "Next Tab", shortcut: "Ctrl+Tab", run: () => useDocuments.getState().cycle(1) },
  prevTab: { id: "prevTab", label: "Previous Tab", shortcut: "Ctrl+Shift+Tab", run: () => useDocuments.getState().cycle(-1) },

  undo: { id: "undo", label: "Undo", shortcut: "Mod+Z", run: () => editorCommand("undo"), enabled: hasActive },
  redo: { id: "redo", label: "Redo", shortcut: isMac ? "Mod+Shift+Z" : "Mod+Y", run: () => editorCommand("redo"), enabled: hasActive },
  find: { id: "find", label: "Find", shortcut: "Mod+F", run: () => (findInPreview() ? useUi.getState().setPreviewFind(true) : editorCommand("find")), enabled: hasActive },
  replace: { id: "replace", label: "Replace", shortcut: isMac ? "Mod+Alt+F" : "Mod+H", run: () => editorCommand("replace"), enabled: hasActive },
  gotoLine: { id: "gotoLine", label: "Go to Line…", shortcut: "Mod+G", run: () => editorCommand("gotoLine"), enabled: hasActive },
  selectAll: { id: "selectAll", label: "Select All", shortcut: "Mod+A", run: () => editorCommand("selectAll"), enabled: hasActive },
  fixAllProblems: formatCommand("fixAllProblems", "Fix All Problems", fixAllProblemsCommand),
  sortLinesAsc: formatCommand("sortLinesAsc", "Sort Lines (A to Z)", sortLines(false)),
  sortLinesDesc: formatCommand("sortLinesDesc", "Sort Lines (Z to A)", sortLines(true)),
  removeDuplicateLines: formatCommand("removeDuplicateLines", "Remove Duplicate Lines", removeDuplicateLines),
  joinLines: formatCommand("joinLines", "Join Lines", joinLines),
  upperCase: formatCommand("upperCase", "Transform to Uppercase", changeCase("upper")),
  lowerCase: formatCommand("lowerCase", "Transform to Lowercase", changeCase("lower")),
  titleCase: formatCommand("titleCase", "Transform to Title Case", changeCase("title")),
  // CodeMirror also binds these to Ctrl+Alt+[ and Ctrl+Alt+] inside the editor.
  foldAll: { id: "foldAll", label: "Fold All", run: () => editorCommand("foldAll"), enabled: hasActive },
  unfoldAll: { id: "unfoldAll", label: "Unfold All", run: () => editorCommand("unfoldAll"), enabled: hasActive },
  foldLevel1: formatCommand("foldLevel1", "Fold to Level 1", foldToLevel(1)),
  foldLevel2: formatCommand("foldLevel2", "Fold to Level 2", foldToLevel(2)),
  foldLevel3: formatCommand("foldLevel3", "Fold to Level 3", foldToLevel(3)),

  toggleView: {
    id: "toggleView",
    label: "Cycle View Mode",
    shortcut: "Mod+\\",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ viewMode: VIEW_ORDER[(VIEW_ORDER.indexOf(settings.viewMode) + 1) % VIEW_ORDER.length] });
    },
  },
  viewEditor: { id: "viewEditor", label: "Editor Only", shortcut: "Mod+1", run: () => useSettings.getState().update({ viewMode: "editor" }) },
  viewSplit: { id: "viewSplit", label: "Split View", shortcut: "Mod+2", run: () => useSettings.getState().update({ viewMode: "split" }) },
  viewPreview: { id: "viewPreview", label: "Preview Only", shortcut: "Mod+3", run: () => useSettings.getState().update({ viewMode: "preview" }) },
  toggleExplorer: {
    id: "toggleExplorer",
    label: "Toggle File Explorer",
    shortcut: "Mod+Shift+E",
    run: () => {
      const { settings, update } = useSettings.getState();
      const ui = useUi.getState();
      if (settings.showExplorer && ui.sidebarView !== "explorer") ui.setSidebarView("explorer");
      else {
        ui.setSidebarView("explorer");
        update({ showExplorer: !settings.showExplorer });
      }
    },
  },
  checkLinks: {
    id: "checkLinks",
    label: "Check Links in Folder",
    run: () => {
      useSettings.getState().update({ showExplorer: true });
      useUi.getState().checkLinks();
    },
    enabled: () => !!useWorkspace.getState().root,
  },
  findInFiles: {
    id: "findInFiles",
    label: "Find in Files",
    shortcut: "Mod+Shift+F",
    run: () => {
      useSettings.getState().update({ showExplorer: true });
      useUi.getState().focusSearch();
    },
  },
  toggleOutline: {
    id: "toggleOutline",
    label: "Toggle Outline",
    shortcut: "Mod+Shift+L",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ showOutline: !settings.showOutline, showExplorer: true });
    },
  },
  toggleTheme: {
    id: "toggleTheme",
    label: "Toggle Dark Theme",
    run: () => {
      const { update } = useSettings.getState();
      const dark = document.documentElement.dataset.theme === "dark";
      update({ theme: dark ? "light" : "dark" });
    },
  },
  zoomIn: { id: "zoomIn", label: "Increase Font Size", shortcut: "Mod+=", run: () => bumpFont(1) },
  zoomOut: { id: "zoomOut", label: "Decrease Font Size", shortcut: "Mod+-", run: () => bumpFont(-1) },
  zoomReset: { id: "zoomReset", label: "Reset Font Size", shortcut: "Mod+0", run: () => useSettings.getState().update({ fontSize: 15 }) },
  commandPalette: {
    id: "commandPalette",
    label: "Command Palette…",
    shortcut: "Mod+Shift+P",
    run: () => useUi.getState().setPaletteOpen(!useUi.getState().paletteOpen),
  },
  settings: { id: "settings", label: "Settings…", shortcut: "Mod+,", run: () => useUi.getState().setSettingsOpen(true) },
  toggleWordWrap: {
    id: "toggleWordWrap",
    label: "Toggle Word Wrap",
    shortcut: "Alt+Z",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ lineWrapping: !settings.lineWrapping });
    },
  },
  toggleTypewriter: {
    id: "toggleTypewriter",
    label: "Toggle Typewriter Scrolling",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ typewriterScrolling: !settings.typewriterScrolling });
    },
  },
  toggleDimParagraphs: {
    id: "toggleDimParagraphs",
    label: "Toggle Dim Other Paragraphs",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ dimOtherParagraphs: !settings.dimOtherParagraphs });
    },
  },
  toggleLineNumbers: {
    id: "toggleLineNumbers",
    label: "Toggle Line Numbers",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ lineNumbers: !settings.lineNumbers });
    },
  },
  toggleToolbar: {
    id: "toggleToolbar",
    label: "Toggle Formatting Toolbar",
    run: () => {
      const { settings, update } = useSettings.getState();
      update({ showToolbar: !settings.showToolbar });
    },
  },
  toggleReadOnly: {
    id: "toggleReadOnly",
    label: "Toggle Read-Only",
    run: () => {
      const doc = activeDoc();
      if (doc) setReadOnly(doc.id, !doc.readOnly);
    },
    enabled: hasActive,
  },
  presentSlides: {
    id: "presentSlides",
    label: "Present as Slides",
    run: () => useUi.getState().setPresenting(true),
    enabled: hasActive,
  },
  focusMode: {
    id: "focusMode",
    label: "Toggle Focus Mode",
    shortcut: "Mod+Shift+Enter",
    run: () => {
      const ui = useUi.getState();
      ui.setFocusMode(!ui.focusMode);
    },
  },
  fullScreen: { id: "fullScreen", label: "Toggle Full Screen", shortcut: "F11", run: () => toggleFullScreen() },
  shortcuts: { id: "shortcuts", label: "Keyboard Shortcuts", run: () => useUi.getState().setShortcutsOpen(true) },
  checkUpdates: {
    id: "checkUpdates",
    label: "Check for Updates…",
    run: async () => void (await (await import("./updates")).checkForUpdates({ manual: true })),
  },
  aiImprove: { id: "aiImprove", label: "AI: Improve Writing", run: async () => (await ai()).runAiAction("improve"), enabled: hasActive },
  aiFixGrammar: { id: "aiFixGrammar", label: "AI: Fix Spelling and Grammar", run: async () => (await ai()).runAiAction("fixGrammar"), enabled: hasActive },
  aiShorter: { id: "aiShorter", label: "AI: Make Shorter", run: async () => (await ai()).runAiAction("shorter"), enabled: hasActive },
  aiSummarize: { id: "aiSummarize", label: "AI: Summarize", run: async () => (await ai()).runAiAction("summarize"), enabled: hasActive },
  aiContinue: { id: "aiContinue", label: "AI: Continue Writing", run: async () => (await ai()).runAiAction("continue"), enabled: hasActive },
  aiTranslate: { id: "aiTranslate", label: "AI: Translate…", run: async () => (await ai()).runAiAction("translate"), enabled: hasActive },
  aiWrite: { id: "aiWrite", label: "AI: Write…", shortcut: "Mod+Shift+J", run: async () => (await ai()).runAiAction("write"), enabled: hasActive },
  aiAsk: { id: "aiAsk", label: "AI: Ask Claude…", shortcut: "Mod+J", run: async () => (await ai()).runAiAction("ask"), enabled: hasActive },
  about: { id: "about", label: "About Markpion", run: () => useUi.getState().setAboutOpen(true) },
  exportLogs: {
    id: "exportLogs",
    label: "Export Diagnostic Logs…",
    run: async () => {
      try {
        const path = await backend().exportLogs();
        if (path) notify("success", "Diagnostic logs exported.");
      } catch (e) {
        notify("error", `Couldn't export logs: ${(e as Error).message}`);
      }
    },
  },
};

Object.assign(commands, formatCommands);

/** CodeMirror keymap for editor commands, derived from the shortcuts above. */
export function editorKeymap(): KeyBinding[] {
  const toKey = (shortcut: string) => shortcut.replace(/\+/g, "-").replace(/-([A-Z])$/, (_, k: string) => "-" + k.toLowerCase());
  const format = Object.values(formatCommands)
    .filter((c) => c.shortcut && c.editor)
    .map((c) => ({ key: toKey(c.shortcut!), run: c.editor!, preventDefault: true }));
  // App shortcuts CodeMirror would otherwise capture: some keyboards/IMEs report
  // Ctrl+Shift+F as a lowercase "f", which CodeMirror treats as Mod-f (find).
  const app = {
    any: (_view: unknown, e: KeyboardEvent) => {
      if (eventToShortcut(e) !== commands.findInFiles.shortcut) return false;
      e.preventDefault();
      void commands.findInFiles.run();
      return true;
    },
  };
  return [app, ...format];
}

const toggleFullScreen = () => backend().toggleFullScreen();

function bumpFont(delta: number) {
  const { settings, update } = useSettings.getState();
  update({ fontSize: settings.fontSize + delta });
}

/** Human-readable shortcut for menus and tooltips. */
export function formatShortcut(shortcut?: string): string {
  if (!shortcut) return "";
  if (isMac) {
    return shortcut
      .replace("Mod+", "⌘")
      .replace("Ctrl+", "⌃")
      .replace("Shift+", "⇧")
      .replace("Alt+", "⌥");
  }
  return shortcut.replace("Mod+", "Ctrl+");
}

/** Normalizes a keyboard event to the shortcut format used above. */
export function eventToShortcut(e: KeyboardEvent): string {
  const parts: string[] = [];
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod) parts.push("Mod");
  if (isMac && e.ctrlKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let key = e.key;
  if (key === "+") key = "=";
  if (key.length === 1) key = key.toUpperCase();
  // With Shift held, some layouts report the shifted symbol; use the code instead.
  if (e.code?.startsWith("Digit")) key = e.code.slice(5);
  if (e.code === "Backslash") key = "\\";
  if (e.code === "Comma") key = ",";
  if (e.code === "Period") key = ".";
  if (e.code === "Equal") key = "=";
  if (e.code === "Minus") key = "-";
  if (e.code?.startsWith("Key") && (e.altKey || e.shiftKey)) key = e.code.slice(3);
  parts.push(key);
  return parts.join("+");
}

/** Shortcuts handled by the editor itself when it has focus. */
/** Find searches the preview when it's shown alone or has focus. */
function findInPreview(): boolean {
  return useSettings.getState().settings.viewMode === "preview" || !!document.activeElement?.closest(".preview, .preview-find");
}

const EDITOR_OWNED = new Set(["undo", "redo", "selectAll", "find", "replace", "gotoLine"]);

/** "Ctrl+Tab" on Windows/Linux is "Mod+Tab" after normalization. */
const normalizeShortcut = (shortcut: string) => (!isMac ? shortcut.replace(/^Ctrl\+/, "Mod+") : shortcut);

function buildShortcutMap() {
  const map = new Map<string, Command>();
  for (const c of Object.values(commands)) if (c.shortcut) map.set(normalizeShortcut(c.shortcut), c);
  return map;
}
let byShortcut = buildShortcutMap();

/** Each command's built-in shortcut, before the user's changes. */
const DEFAULT_SHORTCUTS = new Map(Object.values(commands).map((c) => [c.id, c.shortcut] as const));

export function defaultShortcut(id: string): string | undefined {
  return DEFAULT_SHORTCUTS.get(id);
}

/**
 * Applies the user's shortcuts (Settings `keybindings`: command id → shortcut,
 * or `null` for none) over the built-in ones. Menus, the command palette and
 * the global and editor key handling all read `command.shortcut`.
 */
export function applyKeybindings(overrides: Record<string, string | null>) {
  for (const c of Object.values(commands)) {
    const id = c.id;
    c.shortcut = Object.hasOwn(overrides, id) ? (overrides[id] ?? undefined) : DEFAULT_SHORTCUTS.get(id);
  }
  byShortcut = buildShortcutMap();
}

/** The command that already uses a shortcut, if any (besides `exceptId`). */
export function commandWithShortcut(shortcut: string, exceptId?: string): Command | undefined {
  const c = byShortcut.get(normalizeShortcut(shortcut));
  return c && c.id !== exceptId ? c : undefined;
}

export function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;
  if (e.key === "Escape" && useUi.getState().focusMode && useUi.getState().dialogs.length === 0) {
    useUi.getState().setFocusMode(false);
    return;
  }
  const shortcut = eventToShortcut(e);
  const cmd = shortcut === "F1" ? commands.commandPalette : byShortcut.get(shortcut);
  if (!cmd) return;
  const inEditor = (e.target as HTMLElement | null)?.closest?.(".cm-editor");
  if ((EDITOR_OWNED.has(cmd.id) || cmd.editor) && inEditor) return;
  // Leave clipboard/undo shortcuts alone inside ordinary text fields.
  const inField = (e.target as HTMLElement | null)?.closest?.("input, textarea, select");
  if (inField && ["undo", "redo", "selectAll"].includes(cmd.id)) return;
  if (useUi.getState().dialogs.length > 0) return;
  if (cmd.enabled && !cmd.enabled()) return;
  e.preventDefault();
  void cmd.run();
}
