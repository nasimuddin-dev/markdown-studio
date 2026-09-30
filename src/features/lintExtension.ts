import { linter, lintGutter, type Action, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { Extension, StateCommand } from "@codemirror/state";
import { backend } from "../services";
import { toAppError } from "../services/errors";
import { activeDoc } from "../stores/documentsStore";
import { notify, useUi } from "../stores/uiStore";
import { fixAllProblems, fixChanges, lintLinks, lintMarkdown, type ProblemFix } from "./lint";
import { minimalChange } from "./saveTransforms";

/** A quick fix as a lint action, applied where the problem is now. */
function fixAction(fix: ProblemFix): Action {
  return {
    name: fix.label,
    apply: (view: EditorView, from: number) => {
      const changes = fixChanges(fix, from, view.state.doc.toString());
      const last = changes[changes.length - 1];
      view.dispatch({ changes, selection: { anchor: last.from + last.insert.length }, scrollIntoView: true, userEvent: "input.fix" });
      view.focus();
    },
  };
}

/** Existence check for link targets; `null` when the path can't be checked. */
async function exists(path: string): Promise<boolean | null> {
  try {
    return (await backend().fileMtime(path)) !== null;
  } catch (e) {
    // A missing parent folder is still a broken link; out-of-scope paths are unknown.
    return toAppError(e).kind === "notFound" ? false : null;
  }
}

/** Markdown lint as CodeMirror diagnostics (underlines, gutter, Problems panel). */
export function markdownLinter(): Extension {
  return [
    linter(
      async (view) => {
        const text = view.state.doc.toString();
        const doc = activeDoc();
        const problems = [...lintMarkdown(text), ...(await lintLinks(text, doc?.path ?? null, exists))];
        const len = view.state.doc.length;
        const diagnostics: Diagnostic[] = problems.map((p) => ({
          from: Math.min(p.from, len),
          to: Math.min(p.to, len),
          severity: p.severity,
          message: p.message,
          source: p.rule,
          ...(p.fix && { actions: [fixAction(p.fix)] }),
        }));
        useUi.getState().setProblems({
          errors: problems.filter((p) => p.severity === "error").length,
          warnings: problems.filter((p) => p.severity === "warning").length,
          infos: problems.filter((p) => p.severity === "info").length,
        });
        return diagnostics;
      },
      { delay: 700 },
    ),
    lintGutter(),
  ];
}

/** Command: applies every safe quick fix in the document as one undoable edit. */
export const fixAllProblemsCommand: StateCommand = ({ state, dispatch }) => {
  const before = state.doc.toString();
  const { text, fixed } = fixAllProblems(before);
  const change = fixed ? minimalChange(before, text) : null;
  if (!change) {
    notify("info", "No problems with a quick fix in this document.");
    return false;
  }
  dispatch(state.update({ changes: change, userEvent: "input.fix" }));
  notify("success", `Fixed ${fixed} problem${fixed === 1 ? "" : "s"}. Undo reverses them.`);
  return true;
};
