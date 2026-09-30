import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "../stores/workspaceStore";
import { useUi } from "../stores/uiStore";
import { toAppError } from "../services/errors";
import { basename } from "../services/paths";
import { openPath, saveAll } from "../features/documents";
import { openFolderDialog } from "../features/workspace";
import { requestReveal } from "../features/editorBridge";
import { checkWorkspaceLinks, type LinkProblem, type LinkReport } from "../features/linkCheck";
import { useDocuments } from "../stores/documentsStore";
import { Icon } from "./Icon";

/** Workspace-wide broken link / missing image / bad anchor report. */
export function LinkCheckPanel() {
  const root = useWorkspace((s) => s.root);
  const token = useUi((s) => s.linkCheckToken);
  const unsaved = useDocuments((s) => s.docs.some((d) => d.path && d.content !== d.savedContent));
  const [report, setReport] = useState<LinkReport | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const run = useRef(0);

  const check = useCallback(async () => {
    if (!root) return;
    const id = ++run.current;
    setError(null);
    setProgress("Checking links…");
    try {
      const r = await checkWorkspaceLinks(root, (done, total) => {
        if (id === run.current) setProgress(`Checking links… ${done} of ${total} files`);
      });
      if (id === run.current) setReport(r);
    } catch (e) {
      if (id === run.current) setError(toAppError(e).message);
    } finally {
      if (id === run.current) setProgress(null);
    }
  }, [root]);

  useEffect(() => {
    setReport(null);
    void check();
  }, [check, token]);

  const open = async (path: string, p: LinkProblem) => {
    const id = await openPath(path);
    if (id) requestReveal(id, p.line, p.column, p.length);
  };

  if (!root) {
    return (
      <section className="search-panel" aria-label="Link check">
        <div className="explorer-header"><span className="explorer-title">Link check</span></div>
        <div className="explorer-empty">
          <p>Open a folder to check the links in its Markdown files.</p>
          <button className="button primary" onClick={() => void openFolderDialog()}>
            <Icon name="folderOpen" /> Open Folder
          </button>
        </div>
      </section>
    );
  }

  const total = report?.files.reduce((n, f) => n + f.problems.length, 0) ?? 0;
  return (
    <section className="search-panel" aria-label="Link check">
      <div className="explorer-header">
        <span className="explorer-title">Link check</span>
        <div className="explorer-actions">
          <button className="icon-button small" title="Check again" aria-label="Check again" onClick={() => void check()} disabled={!!progress}>
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>
      <div className="search-summary" role="status" aria-live="polite">
        {error ? (
          <span className="search-error">{error}</span>
        ) : progress ? (
          progress
        ) : report ? (
          total === 0 ? (
            `No broken links in ${report.filesChecked} file${report.filesChecked === 1 ? "" : "s"} (${report.linksChecked} link${report.linksChecked === 1 ? "" : "s"} checked).`
          ) : (
            `${total} problem${total === 1 ? "" : "s"} in ${report.files.length} file${report.files.length === 1 ? "" : "s"}`
          )
        ) : (
          ""
        )}
      </div>
      {unsaved && !progress && (
        <div className="search-summary">
          Checks the saved files.{" "}
          <button className="text-link" onClick={() => void saveAll().then(check)}>Save all and check again</button>
        </div>
      )}
      {report && total > 0 && (
        <ul className="search-results" aria-label="Link problems">
          {report.files.map((f) => {
            const isCollapsed = !!collapsed[f.path];
            return (
              <li key={f.path}>
                <button className="search-file" title={f.path} aria-expanded={!isCollapsed} onClick={() => setCollapsed((c) => ({ ...c, [f.path]: !isCollapsed }))}>
                  <Icon name={isCollapsed ? "chevronRight" : "chevronDown"} size={14} />
                  <Icon name="file" size={14} className="tree-file-icon" />
                  <span className="search-file-name">{basename(f.path)}</span>
                  <span className="badge">{f.problems.length}</span>
                </button>
                {!isCollapsed && (
                  <ul>
                    {f.problems.map((p, i) => (
                      <li key={i}>
                        <button className="search-match link-problem" title={`Line ${p.line}`} onClick={() => void open(f.path, p)}>
                          <Icon name="warning" size={13} className="link-problem-icon" />
                          <span>{p.message}</span>
                          <span className="link-problem-line">{p.line}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
