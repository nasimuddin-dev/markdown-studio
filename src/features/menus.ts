import { commands } from "./commands";

/**
 * The application menus: one model used by the in-app menu bar (Windows,
 * Linux, browser), the native menu bar (macOS) and the command palette
 * (which shows where each command lives). Long menus are grouped into
 * submenus, one level deep.
 */
export type CommandId = keyof typeof commands;

export type MenuItem =
  /** A command; `label` shortens it here (the palette keeps the full label). */
  | { type: "command"; id: CommandId; label?: string }
  | { type: "separator" }
  | { type: "submenu"; label: string; items: MenuItem[] }
  /** Placeholder for the recent files and folders (in-app menus only). */
  | { type: "recent" };

export interface MenuDef {
  label: string;
  items: MenuItem[];
}

const c = (id: CommandId, label?: string): MenuItem => ({ type: "command", id, label });
const sep: MenuItem = { type: "separator" };
const sub = (label: string, items: MenuItem[]): MenuItem => ({ type: "submenu", label, items });

export const MENUS: MenuDef[] = [
  {
    label: "File",
    items: [
      c("newFile"), c("newFromTemplate"), c("todaysNote"), c("newFileInWorkspace"), sep,
      c("openFile"), c("openFolder"), c("goToFile"),
      sub("Open Recent", [{ type: "recent" }, sep, c("clearRecent")]), sep,
      c("save"), c("saveAs"), c("saveAll"), c("renameFile"), c("moveToNewFile"), c("saveAsTemplate"), sep,
      c("fileHistory"), c("compareWithFile"), sep,
      sub("Import", [
        c("importDocx", "Word Document (.docx)…"), c("importPdf", "PDF (.pdf)…"), c("importHtml", "Web Page (.html)…"), c("importCsv", "CSV as Table…"), sep,
        c("convertFolder"),
      ]),
      sub("Export", [
        c("exportPdf", "PDF…"), c("exportDocx", "Word (.docx)…"), c("exportHtml", "HTML…"), c("exportEpub", "EPUB (E-book)…"), c("exportZip", "Markdown with Images (.zip)…"), sep,
        c("combineFolder"), c("exportFolderPdf"), c("exportFolderDocx"), c("exportFolderHtml"),
      ]),
      sub("Copy As", [c("copyFormatted", "Formatted Text"), c("copyPlainText", "Plain Text"), c("copyHtml", "HTML")]),
      c("print"), sep,
      c("closeTab"), c("closeAllTabs"), c("reopenClosedTab"), c("closeFolder"), sep,
      c("settings"),
    ],
  },
  {
    label: "Edit",
    items: [
      c("undo"), c("redo"), sep,
      c("find"), c("replace"), c("findInFiles"), sep,
      sub("Go To", [c("gotoLine", "Line…"), c("goToHeading", "Heading…"), c("goToFolderHeading", "Heading in Folder…"), c("goToTag", "Tag…"), sep, c("nextProblem", "Next Problem"), c("previousProblem", "Previous Problem")]),
      c("checkLinks"), c("fixAllProblems"), c("renameTag"), sep,
      sub("Git Changes", [c("gitNextChange", "Next Change"), c("gitPreviousChange", "Previous Change"), sep, c("gitShowChange"), c("gitRevertChange")]), sep,
      c("selectAll"), c("selectSection"),
      sub("Lines", [c("sortLinesAsc"), c("sortLinesDesc"), c("removeDuplicateLines"), c("joinLines"), sep, c("reflowParagraph"), c("unwrapParagraph")]),
      sub("Change Case", [c("upperCase", "UPPERCASE"), c("lowerCase", "lowercase"), c("titleCase", "Title Case")]),
    ],
  },
  {
    label: "Format",
    items: [
      c("bold"), c("italic"), c("strikethrough"), c("inlineCode"), sep,
      c("link"), c("removeLink"), c("insertImage"),
      sub("Link Style", [c("referenceLinks", "Reference Links"), c("inlineLinks", "Inline Links")]), sep,
      sub("Heading", [
        c("paragraph"), c("heading1"), c("heading2"), c("heading3"), c("heading4"), c("heading5"), c("heading6"), sep,
        c("promoteHeading"), c("demoteHeading"), c("renameHeading"), sep,
        c("moveSectionUp"), c("moveSectionDown"), sep,
        c("numberHeadings"), c("removeHeadingNumbers"),
      ]),
      c("bulletList"), c("orderedList"), c("taskList"), c("toggleTaskCheck"), c("quote"),
      sub("Callout", [c("calloutNote", "Note"), c("calloutTip", "Tip"), c("calloutImportant", "Important"), c("calloutWarning", "Warning"), c("calloutCaution", "Caution")]), sep,
      c("codeBlock"),
      sub("Math", [c("inlineMath"), c("mathBlock", "Math Block")]),
      sub("Diagram", [c("diagramFlowchart", "Flowchart"), c("diagramSequence", "Sequence Diagram"), c("diagramGantt", "Gantt Chart"), c("diagramPie", "Pie Chart")]),
      sub("Insert", [c("horizontalRule"), c("footnote", "Footnote"), c("insertDate", "Date"), c("insertDateTime", "Date and Time"), c("insertSnippet", "Snippet…"), c("frontMatter", "Front Matter")]),
      c("toggleComment"), sep,
      c("toc"),
    ],
  },
  {
    label: "Table",
    items: [
      c("table"), c("fixTable"), c("convertToTable"), c("formatTable"), sep,
      c("tableRowAbove"), c("tableRowBelow"), c("tableDeleteRow"), sep,
      c("tableColumnLeft"), c("tableColumnRight"), c("tableDeleteColumn"), c("tableMoveColumnLeft"), c("tableMoveColumnRight"), sep,
      c("tableAlignLeft"), c("tableAlignCenter"), c("tableAlignRight"), sep,
      c("sortTableAsc"), c("sortTableDesc"), sep,
      c("importCsv"), c("copyTableCsv"),
    ],
  },
  {
    label: "View",
    items: [
      c("viewEditor"), c("viewSplit"), c("viewPreview"), c("toggleView"), sep,
      c("commandPalette"), sep,
      c("toggleExplorer", "File Explorer"), c("toggleOutline", "Outline"), c("toggleToolbar", "Formatting Toolbar"), c("toggleBreadcrumbs", "Breadcrumbs"), c("toggleTheme", "Dark Theme"),
      sub("Editor", [c("toggleWordWrap", "Word Wrap"), c("toggleLineNumbers", "Line Numbers"), c("toggleTypewriter", "Typewriter Scrolling"), c("toggleDimParagraphs", "Dim Other Paragraphs"), c("toggleReadOnly", "Read-Only")]),
      sub("Fold", [c("foldAll"), c("unfoldAll"), sep, c("foldLevel1"), c("foldLevel2"), c("foldLevel3")]),
      sub("Font Size", [c("zoomIn", "Increase"), c("zoomOut", "Decrease"), c("zoomReset", "Reset")]), sep,
      c("focusMode", "Focus Mode"), c("fullScreen", "Full Screen"),
      sub("Slides", [c("presentSlides"), c("printSlides")]), sep,
      c("nextTab"), c("prevTab"),
    ],
  },
  {
    label: "AI",
    items: [c("aiImprove"), c("aiFixGrammar"), c("aiShorter"), sep, c("aiSummarize"), c("aiContinue"), c("aiTranslate"), sep, c("aiWrite"), c("aiAsk")],
  },
  { label: "Help", items: [c("shortcuts"), c("commandPalette"), sep, c("exportLogs"), c("checkUpdates"), c("about")] },
];

/**
 * A command's label in a menu: an explicit short label, or the command label
 * without a prefix the menu already says ("Table: ", "AI: ").
 */
export function menuLabel(item: Extract<MenuItem, { type: "command" }>, menu: string): string {
  if (item.label) return item.label;
  const label = commands[item.id].label;
  const prefix = `${menu}: `;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

/** Where each command lives, like "Format › Heading", for the command palette. The first place wins. */
export function commandLocations(menus: MenuDef[] = MENUS): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (items: MenuItem[], path: string) => {
    for (const item of items) {
      if (item.type === "command" && !out.has(item.id)) out.set(item.id, path);
      else if (item.type === "submenu") walk(item.items, `${path} › ${item.label}`);
    }
  };
  for (const m of menus) walk(m.items, m.label);
  return out;
}
