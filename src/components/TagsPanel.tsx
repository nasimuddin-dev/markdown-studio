import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "../stores/workspaceStore";
import { basename } from "../services/paths";
import { openPath } from "../features/documents";
import { openFolderDialog } from "../features/workspace";
import { requestReveal } from "../features/editorBridge";
import { collectFolderTags, tagLabel } from "../features/tags";
import { Icon } from "./Icon";

type FolderTags = Awaited<ReturnType<typeof collectFolderTags>>;

/** The tags used across the folder, most used first; each lists the files using it. */
export function TagsPanel() {
  const root = useWorkspace((s) => s.root);
  const [tags, setTags] = useState<FolderTags | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const run = useRef(0);

  const load = useCallback(async () => {
    if (!root) return;
    const id = ++run.current;
    const found = await collectFolderTags(root);
    if (id === run.current) setTags(found);
  }, [root]);

  useEffect(() => {
    setTags(null);
    void load();
  }, [load]);

  if (!root) {
    return (
      <section className="search-panel" aria-label="Tags">
        <div className="explorer-header"><span className="explorer-title">Tags</span></div>
        <div className="explorer-empty">
          <p>Open a folder to see the #tags used in its Markdown files.</p>
          <button className="button primary" onClick={() => void openFolderDialog()}>
            <Icon name="folderOpen" /> Open Folder
          </button>
        </div>
      </section>
    );
  }

  const sorted = [...(tags ?? [])].sort(([a, x], [b, y]) => y.length - x.length || a.localeCompare(b));
  return (
    <section className="search-panel" aria-label="Tags">
      <div className="explorer-header">
        <span className="explorer-title">Tags</span>
        <div className="explorer-actions">
          <button className="icon-button small" title="Refresh" aria-label="Refresh" onClick={() => void load()}>
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>
      <div className="search-summary" role="status" aria-live="polite">
        {tags === null ? "Finding tags…" : sorted.length ? `${sorted.length} ${sorted.length === 1 ? "tag" : "tags"}` : "No #tags in this folder yet."}
      </div>
      {sorted.length > 0 && (
        <ul className="search-results" aria-label="Tags">
          {sorted.map(([tag, uses]) => (
            <li key={tag}>
              <button className="search-file" aria-expanded={!!open[tag]} onClick={() => setOpen((o) => ({ ...o, [tag]: !o[tag] }))}>
                <Icon name={open[tag] ? "chevronDown" : "chevronRight"} size={14} />
                <span className="search-file-name">#{tagLabel(uses)}</span>
                <span className="badge" title={`${uses.length} ${uses.length === 1 ? "file" : "files"}`}>{uses.length}</span>
              </button>
              {open[tag] && (
                <ul>
                  {uses.map((u) => (
                    <li key={u.path}>
                      <button
                        className="search-match link-problem"
                        title={`${u.path}, line ${u.line}${u.count > 1 ? `, used ${u.count} times` : ""}`}
                        onClick={() => void openPath(u.path).then((id) => id && requestReveal(id, u.line, 0, 0))}
                      >
                        <span className="incoming-file">{basename(u.path)}</span>
                        <span className="link-problem-line">{u.line}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
