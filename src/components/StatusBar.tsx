import { useMemo, useState } from "react";
import { useGit } from "../stores/gitStore";
import { useDocuments, isDirty } from "../stores/documentsStore";
import { useUi } from "../stores/uiStore";
import { useSettings } from "../stores/settingsStore";
import { countWords, textStats } from "../services/textStats";
import { getEditorView, showProblems } from "../features/editorBridge";
import { changeCounts, gitHunksOf, useGitBaseVersion } from "../features/gitGutter";
import { commands, formatShortcut } from "../features/commands";
import { backend } from "../services";
import { EditorView } from "@codemirror/view";
import { nextOpenTask, taskCounts } from "../features/taskCount";

/** Status bar: encoding, language, line/column and save state (SRS §8). */
export function StatusBar() {
  const doc = useDocuments((s) => s.docs.find((d) => d.id === s.activeId));
  const cursor = useUi((s) => s.cursor);
  const viewMode = useSettings((s) => s.settings.viewMode);
  const autoSave = useSettings((s) => s.settings.autoSave);
  const lintOn = useSettings((s) => s.settings.lintMarkdown);
  const problems = useUi((s) => s.problems);
  const goals = useSettings((s) => s.settings.wordGoals);
  const words = useMemo(() => (doc ? countWords(doc.content) : 0), [doc?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  let state = "";
  if (doc) {
    if (doc.saving) state = "Saving…";
    else if (doc.externalChange === "deleted") state = "Deleted on disk";
    else if (doc.externalChange === "modified") state = "Changed on disk";
    else if (isDirty(doc)) state = doc.path ? "Unsaved changes" : "Not saved";
    else if (doc.readOnly) state = "Read-only";
    else state = doc.path ? "Saved" : "New file";
  }

  return (
    <footer className="statusbar" aria-label="Status bar">
      <div className="status-left">
        {!backend().capabilities.desktop && <span className="status-item status-demo" title="Running in a browser. Files are stored in this browser only.">Browser demo</span>}
        <GitBranch />
        <FileChanges />
        {doc && (
          <span className={`status-item status-state${doc && isDirty(doc) ? " dirty" : ""}`} role="status" aria-live="polite">
            {state}
          </span>
        )}
      </div>
      {doc && (
        <div className="status-right">
          {lintOn && problems && viewMode !== "preview" && (
            <button
              className="status-item status-button"
              onClick={() => void showProblems()}
              title="Show problems"
              aria-label={`${problems.warnings + problems.errors} warnings, ${problems.infos} suggestions. Show problems.`}
            >
              ⚠ {problems.errors + problems.warnings} · ℹ {problems.infos}
            </button>
          )}
          {viewMode !== "preview" && (
            <button className="status-item status-button" title={`Go to Line (${formatShortcut(commands.gotoLine.shortcut)})`} onClick={() => void commands.gotoLine.run()}>
              Ln {cursor.line}, Col {cursor.col}
              {cursor.selected > 0 && ` (${cursor.selected} selected)`}
            </button>
          )}
          <TaskProgress content={doc.content} />
          <WordCount words={words} content={doc.content} goal={doc.path ? goals[doc.path] : undefined} />
          {autoSave !== "off" && doc.path && <span className="status-item" title="Auto save is on">Auto save</span>}
          <button
            className="status-item status-button status-low"
            title={`Line endings: ${doc.lineEnding.toUpperCase()} (kept when saving). Change to ${doc.lineEnding === "lf" ? "CRLF" : "LF"}`}
            aria-label={`Line endings ${doc.lineEnding.toUpperCase()}. Change to ${doc.lineEnding === "lf" ? "CRLF" : "LF"}.`}
            onClick={() => void commands[doc.lineEnding === "lf" ? "lineEndingsCrlf" : "lineEndingsLf"].run()}
          >
            {doc.lineEnding.toUpperCase()}
          </button>
          <button
            className="status-item status-button status-low"
            title={`Encoding: ${doc.bom ? "UTF-8 with BOM" : "UTF-8"}. Change to ${doc.bom ? "UTF-8 without BOM" : "UTF-8 with BOM"}`}
            aria-label={`Encoding ${doc.bom ? "UTF-8 with BOM" : "UTF-8"}. Change to ${doc.bom ? "UTF-8 without BOM" : "UTF-8 with BOM"}.`}
            onClick={() => void commands[doc.bom ? "encodingUtf8" : "encodingUtf8Bom"].run()}
          >
            {doc.bom ? "UTF-8 with BOM" : "UTF-8"}
          </button>
          <span className="status-item status-low">Markdown</span>
        </div>
      )}
    </footer>
  );
}

/** The Git branch of the open folder, with commits ahead of and behind its upstream. */
/** Changes to the file since the last commit; a click goes to the next one. */
function FileChanges() {
  const content = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content);
  const baseVersion = useGitBaseVersion((s) => s.version);
  const counts = useMemo(() => {
    const view = getEditorView();
    const hunks = view ? gitHunksOf(view.state) : [];
    return hunks.length ? changeCounts(hunks) : null;
  }, [content, baseVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!counts) return null;
  const parts = [
    counts.added && `+${counts.added}`,
    counts.changed && `~${counts.changed}`,
    counts.deleted && `−${counts.deleted}`,
  ].filter(Boolean);
  const describe = [
    counts.added && `${counts.added} added`,
    counts.changed && `${counts.changed} changed`,
    counts.deleted && `${counts.deleted} deleted`,
  ].filter(Boolean).join(", ");
  return (
    <button
      className="status-item status-button"
      title={`Lines since the last commit: ${describe}. Go to the next change (Alt+F5)`}
      aria-label={`Lines since the last commit: ${describe}. Go to the next change.`}
      onClick={() => void commands.gitNextChange.run()}
    >
      {parts.join(" ")}
    </button>
  );
}

function GitBranch() {
  const status = useGit((s) => s.status);
  if (!status) return null;
  const name = status.branch ?? "detached HEAD";
  const sync = `${status.ahead ? ` ↑${status.ahead}` : ""}${status.behind ? ` ↓${status.behind}` : ""}`;
  const changed = status.files.length;
  return (
    <span
      className="status-item"
      title={`Git branch ${name}${status.ahead ? `, ${status.ahead} to push` : ""}${status.behind ? `, ${status.behind} to pull` : ""}; ${changed} changed ${changed === 1 ? "file" : "files"}`}
    >
      ⎇ {name}
      {sync}
    </span>
  );
}

/** Task list progress ("3/7 tasks"); a click goes to the next open task. */
function TaskProgress({ content }: { content: string }) {
  const counts = useMemo(() => taskCounts(content), [content]);
  if (!counts.total) return null;
  const summary = `${counts.done} of ${counts.total} tasks done`;
  const goToNext = () => {
    const view = getEditorView();
    if (!view) return;
    const line = nextOpenTask(counts.open, view.state.doc.lineAt(view.state.selection.main.head).number);
    if (line === null) return;
    const pos = view.state.doc.line(Math.min(line, view.state.doc.lines)).from;
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "center" }) });
    view.focus();
  };
  return (
    <button
      className="status-item status-button"
      title={counts.open.length ? `${summary}. Go to the next open task` : summary}
      aria-label={counts.open.length ? `${summary}. Go to the next open task.` : summary}
      onClick={goToNext}
      disabled={!counts.open.length}
    >
      {counts.done}/{counts.total} tasks
    </button>
  );
}

/** Word count that opens a statistics popover (document and selection). */
function WordCount({ words, content, goal }: { words: number; content: string; goal?: number }) {
  const [open, setOpen] = useState(false);
  const cursor = useUi((s) => s.cursor);
  let selectionText = "";
  if (open && cursor.selected > 0) {
    const view = getEditorView();
    if (view) selectionText = view.state.selection.ranges.map((r) => view.state.sliceDoc(r.from, r.to)).join("\n");
  }
  const stats = open ? textStats(content) : null;
  const sel = open && selectionText ? textStats(selectionText) : null;
  const fmt = (n: number) => n.toLocaleString();
  return (
    <span className="status-popover-anchor">
      <button
        className="status-item status-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        title={goal ? `Document statistics. Goal: ${fmt(goal)} words (${Math.min(100, Math.round((words / goal) * 100))}%)` : "Document statistics"}
      >
        {goal ? `${fmt(words)} / ${fmt(goal)} words` : `${fmt(words)} words`}
      </button>
      {stats && (
        <div className="status-popover" role="dialog" aria-label="Document statistics" tabIndex={-1}>
          <table>
            <tbody>
              <tr><th scope="row">Words</th><td>{fmt(stats.words)}</td>{sel && <td>{fmt(sel.words)}</td>}</tr>
              <tr><th scope="row">Characters</th><td>{fmt(stats.characters)}</td>{sel && <td>{fmt(sel.characters)}</td>}</tr>
              <tr><th scope="row">Without spaces</th><td>{fmt(stats.charactersNoSpaces)}</td>{sel && <td>{fmt(sel.charactersNoSpaces)}</td>}</tr>
              <tr><th scope="row">Lines</th><td>{fmt(stats.lines)}</td>{sel && <td>{fmt(sel.lines)}</td>}</tr>
              <tr><th scope="row">Paragraphs</th><td>{fmt(stats.paragraphs)}</td>{sel && <td>{fmt(sel.paragraphs)}</td>}</tr>
              <tr><th scope="row">Reading time</th><td>{stats.readingMinutes} min</td>{sel && <td>{sel.readingMinutes} min</td>}</tr>
            </tbody>
            {sel && (
              <thead>
                <tr><td /><th scope="col">Document</th><th scope="col">Selection</th></tr>
              </thead>
            )}
          </table>
        </div>
      )}
    </span>
  );
}
