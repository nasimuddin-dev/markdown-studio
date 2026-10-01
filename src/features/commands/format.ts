import { toggleComment } from "@codemirror/commands";
import * as fmt from "../formatting";
import {
  alignColumn, deleteColumn, deleteRow, fixTableAtCursor, moveColumn, formatTableAtCursor, insertColumnLeft, insertColumnRight, insertRowAbove, insertRowBelow, sortTableAtCursor,
} from "../tables";
import { fillTemplate } from "../templates";
import { convertToInlineLinks, convertToReferenceLinks } from "../referenceLinks";
import { followLinkAtCursor } from "../followLink";
import { renameHeading } from "../renameHeading";
import { renameTag } from "../tags";
import { convertSelectionToTable } from "../textTransforms";
import { numberHeadingsCommand, removeHeadingNumbersCommand } from "../headingNumbers";
import { nextChange, previousChange, revertChangeAtCursor, showChangeAtCursor } from "../gitGutter";
import { insertOrUpdateToc } from "../toc";
import { moveSectionDown, moveSectionUp } from "../sections";
import { formatCommand, hasActive, type Command } from "./core";

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
  renameTag: { id: "renameTag", label: "Rename Tag…", run: () => renameTag(), enabled: hasActive },
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
