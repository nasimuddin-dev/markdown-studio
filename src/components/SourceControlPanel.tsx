import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDocuments } from "../stores/documentsStore";
import { useGit } from "../stores/gitStore";
import { useWorkspace } from "../stores/workspaceStore";
import { basename, dirname, relativePath } from "../services/paths";
import type { GitBranches, GitChange } from "../types";
import { openPath } from "../features/documents";
import { openFolderDialog } from "../features/workspace";
import { changeLabel, commit, loadBranches, loadChanges, newBranch, pull, push, stage, switchBranch, unstage, type ChangesResult } from "../features/sourceControl";
import { ContextMenu } from "./ContextMenu";
import { Icon } from "./Icon";

/** Sidebar → Source Control: staged and unstaged changes, staging and committing. */
export function SourceControlPanel() {
  const root = useWorkspace((s) => s.root);
  const [result, setResult] = useState<ChangesResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [branches, setBranches] = useState<GitBranches | null>(null);
  const [branchMenu, setBranchMenu] = useState<{ x: number; y: number } | null>(null);
  const run = useRef(0);
  // Refresh after saves (each document's saved text) and Git status updates (commits made elsewhere).
  const saved = useDocuments(useShallow((s) => s.docs.map((d) => `${d.path}:${d.savedContent.length}`).join("|")));
  const gitStatus = useGit((s) => s.status);

  const load = useCallback(async () => {
    const id = ++run.current;
    const [r, b] = await Promise.all([loadChanges(), loadBranches()]);
    if (id !== run.current) return;
    setResult(r);
    setBranches(b);
  }, []);

  useEffect(() => {
    void load();
  }, [load, root, saved, gitStatus]);
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const doAndReload = async (work: () => Promise<boolean>) => {
    setBusy(true);
    try {
      const ok = await work();
      await load();
      return ok;
    } finally {
      setBusy(false);
    }
  };

  if (!root) {
    return (
      <section className="source-control" aria-label="Source Control">
        <div className="explorer-header"><span className="explorer-title">Source Control</span></div>
        <div className="sidebar-empty">
          <p>Open a folder in a Git repository to stage and commit changes.</p>
          <button className="button primary" onClick={() => void openFolderDialog()}>Open Folder</button>
        </div>
      </section>
    );
  }

  const changes = result && "changes" in result ? result.changes : [];
  const staged = changes.filter((c) => c.staged);
  const unstaged = changes.filter((c) => c.unstaged);
  const canCommit = staged.length > 0 && message.trim().length > 0 && !busy;
  const submit = () =>
    void doAndReload(async () => {
      const ok = await commit(message);
      if (ok) setMessage("");
      return ok;
    });

  const row = (c: GitChange, side: "staged" | "unstaged") => {
    const letter = side === "staged" ? c.staged : c.unstaged;
    const name = basename(c.path);
    // The file's folder within the open folder ("" at its top).
    const dir = relativePath(root, dirname(c.path)) ?? "";
    return (
      <li key={`${side}:${c.path}`} className="scm-row">
        <button className="scm-file" title={c.path} onClick={() => letter !== "D" && void openPath(c.path)}>
          <span className="scm-name">{name}</span>
          {dir && <span className="scm-dir">{dir}</span>}
        </button>
        <span className={`scm-letter scm-${(letter ?? "").toLowerCase()}`} title={changeLabel(letter)} aria-label={changeLabel(letter)}>{letter}</span>
        <button
          className="icon-button small"
          disabled={busy}
          aria-label={side === "staged" ? `Unstage ${name}` : `Stage ${name}`}
          title={side === "staged" ? "Unstage" : "Stage"}
          onClick={() => void doAndReload(() => (side === "staged" ? unstage([c.path]) : stage([c.path])))}
        >
          <Icon name={side === "staged" ? "minus" : "plus"} size={14} />
        </button>
      </li>
    );
  };

  return (
    <section className="source-control" aria-label="Source Control">
      <div className="explorer-header">
        <span className="explorer-title">Source Control</span>
        <button className="icon-button small" aria-label="Refresh" title="Refresh" onClick={() => void load()}>
          <Icon name="refresh" size={14} />
        </button>
      </div>
      {branches && (
        <div className="scm-branch-bar">
          <button
            className="button small scm-branch"
            aria-haspopup="menu"
            aria-label={`Branch: ${branches.current ?? "detached HEAD"}. Switch or create a branch`}
            title={`${branches.current ?? "Detached HEAD"}: switch or create a branch`}
            disabled={busy}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setBranchMenu({ x: r.left, y: r.bottom + 2 });
            }}
          >
            <Icon name="branch" size={14} />
            <span className="scm-branch-name">{branches.current ?? "detached HEAD"}</span>
            <Icon name="chevronDown" size={12} />
          </button>
          <button
            className="icon-button scm-sync"
            disabled={busy || !branches.upstream}
            title={branches.upstream ? `Pull from ${branches.upstream}` : "This branch has no upstream to pull from"}
            aria-label={`Pull${branches.behind ? `, ${branches.behind} to pull` : ""}`}
            onClick={() => void doAndReload(pull)}
          >
            <Icon name="arrowDown" size={14} />
            {branches.behind > 0 && <span>{branches.behind}</span>}
          </button>
          <button
            className="icon-button scm-sync"
            disabled={busy || !branches.hasRemote}
            title={branches.hasRemote ? (branches.upstream ? `Push to ${branches.upstream}` : "Push (and set the upstream)") : "This repository has no remote to push to"}
            aria-label={`Push${branches.ahead ? `, ${branches.ahead} to push` : ""}`}
            onClick={() => void doAndReload(push)}
          >
            <Icon name="arrowUp" size={14} />
            {branches.ahead > 0 && <span>{branches.ahead}</span>}
          </button>
        </div>
      )}
      {branchMenu && branches && (
        <ContextMenu
          x={branchMenu.x}
          y={branchMenu.y}
          label="Branches"
          onClose={() => setBranchMenu(null)}
          items={[
            ...branches.branches.map((name) => ({
              label: name === branches.current ? `✓ ${name}` : name,
              disabled: name === branches.current,
              run: () => void doAndReload(() => switchBranch(name)),
            })),
            "separator" as const,
            { label: "New Branch…", run: () => void doAndReload(newBranch) },
          ]}
        />
      )}
      {result && "error" in result ? (
        <p className="sidebar-empty muted" role="status">{result.error}</p>
      ) : (
        <>
          <div className="scm-commit">
            <label htmlFor="scm-message" className="sr-only">Commit message</label>
            <textarea
              id="scm-message"
              className="text-input"
              rows={3}
              placeholder="Commit message (Ctrl+Enter to commit)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canCommit) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button className="button primary" disabled={!canCommit} onClick={submit}>
              <Icon name="check" size={14} /> Commit{staged.length ? ` (${staged.length})` : ""}
            </button>
          </div>
          {result && changes.length === 0 && <p className="sidebar-empty muted" role="status">No changes. Everything is committed.</p>}
          {staged.length > 0 && (
            <div className="scm-group">
              <div className="scm-group-header">
                <h3 id="scm-staged" title="Staged Changes">Staged Changes</h3>
                <span className="badge">{staged.length}</span>
                <button className="icon-button small scm-all" disabled={busy} aria-label="Unstage All" title="Unstage All" onClick={() => void doAndReload(() => unstage(staged.map((c) => c.path)))}>
                  <Icon name="minus" size={14} />
                </button>
              </div>
              <ul aria-labelledby="scm-staged">{staged.map((c) => row(c, "staged"))}</ul>
            </div>
          )}
          {unstaged.length > 0 && (
            <div className="scm-group">
              <div className="scm-group-header">
                <h3 id="scm-unstaged" title="Changes">Changes</h3>
                <span className="badge">{unstaged.length}</span>
                <button className="icon-button small scm-all" disabled={busy} aria-label="Stage All" title="Stage All" onClick={() => void doAndReload(() => stage(unstaged.map((c) => c.path)))}>
                  <Icon name="plus" size={14} />
                </button>
              </div>
              <ul aria-labelledby="scm-unstaged">{unstaged.map((c) => row(c, "unstaged"))}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
