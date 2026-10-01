import { useSettings } from "../../stores/settingsStore";
import { useUi } from "../../stores/uiStore";
import { editorCommand } from "../editorBridge";
import { fixAllProblemsCommand } from "../lintExtension";
import { foldToLevel } from "../foldLevel";
import { changeCase, joinLines, removeDuplicateLines, sortLines } from "../textTransforms";
import { formatCommand, hasActive, isMac, type Command } from "./core";

/** Find searches the preview when it's shown alone or has focus. */
function findInPreview(): boolean {
  return useSettings.getState().settings.viewMode === "preview" || !!document.activeElement?.closest(".preview, .preview-find");
}

/** Undo and redo, find and replace, line tools and folding. */
export const editCommands: Record<string, Command> = {
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
};
