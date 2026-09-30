import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { forgetRecent, useRecentVersion } from "../features/recent";
import { useWorkspace } from "../stores/workspaceStore";
import { useDocuments, isDirty } from "../stores/documentsStore";
import { basename, dirname, isInside, isMarkdownPath } from "../services/paths";
import { useUi } from "../stores/uiStore";
import type { DirEntry, RecentEntry } from "../types";
import { closeDocument, openPath, openRecentFile } from "../features/documents";
import {
  closeWorkspace, collapseAllFolders, createFileIn, createFolderIn, deleteEntry, duplicateFile, moveEntry, moveEntryTo, openFolderDialog, openRecentFolder, refreshWorkspace, renameEntry,
  toggleDir,
} from "../features/workspace";
import { Icon } from "./Icon";
import { pathKey, useGit } from "../stores/gitStore";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { copyPath, copyRelativePath, insertFileLink, insertFileLinkAt, openContainingFolder, renameDocument, revealInFolder, revealLabel } from "../features/pathActions";
import { backend } from "../services";
import { useSettings } from "../stores/settingsStore";
import { fuzzyFilter } from "../features/fuzzy";

interface ContextMenu {
  x: number;
  y: number;
  entry: DirEntry;
}

const GIT_LABELS: Record<string, string> = { M: "modified", A: "added", D: "deleted", R: "renamed", U: "untracked", C: "conflict" };

type DragStart = (e: React.PointerEvent<HTMLElement>, entry: DirEntry) => void;

/** Pictures listed in the Explorer (Settings → Files → Show pictures in the Explorer). */
const isPicture = (entry: DirEntry) => !entry.isDir && !isMarkdownPath(entry.path);

/** When the last drag ended: the click that ends a drag must not also open or toggle a row. */
let lastDragEnd = 0;

function TreeNode({ entry, depth, onContext, onDragStart, dropTarget }: {
  entry: DirEntry;
  depth: number;
  onContext(e: MouseEvent, entry: DirEntry): void;
  onDragStart: DragStart;
  dropTarget: string | null;
}) {
  const expanded = useWorkspace((s) => !!s.expanded[entry.path]);
  const children = useWorkspace((s) => s.children[entry.path]);
  const selected = useWorkspace((s) => s.selected === entry.path);
  const openDoc = useDocuments((s) => s.docs.find((d) => d.path === entry.path));
  const active = useDocuments((s) => !!openDoc && s.activeId === openDoc.id);
  const git = useGit((s) => (entry.isDir ? (s.changedDirs.has(pathKey(entry.path)) ? "dir" : null) : s.files.get(pathKey(entry.path)) ?? null));

  const activate = () => {
    if (Date.now() - lastDragEnd < 300) return;
    useWorkspace.getState().select(entry.path);
    if (entry.isDir) void toggleDir(entry.path);
    else if (isPicture(entry)) useUi.getState().setImagePreview(entry.path);
    else void openPath(entry.path);
  };

  return (
    <li role="treeitem" aria-expanded={entry.isDir ? expanded : undefined} aria-selected={selected} aria-level={depth + 1}>
      <div
        className={`tree-row${selected ? " selected" : ""}${active ? " active" : ""}${dropTarget === entry.path ? " drop-target" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        tabIndex={selected ? 0 : -1}
        data-path={entry.path}
        data-dir={entry.isDir ? "true" : undefined}
        onPointerDown={(e) => onDragStart(e, entry)}
        onClick={activate}
        onContextMenu={(e) => onContext(e, entry)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onContext({ preventDefault() {}, clientX: r.left + 24, clientY: r.bottom } as unknown as MouseEvent, entry);
          } else if (e.key === "F2") {
            e.preventDefault();
            void renameEntry(entry);
          } else if (e.key === "Delete") {
            e.preventDefault();
            void deleteEntry(entry);
          } else if (e.key === "ArrowRight" && entry.isDir && !expanded) {
            e.preventDefault();
            void toggleDir(entry.path);
          } else if (e.key === "ArrowLeft" && entry.isDir && expanded) {
            e.preventDefault();
            void toggleDir(entry.path);
          }
        }}
        title={entry.path}
      >
        {entry.isDir ? (
          <Icon name={expanded ? "chevronDown" : "chevronRight"} size={14} className="tree-chevron" />
        ) : (
          <span className="tree-chevron-spacer" />
        )}
        <Icon name={entry.isDir ? (expanded ? "folderOpen" : "folder") : isPicture(entry) ? "image" : "file"} size={15} className={entry.isDir ? "tree-folder-icon" : "tree-file-icon"} />
        <span className={`tree-label${git && git !== "dir" ? ` git-${git}` : ""}`}>{entry.name}</span>
        {openDoc && isDirty(openDoc) && <span className="dirty-dot" title="Unsaved changes" aria-label="unsaved changes" />}
        {git === "dir" ? (
          <span className="git-dir-dot" title="Contains changes (Git)" aria-label="contains Git changes" />
        ) : git ? (
          <span className={`git-badge git-${git}`} title={`Git: ${GIT_LABELS[git] ?? "changed"}`} aria-label={`Git: ${GIT_LABELS[git] ?? "changed"}`}>
            {git}
          </span>
        ) : null}
      </div>
      {entry.isDir && expanded && (
        <ul role="group">
          {children === undefined ? (
            <li role="none" className="tree-empty" style={{ paddingLeft: 22 + (depth + 1) * 14 }}>Loading…</li>
          ) : children.length === 0 ? (
            <li role="none" className="tree-empty" style={{ paddingLeft: 22 + (depth + 1) * 14 }}>No Markdown files{useSettings.getState().settings.explorerShowImages ? " or pictures" : ""}</li>
          ) : (
            children.map((c) => (
              <TreeNode key={c.path} entry={c} depth={depth + 1} onContext={onContext} onDragStart={onDragStart} dropTarget={dropTarget} />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

export function FileExplorer() {
  const root = useWorkspace((s) => s.root);
  const activePath = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.path ?? null);
  const activeDocId = useDocuments((s) => s.activeId);
  const rootChildren = useWorkspace((s) => (s.root ? s.children[s.root] : undefined));
  const hasSelection = useWorkspace((s) => !!s.selected);
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const tree = useRef<HTMLUListElement>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  /**
   * Drag a row onto a folder (or the empty part of the tree, for the top
   * level) to move it there. Pointer events are used because the desktop
   * window takes over HTML drag and drop for files dropped from the OS.
   */
  const onDragStart: DragStart = (e, entry) => {
    if (e.button !== 0 || !root) return;
    const start = { x: e.clientX, y: e.clientY };
    let active = false;
    let target: string | null = null;
    // A file dropped on the editor is linked there instead of moved.
    let overEditor = false;
    const editorAt = (x: number, y: number) => !entry.isDir && !!document.elementFromPoint(x, y)?.closest(".cm-editor");
    const targetAt = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      if (!el || !tree.current?.contains(el)) return null;
      const row = el.closest<HTMLElement>(".tree-row");
      const dir = row ? (row.dataset.dir ? row.dataset.path! : dirname(row.dataset.path!)) : root;
      // Not onto its own folder, and not a folder into itself.
      if (dir === dirname(entry.path) || (entry.isDir && (dir === entry.path || isInside(dir, entry.path)))) return null;
      return dir;
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key, true);
      document.body.classList.remove("dragging-entry", "dragging-into-editor");
      setDropTarget(null);
    };
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      if (!active) document.body.classList.add("dragging-entry");
      active = true;
      overEditor = editorAt(ev.clientX, ev.clientY);
      document.body.classList.toggle("dragging-into-editor", overEditor);
      target = overEditor ? null : targetAt(ev.clientX, ev.clientY);
      setDropTarget(target);
    };
    const up = (ev: PointerEvent) => {
      finish();
      if (!active) return;
      lastDragEnd = Date.now();
      if (overEditor) insertFileLinkAt(entry.path, ev.clientX, ev.clientY);
      else if (target) void moveEntry(entry, target);
    };
    const key = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        active = false;
        finish();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key, true);
  };

  const onContext = (e: MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    useWorkspace.getState().select(entry.path);
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  /** Up/Down moves between visible rows (NFR-010). */
  const onTreeKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(tree.current?.querySelectorAll<HTMLElement>(".tree-row") ?? [])];
    const idx = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[Math.max(0, Math.min(rows.length - 1, idx + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      useWorkspace.getState().select(next.dataset.path ?? null);
      next.focus();
    }
  };

  if (!root) {
    return (
      <aside className="explorer" aria-label="File explorer">
        <div className="explorer-header">
          <span className="explorer-title">Explorer</span>
        </div>
        <OpenFiles />
        <RecentList />
        <div className="explorer-empty">
          <p>No folder is open.</p>
          {/* One button: with a file open, the folder dialog starts in that file's folder. */}
          <button
            className="button primary"
            onClick={() => void openFolderDialog(activePath ? dirname(activePath) : undefined)}
            title={activePath ? `Choose a folder (starts in ${basename(dirname(activePath))})` : "Choose a folder"}
          >
            <Icon name="folderOpen" /> Open Folder
          </button>
        </div>
      </aside>
    );
  }

  const menuDir = menu ? (menu.entry.isDir ? menu.entry.path : null) : null;

  return (
    <aside className="explorer" aria-label="File explorer">
      <div className="explorer-header">
        <span className="explorer-title" title={root}>{basename(root)}</span>
        <div className="explorer-actions">
          <button className="icon-button small" title="New file" aria-label="New file" onClick={() => void createFileIn(root)}>
            <Icon name="filePlus" size={15} />
          </button>
          <button className="icon-button small" title="New folder" aria-label="New folder" onClick={() => void createFolderIn(root)}>
            <Icon name="folderPlus" size={15} />
          </button>
          <button className="icon-button small" title="Collapse folders" aria-label="Collapse all folders" onClick={collapseAllFolders}>
            <Icon name="collapse" size={15} />
          </button>
          <button className="icon-button small" title="Refresh" aria-label="Refresh file explorer" onClick={() => void refreshWorkspace()}>
            <Icon name="refresh" size={15} />
          </button>
          <button
            className="icon-button small"
            title="Close Folder (removes it from the Explorer; nothing is deleted)"
            aria-label="Close folder"
            onClick={closeWorkspace}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      </div>
      <div className="explorer-filter">
        <input
          className="text-input"
          type="search"
          placeholder="Filter files"
          aria-label="Filter files by name"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Escape" && filter) {
              e.preventDefault();
              e.stopPropagation();
              setFilter("");
            } else if (e.key === "ArrowDown" || e.key === "Enter") {
              const first = e.currentTarget.parentElement?.nextElementSibling?.querySelector<HTMLElement>("button");
              if (!first) return;
              e.preventDefault();
              if (e.key === "Enter") first.click();
              else first.focus();
            }
          }}
        />
      </div>
      {filter.trim() ? (
        <FilteredFiles root={root} query={filter.trim()} version={rootChildren} />
      ) : (
      <ul className={`tree${dropTarget === root ? " drop-root" : ""}`} role="tree" aria-label={basename(root)} ref={tree} onKeyDown={onTreeKey}
        tabIndex={hasSelection ? -1 : 0}
        onFocus={(e) => {
          if (e.target === tree.current) tree.current?.querySelector<HTMLElement>(".tree-row")?.focus();
        }}
      >
        {rootChildren === undefined ? (
          <li role="none" className="tree-empty">Loading…</li>
        ) : rootChildren.length === 0 ? (
          <li role="none" className="tree-empty">This folder has no Markdown files.</li>
        ) : (
          rootChildren.map((c) => (
            <TreeNode key={c.path} entry={c} depth={0} onContext={onContext} onDragStart={onDragStart} dropTarget={dropTarget} />
          ))
        )}
      </ul>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={`Actions for ${menu.entry.name}`}
          onClose={() => setMenu(null)}
          items={[
            ...(menuDir
              ? ([
                  { label: "New File…", run: () => createFileIn(menuDir) },
                  { label: "New Folder…", run: () => createFolderIn(menuDir) },
                  "separator",
                ] as MenuEntry[])
              : isPicture(menu.entry)
                ? ([
                    { label: "Preview", run: () => useUi.getState().setImagePreview(menu.entry.path) },
                    { label: "Insert Link in Document", run: () => insertFileLink(menu.entry.path), disabled: !activePath },
                    "separator",
                  ] as MenuEntry[])
                : ([
                  { label: "Open", run: () => openPath(menu.entry.path) },
                  { label: "Duplicate", run: () => duplicateFile(menu.entry.path) },
                  ...(activeDocId && activePath !== menu.entry.path && isMarkdownPath(menu.entry.path)
                    ? [{ label: "Compare with Active File", run: () => useUi.getState().setCompare({ docId: activeDocId, path: menu.entry.path }) }]
                    : []),
                  "separator",
                ] as MenuEntry[])),
            { label: revealLabel, run: () => revealInFolder(menu.entry.path), disabled: !backend().capabilities.revealInFolder },
            { label: "Copy Path", run: () => copyPath(menu.entry.path) },
            { label: "Copy Relative Path", run: () => copyRelativePath(menu.entry.path) },
            "separator",
            { label: "Rename…", run: () => renameEntry(menu.entry), shortcut: "F2" },
            { label: "Move To…", run: () => moveEntryTo(menu.entry) },
            { label: "Delete…", run: () => deleteEntry(menu.entry), shortcut: "Delete", danger: true },
          ]}
        />
      )}
    </aside>
  );
}

/**
 * Without an open folder, the Explorer lists the open files, so a file opened
 * or saved on its own can still be renamed (F2 or right-click), revealed or
 * closed from here.
 */
/** The folder's files whose path matches the Explorer's filter, best matches first. */
function FilteredFiles({ root, query, version }: { root: string; query: string; version: unknown }) {
  const [files, setFiles] = useState<string[] | null>(null);
  const showImages = useSettings((s) => s.settings.explorerShowImages);
  useEffect(() => {
    let cancelled = false;
    void backend()
      .listWorkspaceFiles(root)
      .then((all) => all, () => [] as string[])
      .then((all) => !cancelled && setFiles(all));
    return () => {
      cancelled = true;
    };
    // A refreshed tree (new, renamed or deleted files) lists the files again.
  }, [root, version]);
  if (files === null) return <p className="tree-empty">Loading…</p>;
  const rel = (p: string) => (p.startsWith(root) ? p.slice(root.length) : p).replace(/^[\\/]+/, "").replace(/\\/g, "/");
  const shown = files.filter((p) => isMarkdownPath(p) || (showImages && /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i.test(p)));
  const matches = fuzzyFilter(shown, query, rel).slice(0, 200);
  if (!matches.length) return <p className="tree-empty">No matching files.</p>;
  const move = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLElement>("button")];
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? buttons[i + 1] : i <= 0 ? e.currentTarget.parentElement?.querySelector<HTMLElement>(".explorer-filter input") : buttons[i - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return (
    <ul className="search-results explorer-filter-results" aria-label="Matching files" onKeyDown={move}>
      {matches.map(({ item }) => (
        <li key={item}>
          <button className="search-file" title={item} onClick={() => (isMarkdownPath(item) ? void openPath(item) : useUi.getState().setImagePreview(item))}>
            <Icon name="file" size={14} className="tree-file-icon" />
            <span className="search-file-name">{basename(item)}</span>
            {rel(item).includes("/") && <span className="search-file-dir">{dirname(rel(item))}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function OpenFiles() {
  const docs = useDocuments((s) => s.docs);
  const activeId = useDocuments((s) => s.activeId);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  if (!docs.length) return null;
  const menuDoc = menu && docs.find((d) => d.id === menu.id);
  const openMenu = (id: string, x: number, y: number) => setMenu({ id, x, y });
  return (
    <section className="open-files" aria-label="Open files">
      <h3 className="open-files-title">Open Files</h3>
      <ul className="open-files-list">
        {docs.map((d) => (
          <li key={d.id}>
            <button
              className={`tree-row${d.id === activeId ? " active" : ""}`}
              title={d.path ?? "Not saved yet"}
              aria-current={d.id === activeId ? "true" : undefined}
              onClick={() => useDocuments.getState().setActive(d.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                openMenu(d.id, e.clientX, e.clientY);
              }}
              onKeyDown={(e) => {
                if (e.key === "F2") {
                  e.preventDefault();
                  void renameDocument(d.id);
                } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  openMenu(d.id, r.left + 12, r.bottom);
                }
              }}
            >
              <Icon name="file" size={15} className="tree-file-icon" />
              <span className="tree-label">{d.name}</span>
              {isDirty(d) && <span className="dirty-dot" aria-label="unsaved changes" />}
            </button>
          </li>
        ))}
      </ul>
      {menu && menuDoc && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={`Actions for ${menuDoc.name}`}
          onClose={() => setMenu(null)}
          items={[
            { label: menuDoc.path ? "Rename…" : "Save As…", shortcut: menuDoc.path ? "F2" : undefined, run: () => renameDocument(menuDoc.id) },
            ...(menuDoc.path ? [{ label: "Open Containing Folder…", run: () => openContainingFolder(menuDoc.path!) }] : []),
            "separator" as const,
            { label: "Copy Path", run: () => copyPath(menuDoc.path!), disabled: !menuDoc.path },
            { label: revealLabel, run: () => revealInFolder(menuDoc.path!), disabled: !menuDoc.path || !backend().capabilities.revealInFolder },
            "separator" as const,
            { label: "Close", run: () => closeDocument(menuDoc.id) },
          ]}
        />
      )}
    </section>
  );
}

/**
 * Without an open folder, recent files and folders that aren't open, so a
 * file worked on alone is one click away (like the welcome screen's list).
 */
function RecentList() {
  const docs = useDocuments((s) => s.docs);
  const version = useRecentVersion((s) => s.version);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  // Reload when documents open or close (opening adds to the list) or the list changes.
  useEffect(() => {
    backend().listRecent().then(setRecent).catch(() => {});
  }, [docs.length, version]);
  const open = new Set(docs.map((d) => d.path));
  const items = recent.filter((r) => !open.has(r.path)).slice(0, 6);
  if (!items.length) return null;
  return (
    <section className="open-files" aria-label="Recent">
      <h3 className="open-files-title">Recent</h3>
      <ul className="open-files-list">
        {items.map((r) => (
          <li key={r.path}>
            <button
              className="tree-row"
              title={r.path}
              onClick={() => void (r.kind === "file" ? openRecentFile(r.path) : openRecentFolder(r.path))}
            >
              <Icon name={r.kind === "file" ? "file" : "folder"} size={15} className={r.kind === "file" ? "tree-file-icon" : "tree-folder-icon"} />
              <span className="tree-label">{basename(r.path)}</span>
            </button>
            <button
              className="icon-button small recent-remove"
              title="Remove from Recent (the file isn't deleted)"
              aria-label={`Remove ${basename(r.path)} from Recent`}
              onClick={() => void forgetRecent(r.path)}
            >
              <Icon name="close" size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
