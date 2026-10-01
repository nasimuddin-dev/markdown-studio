import { linter, lintGutter, type Action, type Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import type { Extension, StateCommand } from "@codemirror/state";
import { backend } from "../services";
import { toAppError } from "../services/errors";
import { activeDoc } from "../stores/documentsStore";
import { notify, useUi } from "../stores/uiStore";
import { useSettings } from "../stores/settingsStore";
import { fixAllProblems, fixChanges, LINT_RULES, lintLinks, lintMarkdown, type ProblemFix } from "./lint";
import { minimalChange } from "./saveTransforms";
import { LARGE_DOCUMENT_CHARS } from "../services/limits";

/** Whether a document of this length is checked (very large ones aren't, to keep typing fast). */
export const lintsDocumentOf = (length: number) => length <= LARGE_DOCUMENT_CHARS;

/** Turns a check off (Settings → Editor lists it, with Show Again). */
function hideRule(rule: string): Action {
  return {
    name: "Don't Show This Check",
    apply: () => {
      const { settings, update } = useSettings.getState();
      if (!settings.lintDisabledRules.includes(rule)) update({ lintDisabledRules: [...settings.lintDisabledRules, rule] });
      notify("info", `“${LINT_RULES[rule] ?? rule}” won't be shown. Turn it back on in Settings → Editor.`);
    },
  };
}

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
/** Names of the files (documents and pictures) in a folder, or null when it can't be listed. */
async function filesIn(dir: string): Promise<string[] | null> {
  try {
    return (await backend().listDir(dir, { images: true })).filter((e) => !e.isDir).map((e) => e.name);
  } catch {
    return null;
  }
}

async function exists(path: string): Promise<boolean | null> {
  try {
    return (await backend().fileMtime(path)) !== null;
  } catch (e) {
    // A missing parent folder is still a broken link; out-of-scope paths are unknown.
    return toAppError(e).kind === "notFound" ? false : null;
  }
}

/**
 * The Problems panel puts action buttons inside its list options, but an
 * option's content is presentational, so assistive technology can't use them
 * (nested interactive controls). With the list focused, an action runs from
 * its access key, which CodeMirror handles from the diagnostic itself. So each
 * button is replaced on screen by a plain label that forwards clicks to it,
 * and the button's description ("Action: Fix Table (access key F)") becomes
 * part of the option's text.
 */
const accessiblePanelActions = EditorView.updateListener.of((update) => {
  for (const button of update.view.dom.querySelectorAll<HTMLButtonElement>(".cm-panel-lint button.cm-diagnosticAction:not([data-replaced])")) {
    const description = document.createElement("span");
    description.className = "sr-only";
    description.textContent = button.getAttribute("aria-label") ?? button.textContent ?? "";
    const label = document.createElement("span");
    label.className = "cm-diagnosticAction";
    label.setAttribute("aria-hidden", "true");
    label.dataset.action = button.textContent ?? "";
    label.append(...button.childNodes);
    label.addEventListener("mousedown", (e) => {
      e.preventDefault();
      button.click();
    });
    button.replaceWith(description, label);
    // Kept (hidden; an inline style, since CodeMirror's theme sets its display) for its click handler.
    button.style.display = "none";
    button.dataset.replaced = "";
    label.after(button);
  }
});

/** Markdown lint as CodeMirror diagnostics (underlines, gutter, Problems panel). */
export function markdownLinter(): Extension {
  return [
    linter(
      async (view) => {
        if (!lintsDocumentOf(view.state.doc.length)) {
          useUi.getState().setProblems(null);
          return [];
        }
        const text = view.state.doc.toString();
        const doc = activeDoc();
        const hidden = new Set(useSettings.getState().settings.lintDisabledRules);
        const problems = [...lintMarkdown(text), ...(await lintLinks(text, doc?.path ?? null, exists, filesIn))].filter((p) => !hidden.has(p.rule));
        const len = view.state.doc.length;
        const diagnostics: Diagnostic[] = problems.map((p) => ({
          from: Math.min(p.from, len),
          to: Math.min(p.to, len),
          severity: p.severity,
          message: p.message,
          source: p.rule,
          actions: [...(p.fix ? [fixAction(p.fix)] : []), hideRule(p.rule)],
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
    accessiblePanelActions,
  ];
}

/** Command: applies every safe quick fix in the document as one undoable edit. */
export const fixAllProblemsCommand: StateCommand = ({ state, dispatch }) => {
  const before = state.doc.toString();
  const { text, fixed } = fixAllProblems(before, new Set(useSettings.getState().settings.lintDisabledRules));
  const change = fixed ? minimalChange(before, text) : null;
  if (!change) {
    notify("info", "No problems with a quick fix in this document.");
    return false;
  }
  dispatch(state.update({ changes: change, userEvent: "input.fix" }));
  notify("success", `Fixed ${fixed} problem${fixed === 1 ? "" : "s"}. Undo reverses them.`);
  return true;
};
