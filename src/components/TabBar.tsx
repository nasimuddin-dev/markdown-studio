import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type WheelEvent } from "react";
import { useDocuments, isDirty } from "../stores/documentsStore";
import { closeDocument, newDocument } from "../features/documents";
import { commands, formatShortcut } from "../features/commands";
import { Icon } from "./Icon";
import { tabHints } from "../features/tabNames";
import { ContextMenu } from "./ContextMenu";
import { closeAllTabs, closeOthers, closeSaved, closeToTheRight, copyPath, openContainingFolder, renameDocument, revealInFolder, revealLabel } from "../features/pathActions";
import { useWorkspace } from "../stores/workspaceStore";
import { isInside } from "../services/paths";
import { backend } from "../services";
import { useUi } from "../stores/uiStore";

/** True when the file is inside the folder open in the Explorer. */
const isInsideWorkspace = (path: string) => {
  const root = useWorkspace.getState().root;
  return !!root && isInside(path, root);
};

/** Document tabs (FR-040, FR-041). Dirty tabs show a dot *and* a text label (§15). */
export function TabBar() {
  const docs = useDocuments((s) => s.docs);
  const activeId = useDocuments((s) => s.activeId);
  const setActive = useDocuments((s) => s.setActive);
  const move = useDocuments((s) => s.move);
  const drag = useRef<{ id: string; x: number; moved: boolean } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const menuDoc = menu ? docs.find((d) => d.id === menu.id) : undefined;

  /** Pointer-based reordering (HTML5 drag-and-drop is reserved for OS file drops). */
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 6) return;
    d.moved = true;
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-tab-id]");
    const targetId = over?.dataset.tabId;
    if (!targetId || targetId === d.id) return;
    const docsNow = useDocuments.getState().docs;
    move(d.id, docsNow.findIndex((x) => x.id === targetId));
  };
  const endDrag = () => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  };
  const list = useRef<HTMLDivElement>(null);

  // The tab strip has no visible scrollbar: keep the active tab in view…
  useEffect(() => {
    list.current?.querySelector(`[data-tab-id="${activeId}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeId, docs.length]);
  // …and let an ordinary mouse wheel scroll it sideways.
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = list.current;
    if (el && el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      const tab = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-tab-id]");
      if (tab) {
        e.preventDefault();
        const r = tab.getBoundingClientRect();
        setMenu({ x: r.left + 12, y: r.bottom, id: tab.dataset.tabId! });
      }
      return;
    }
    if (e.key === "Delete") {
      const tab = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-tab-id]");
      if (tab) {
        e.preventDefault();
        void closeDocument(tab.dataset.tabId!);
      }
      return;
    }
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const tabs = [...(list.current?.querySelectorAll<HTMLElement>("[role=tab]") ?? [])];
    const idx = tabs.indexOf(document.activeElement as HTMLElement);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    e.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  };

  const hints = useMemo(() => tabHints(docs), [docs]);
  return (
    <div className="tabbar">
      <div className="tabs" role="tablist" aria-label="Open documents" ref={list} onKeyDown={onKey} onWheel={onWheel}>
        {docs.map((d) => {
          const dirty = isDirty(d);
          const active = d.id === activeId;
          return (
            <div
              key={d.id}
              role="presentation"
              className={`tab${active ? " active" : ""}${dirty ? " dirty" : ""}${d.externalChange ? " warn" : ""}`}
              title={(d.path ?? "Not saved yet") + (dirty ? " — unsaved changes" : "")}
              onClick={() => setActive(d.id)}
              onAuxClick={(e) => {
                if (e.button === 1) void closeDocument(d.id);
              }}
              data-tab-id={d.id}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, id: d.id });
              }}
              onPointerDown={(e) => {
                if (e.button !== 0 || (e.target as HTMLElement).closest(".tab-close")) return;
                drag.current = { id: d.id, x: e.clientX, moved: false };
                window.addEventListener("pointermove", onPointerMove);
                window.addEventListener("pointerup", endDrag);
              }}
            >
              <div role="tab" aria-selected={active} tabIndex={active ? 0 : -1} className="tab-main">
                <Icon name="file" size={14} className="tab-icon" />
                <span className="tab-label">{d.name}</span>
                {hints.has(d.id) && (
                  <span className="tab-hint">
                    <span className="sr-only"> in </span>
                    {hints.get(d.id)}
                  </span>
                )}
                {dirty && <span className="sr-only"> (unsaved)</span>}
              </div>
              {/* Mouse affordance only: keyboard users close with Ctrl/Cmd+W, Delete or the context menu. */}
              <span
                className="tab-close"
                aria-hidden="true"
                title={`Close (${formatShortcut(commands.closeTab.shortcut)})`}
                onClick={(e) => {
                  e.stopPropagation();
                  void closeDocument(d.id);
                }}
              >
                <span className="tab-dirty-dot" />
                <Icon name="close" size={13} className="tab-close-icon" />
              </span>
            </div>
          );
        })}
      </div>
      {menu && menuDoc && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={`Actions for ${menuDoc.name}`}
          onClose={() => setMenu(null)}
          items={[
            { label: "Close", run: () => closeDocument(menuDoc.id), shortcut: commands.closeTab.shortcut },
            { label: "Close Others", run: () => closeOthers(menuDoc.id), disabled: docs.length < 2 },
            { label: "Close to the Right", run: () => closeToTheRight(menuDoc.id), disabled: docs[docs.length - 1]?.id === menuDoc.id },
            { label: "Close Saved", run: () => closeSaved() },
            { label: "Close All", run: () => closeAllTabs() },
            "separator",
            { label: menuDoc.path ? "Rename…" : "Save As…", run: () => renameDocument(menuDoc.id) },
            ...(menuDoc.path && !isInsideWorkspace(menuDoc.path) ? [{ label: "Open Containing Folder…", run: () => openContainingFolder(menuDoc.path!) }] : []),
            { label: "File History…", run: () => useUi.getState().setHistoryDocId(menuDoc.id), disabled: !menuDoc.path },
            { label: "Copy Path", run: () => copyPath(menuDoc.path!), disabled: !menuDoc.path },
            { label: revealLabel, run: () => revealInFolder(menuDoc.path!), disabled: !menuDoc.path || !backend().capabilities.revealInFolder },
          ]}
        />
      )}
      <button className="icon-button small new-tab" onClick={() => newDocument()} title={`New file (${formatShortcut(commands.newFile.shortcut)})`} aria-label="New file">
        <Icon name="plus" size={15} />
      </button>
    </div>
  );
}
