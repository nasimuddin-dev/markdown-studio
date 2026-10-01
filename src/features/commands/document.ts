import { nextDiagnostic, previousDiagnostic } from "@codemirror/lint";
import { activeDoc, useDocuments } from "../../stores/documentsStore";
import { useSettings } from "../../stores/settingsStore";
import { promptText, useUi } from "../../stores/uiStore";
import { useWorkspace } from "../../stores/workspaceStore";
import { closeDocument, hasClosedDocuments, newDocument, openFileDialog, reopenClosedDocument, saveAll, saveDocument } from "../documents";
import { closeWorkspace, createFileIn, openFolderDialog } from "../workspace";
import { getEditorView, runOnEditor } from "../editorBridge";
import { currentHeadingIndex, extractHeadings, headingSlugs } from "../outline";
import * as fmt from "../formatting";
import { focusPane } from "../panes";
import { selectSection } from "../sections";
import { formatCommand, hasActive, withEditor, type Command } from "./core";

// Export/print pull in the unified pipeline; load them on first use.
const exporting = () => import("../exporting");
const importing = () => import("../importing");

/** Files and folders, saving, import and export, navigation and tabs. */
export const documentCommands: Record<string, Command> = {
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
      if (doc) await (await import("../pathActions")).renameDocument(doc.id);
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
  goToTag: {
    id: "goToTag",
    label: "Go to Tag…",
    run: () => useUi.getState().openTagPicker(),
    enabled: () => !!useWorkspace.getState().root,
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
    run: async () => (await import("../recent")).clearRecent(),
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
  importEpub: { id: "importEpub", label: "Import E-book (.epub)…", run: async () => (await importing()).importDocument("epub") },
  insertImage: {
    id: "insertImage",
    label: "Insert Image…",
    run: async () => (await import("../images")).insertImageFromFile(),
    enabled: hasActive,
  },
  copyTableCsv: {
    id: "copyTableCsv",
    label: "Copy Table as CSV",
    run: async () => (await import("../tableCsv")).copyTableAsCsv(),
    enabled: hasActive,
  },
  convertFolder: {
    id: "convertFolder",
    label: "Convert Folder to Markdown…",
    run: async () => void (await (await import("../batchConvert")).convertWorkspaceDocuments()),
    enabled: () => !!useWorkspace.getState().root,
  },
  combineFolder: {
    id: "combineFolder",
    label: "Combine Folder into One Document…",
    run: async () => void (await (await import("../combine")).combineWorkspace()),
    enabled: () => !!useWorkspace.getState().root,
  },
  exportFolderHtml: {
    id: "exportFolderHtml",
    label: "Export Folder as HTML Site…",
    run: async () => (await import("../siteExport")).exportFolderAsHtmlSite(),
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
  exportFolderLatex: {
    id: "exportFolderLatex",
    label: "Export Folder as One LaTeX Document…",
    run: async () => (await exporting()).exportFolder("tex"),
    enabled: () => !!useWorkspace.getState().root,
  },
  exportFolderEpub: {
    id: "exportFolderEpub",
    label: "Export Folder as One E-book (EPUB)…",
    run: async () => (await exporting()).exportFolder("epub"),
    enabled: () => !!useWorkspace.getState().root,
  },
  importHtml: { id: "importHtml", label: "Import Web Page (.html)…", run: async () => (await importing()).importDocument("html") },
  exportHtml: { id: "exportHtml", label: "Export as HTML…", run: async () => (await exporting()).exportActiveAsHtml(), enabled: hasActive },
  exportPdf: { id: "exportPdf", label: "Export as PDF…", run: async () => (await exporting()).exportActiveAsPdf(), enabled: hasActive },
  exportDocx: { id: "exportDocx", label: "Export as Word (.docx)…", run: async () => (await exporting()).exportActiveAsDocx(), enabled: hasActive },
  nextPane: { id: "nextPane", label: "Focus Next Pane", shortcut: "F6", run: () => void focusPane(1) },
  previousPane: { id: "previousPane", label: "Focus Previous Pane", shortcut: "Shift+F6", run: () => void focusPane(-1) },
  todaysNote: {
    id: "todaysNote",
    label: "Open Today's Note",
    run: async () => (await import("../templates")).openTodaysNote(),
  },
  saveAsTemplate: {
    id: "saveAsTemplate",
    label: "Save as Template…",
    run: async () => (await import("../templates")).saveAsTemplate(),
    enabled: hasActive,
  },
  showInExplorer: {
    id: "showInExplorer",
    label: "Show Active File in Explorer",
    run: async () => {
      const path = useDocuments.getState().docs.find((d) => d.id === useDocuments.getState().activeId)?.path;
      if (!path || !(await (await import("../workspace")).showInExplorer(path))) useUi.getState().notify("info", "The active file isn't in the open folder.");
    },
    enabled: hasActive,
  },
  copyHeadingLink: {
    id: "copyHeadingLink",
    label: "Copy Link to Current Heading",
    run: async () => {
      const view = getEditorView();
      const text = view?.state.doc.toString() ?? activeDoc()?.content ?? "";
      const headings = extractHeadings(text);
      const i = currentHeadingIndex(headings, view ? view.state.doc.lineAt(view.state.selection.main.head).number : 1);
      if (i < 0) {
        useUi.getState().notify("info", "The cursor isn't under a heading.");
        return;
      }
      const { copyText } = await import("../pathActions");
      await copyText(`#${headingSlugs(headings)[i]}`, "Link");
    },
    enabled: hasActive,
  },
  wordGoal: {
    id: "wordGoal",
    label: "Set Word Count Goal…",
    run: async () => {
      const doc = activeDoc();
      if (!doc) return;
      if (!doc.path) {
        useUi.getState().notify("info", "Save the document first; the goal is kept for its file.");
        return;
      }
      const { settings, update } = useSettings.getState();
      const current = settings.wordGoals[doc.path];
      const value = await promptText({ title: "Word Count Goal", message: "How many words is this document aiming for? Enter 0 to remove the goal.", value: current ? String(current) : "1000" });
      if (value === null) return;
      const goals = { ...settings.wordGoals };
      const n = Number(value.replace(/[\s,._]/g, ""));
      if (n === 0) delete goals[doc.path];
      else if (Number.isInteger(n) && n >= 1 && n <= 1_000_000) goals[doc.path] = n;
      else {
        useUi.getState().notify("info", "Enter a whole number of words, from 1 to 1,000,000 (or 0 to remove the goal).");
        return;
      }
      update({ wordGoals: goals });
    },
    enabled: hasActive,
  },
  selectSection: formatCommand("selectSection", "Select Section", selectSection),
  frontMatter: {
    id: "frontMatter",
    label: "Insert Front Matter",
    run: () => runOnEditor(fmt.insertFrontMatter(activeDoc()?.name.replace(/\.(md|markdown)$/i, "") ?? "Untitled")),
    enabled: hasActive,
  },
  insertSnippet: { id: "insertSnippet", label: "Insert Snippet…", run: () => useUi.getState().openSnippetPicker(), enabled: hasActive },
  closeAllTabs: { id: "closeAllTabs", label: "Close All Tabs", run: async () => (await import("../pathActions")).closeAllTabs(), enabled: hasActive },
  moveToNewFile: {
    id: "moveToNewFile",
    label: "Move Selection to New File…",
    run: async () => (await import("../extractFile")).moveSelectionToNewFile(),
    enabled: hasActive,
  },
  lineEndingsLf: {
    id: "lineEndingsLf",
    label: "Change Line Endings to LF",
    run: async () => (await import("../lineEndings")).setLineEnding("lf"),
    enabled: hasActive,
  },
  lineEndingsCrlf: {
    id: "lineEndingsCrlf",
    label: "Change Line Endings to CRLF",
    run: async () => (await import("../lineEndings")).setLineEnding("crlf"),
    enabled: hasActive,
  },
  encodingUtf8: {
    id: "encodingUtf8",
    label: "Change Encoding to UTF-8",
    run: async () => (await import("../lineEndings")).setBom(false),
    enabled: hasActive,
  },
  encodingUtf8Bom: {
    id: "encodingUtf8Bom",
    label: "Change Encoding to UTF-8 with BOM",
    run: async () => (await import("../lineEndings")).setBom(true),
    enabled: hasActive,
  },
  exportLatex: { id: "exportLatex", label: "Export as LaTeX (.tex)…", run: async () => (await exporting()).exportActiveAsLatex(), enabled: hasActive },
  exportEpub: {
    id: "exportEpub",
    label: "Export as EPUB (E-book)…",
    run: async () => (await exporting()).exportActiveAsEpub(),
    enabled: hasActive,
  },
  exportZip: {
    id: "exportZip",
    label: "Export as Markdown with Images (.zip)…",
    run: async () => (await import("../exportZip")).exportActiveAsZip(),
    enabled: hasActive,
  },
  copyPlainText: { id: "copyPlainText", label: "Copy as Plain Text", run: async () => (await exporting()).copyActiveAsPlainText(), enabled: hasActive },
  copyLatex: { id: "copyLatex", label: "Copy as LaTeX", run: async () => (await exporting()).copyActiveAsLatex(), enabled: hasActive },
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
};
