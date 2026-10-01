import type { StateCommand } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { activeDoc } from "../../stores/documentsStore";
import { getEditorView, runOnEditor } from "../editorBridge";

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export interface Command {
  id: string;
  label: string;
  /** Normalized shortcut, e.g. "Mod+Shift+S" (Mod = Cmd on macOS, Ctrl elsewhere). */
  shortcut?: string;
  run(): void | Promise<void>;
  enabled?(): boolean;
  /** For on/off and choice commands: whether it's on now (menus show a check mark). */
  checked?(): boolean;
  /** Set for editor commands; they are also bound inside CodeMirror's keymap. */
  editor?: StateCommand;
}

export const hasActive = () => !!activeDoc();

/** Runs a CodeMirror view command on the active editor and keeps focus there. */
export function withEditor(command: (view: EditorView) => boolean) {
  const view = getEditorView();
  if (!view) return;
  command(view);
  view.focus();
}

/** A command that runs an editor command (also bound in CodeMirror's keymap when it has a shortcut). */
export function formatCommand(id: string, label: string, editor: StateCommand, shortcut?: string): Command {
  return { id, label, shortcut, editor, run: () => runOnEditor(editor), enabled: hasActive };
}
