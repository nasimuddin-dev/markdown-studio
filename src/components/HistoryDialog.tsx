import { useEffect, useMemo, useState } from "react";
import { useUi, notify } from "../stores/uiStore";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { backend } from "../services";
import { describeError } from "../services/errors";
import { diffLines, diffStats, withContext } from "../features/diff";
import type { HistoryEntry } from "../types";
import { Modal } from "./Dialogs";

export function relativeTime(ms: number, now = Date.now()): string {
  const s = Math.round((now - ms) / 1000);
  if (s < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 604800) return rtf.format(-Math.round(s / 86400), "day");
  return new Date(ms).toLocaleDateString();
}

const formatSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** A saved version (its time) or the last Git commit. */
type VersionId = number | "git";

/** Local history for the active document, plus its last Git commit: browse, compare, restore. */
export function HistoryDialog() {
  const docId = useUi((s) => s.historyDocId);
  const close = () => useUi.getState().setHistoryDocId(null);
  const doc = useDocuments((s) => s.docs.find((d) => d.id === docId));
  const [versions, setVersions] = useState<HistoryEntry[] | null>(null);
  const [selected, setSelected] = useState<VersionId | null>(null);
  const [text, setText] = useState<string | null>(null);
  /** The committed text, or null when the file isn't in Git. */
  const [gitText, setGitText] = useState<string | null>(null);
  const showGit = useSettings((s) => s.settings.showGitStatus);

  useEffect(() => {
    setVersions(null);
    setSelected(null);
    setGitText(null);
    if (!doc?.path) return;
    const path = doc.path;
    const git = showGit ? backend().gitHeadText(path).catch(() => null) : Promise.resolve(null);
    Promise.all([backend().listHistory(path), git])
      .then(([v, committed]) => {
        setGitText(committed);
        setVersions(v);
        setSelected(v[0]?.id ?? (committed !== null ? "git" : null));
      })
      .catch((e) => {
        setVersions([]);
        notify("error", describeError(e, "load the file history"));
      });
  }, [doc?.path, showGit]);

  useEffect(() => {
    setText(null);
    if (!doc?.path || selected === null) return;
    if (selected === "git") {
      setText(gitText);
      return;
    }
    let cancelled = false;
    backend()
      .readHistory(doc.path, selected)
      .then((t) => !cancelled && setText(t))
      .catch((e) => notify("error", describeError(e, "read that version")));
    return () => {
      cancelled = true;
    };
  }, [doc?.path, selected, gitText]);

  const diff = useMemo(() => (text !== null && doc ? diffLines(text, doc.content) : null), [text, doc?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!docId || !doc) return null;

  const restore = () => {
    if (text === null || selected === null) return;
    useDocuments.getState().setContent(doc.id, text);
    const which = selected === "git" ? "the last committed version" : `the version from ${new Date(selected).toLocaleString()}`;
    notify("success", `Restored ${which}. Save to keep it, or undo to go back.`);
    close();
  };

  const stats = diff ? diffStats(diff) : null;

  return (
    <Modal title={`File History — ${doc.name}`} onClose={close} className="history-modal">
      {versions === null ? (
        <p className="muted">Loading…</p>
      ) : versions.length === 0 && gitText === null ? (
        <p className="modal-message">
          No earlier versions yet. Each time you save, the previous version is kept here (up to 30 per file).
        </p>
      ) : (
        <div className="history-body">
          <ul className="history-list" aria-label="Versions">
            {gitText !== null && (
              <li>
                <button
                  aria-current={selected === "git" ? "true" : undefined}
                  className={`history-item${selected === "git" ? " active" : ""}`}
                  onClick={() => setSelected("git")}
                  title="The file as of the last Git commit"
                >
                  <span>Last commit</span>
                  <span className="muted small">Git · {formatSize(new TextEncoder().encode(gitText).length)}</span>
                </button>
              </li>
            )}
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  aria-current={v.id === selected ? "true" : undefined}
                  className={`history-item${v.id === selected ? " active" : ""}`}
                  onClick={() => setSelected(v.id)}
                  title={new Date(v.id).toLocaleString()}
                >
                  <span>{relativeTime(v.id)}</span>
                  <span className="muted small">{new Date(v.id).toLocaleTimeString()} · {formatSize(v.size)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="history-diff" aria-label="Changes from this version to the current text">
            {text === null ? (
              <p className="muted">Loading…</p>
            ) : diff === null ? (
              <p className="muted">This document is too large to compare. You can still restore the version.</p>
            ) : stats && stats.added + stats.removed === 0 ? (
              <p className="muted">Identical to the current text.</p>
            ) : (
              <>
                <p className="history-legend">
                  <span className="diff-del-chip">− {stats!.removed} in this version</span>{" "}
                  <span className="diff-add-chip">+ {stats!.added} now</span>
                </p>
                <pre className="diff">
                  {withContext(diff).map((row, i) =>
                    row.kind === "gap" ? (
                      <div key={i} className="diff-gap">⋯ {row.hidden} unchanged line{row.hidden === 1 ? "" : "s"}</div>
                    ) : (
                      <div key={i} className={`diff-line diff-${row.kind}`}>
                        <span className="diff-sign" aria-hidden="true">{row.kind === "add" ? "+" : row.kind === "del" ? "−" : " "}</span>
                        <span className="sr-only">{row.kind === "add" ? "added: " : row.kind === "del" ? "removed: " : ""}</span>
                        {row.text || " "}
                      </div>
                    ),
                  )}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
      <div className="modal-buttons">
        <button className="button" onClick={close}>Close</button>
        {versions && (versions.length > 0 || gitText !== null) && (
          <button className="button primary" onClick={restore} disabled={text === null}>
            Restore This Version
          </button>
        )}
      </div>
    </Modal>
  );
}
