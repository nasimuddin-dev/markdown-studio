import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "../stores/workspaceStore";
import { useUi } from "../stores/uiStore";
import { toAppError } from "../services/errors";
import { basename, isInside, isMarkdownPath } from "../services/paths";
import { openPath, saveAll } from "../features/documents";
import { openFolderDialog } from "../features/workspace";
import { requestReveal } from "../features/editorBridge";
import { checkWorkspaceLinks, documentNames, findMentions, type LinkProblem, type LinkReport, type Mention } from "../features/linkCheck";
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
  const active = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.path ?? null);
  const [incomingOpen, setIncomingOpen] = useState(true);
  const [mentions, setMentions] = useState<Mention[] | null>(null);
  const [mentionsOpen, setMentionsOpen] = useState(true);
  const run = useRef(0);

  // Unlinked mentions of the open document, found again after each check.
  useEffect(() => {
    setMentions(null);
    if (!root || !active || !isMarkdownPath(active) || !isInside(active, root) || !report) return;
    let cancelled = false;
    const text = useDocuments.getState().docs.find((d) => d.path === active)?.content ?? "";
    void findMentions(root, active, documentNames(active, text)).then((found) => !cancelled && setMentions(found));
    return () => {
      cancelled = true;
    };
  }, [root, active, report]);

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

  const open = async (path: string, p: Pick<LinkProblem, "line" | "column" | "length">) => {
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
  const showIncoming = !!report && !!active && isMarkdownPath(active) && isInside(active, root);
  const incoming = showIncoming ? report!.incoming.filter((l) => isInside(l.to, active!) && isInside(active!, l.to)) : [];
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
      {showIncoming && (
        <ul className="search-results incoming-links" aria-label="Links to this document">
          <li>
            <button className="search-file" title={active!} aria-expanded={incomingOpen} onClick={() => setIncomingOpen(!incomingOpen)}>
              <Icon name={incomingOpen ? "chevronDown" : "chevronRight"} size={14} />
              <Icon name="link" size={14} className="tree-file-icon" />
              <span className="search-file-name">Links to {basename(active!)}</span>
              <span className="badge">{incoming.length}</span>
            </button>
            {incomingOpen &&
              (incoming.length ? (
                <ul>
                  {incoming.map((l, i) => (
                    <li key={i}>
                      <button className="search-match link-problem" title={`${l.from}, line ${l.line}`} onClick={() => void open(l.from, l)}>
                        <span>
                          <span className="incoming-file">{basename(l.from)}</span> {l.label}
                        </span>
                        <span className="link-problem-line">{l.line}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="incoming-none">No other file in the folder links here.</p>
              ))}
          </li>
          {mentions && (
            <li>
              <button className="search-file" aria-expanded={mentionsOpen} onClick={() => setMentionsOpen(!mentionsOpen)} title="Places that name this document without linking to it">
                <Icon name={mentionsOpen ? "chevronDown" : "chevronRight"} size={14} />
                <Icon name="search" size={14} className="tree-file-icon" />
                <span className="search-file-name">Mentions without a link</span>
                <span className="badge">{mentions.length}</span>
              </button>
              {mentionsOpen &&
                (mentions.length ? (
                  <ul>
                    {mentions.map((m, i) => (
                      <li key={i}>
                        <button className="search-match link-problem" title={`${m.path}, line ${m.line}`} onClick={() => void open(m.path, m)}>
                          <span>
                            <span className="incoming-file">{basename(m.path)}</span> {m.context}
                          </span>
                          <span className="link-problem-line">{m.line}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="incoming-none">No other file names it without a link.</p>
                ))}
            </li>
          )}
        </ul>
      )}
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
