import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useDocuments } from "../stores/documentsStore";
import { useUi } from "../stores/uiStore";
import { useSettings } from "../stores/settingsStore";
import { currentHeadingIndex, extractHeadings, headingSlugs, type Heading } from "../features/outline";
import { moveSectionAtLine, moveSectionTo, setDocumentText } from "../features/sections";
import { copyText } from "../features/pathActions";
import { ContextMenu } from "./ContextMenu";
import { revealLine } from "../features/editorBridge";
import { Icon } from "./Icon";
import { mountAllChunks } from "./PreviewChunks";

/** Scrolls the preview to the n-th heading. */
function revealInPreview(index: number) {
  mountAllChunks();
  const headings = document.querySelectorAll<HTMLElement>(".markdown-body :is(h1,h2,h3,h4,h5,h6)");
  headings[index]?.scrollIntoView({ block: "start" });
}

/** Document outline: navigable list of headings for the active document. */
export function Outline() {
  const docId = useDocuments((s) => s.activeId);
  const content = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content);
  const deferred = useDeferredValue(content);
  const headings = useMemo(() => (deferred ? extractHeadings(deferred) : []), [deferred]);
  const cursorLine = useUi((s) => s.cursor.line);
  const current = currentHeadingIndex(headings, cursorLine);
  const collapsed = useSettings((s) => !s.settings.showOutline);
  const update = useSettings((s) => s.update);
  const list = useRef<HTMLUListElement>(null);
  const minLevel = headings.reduce((m, h) => Math.min(m, h.level), 6);
  const slugs = useMemo(() => headingSlugs(headings), [headings]);
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  /** After a keyboard move, focus follows the moved heading. */
  const refocus = useRef<{ text: string; level: number } | null>(null);

  useEffect(() => {
    const target = refocus.current;
    if (!target || !list.current) return;
    const index = headings.findIndex((h) => h.text === target.text && h.level === target.level);
    if (index >= 0) {
      refocus.current = null;
      list.current.querySelectorAll<HTMLButtonElement>(".outline-item")[index]?.focus();
    }
  }, [headings]);

  const move = (index: number, direction: -1 | 1) => {
    const h = headings[index];
    if (!docId || !h) return false;
    refocus.current = { text: h.text, level: h.level };
    const moved = moveSectionAtLine(docId, h.line, direction);
    if (!moved) refocus.current = null;
    return moved;
  };

  /** Dragging a heading: `dropIndex` is the heading it will go before, or headings.length for the end. */
  const drag = useRef<{ index: number; y: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState<{ from: number; drop: number | null } | null>(null);

  const dropTarget = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-outline-index]");
    if (el) return Number(el.dataset.outlineIndex);
    const r = list.current?.getBoundingClientRect();
    return r && y > r.bottom - 4 && x >= r.left && x <= r.right ? headings.length : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button !== 0) return;
    drag.current = { index, y: e.clientY, active: false };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active && Math.abs(ev.clientY - d.y) < 5) return;
      d.active = true;
      setDragging({ from: d.index, drop: dropTarget(ev.clientX, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = drag.current;
      drag.current = null;
      setDragging(null);
      if (!d?.active) return;
      suppressClick.current = true;
      const drop = dropTarget(ev.clientX, ev.clientY);
      const text = useDocuments.getState().docs.find((doc) => doc.id === docId)?.content;
      if (drop === null || text === undefined || !docId) return;
      const next = moveSectionTo(text, headings[d.index].line, drop < headings.length ? headings[drop].line : null);
      if (next !== null) {
        refocus.current = { text: headings[d.index].text, level: headings[d.index].level };
        setDocumentText(docId, next);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onItemKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      move(index, e.key === "ArrowUp" ? -1 : 1);
    } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      setMenu({ x: r.left + 12, y: r.bottom, index });
    }
  };

  useEffect(() => {
    list.current?.querySelector(".outline-item.current")?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const go = (h: Heading, index: number) => {
    const viewMode = useSettings.getState().settings.viewMode;
    if (viewMode !== "preview") revealLine(h.line);
    if (viewMode !== "editor") revealInPreview(index);
  };

  return (
    <section className={`sidebar-section outline${collapsed ? " collapsed" : ""}`} aria-label="Outline">
      <button
        className="sidebar-section-header"
        aria-expanded={!collapsed}
        onClick={() => update({ showOutline: collapsed })}
      >
        <Icon name={collapsed ? "chevronRight" : "chevronDown"} size={14} />
        <span>Outline</span>
        {!collapsed && headings.length > 0 && <span className="badge">{headings.length}</span>}
      </button>
      {!collapsed && (
        content === undefined ? (
          <p className="sidebar-empty">No document is open.</p>
        ) : headings.length === 0 ? (
          <p className="sidebar-empty">No headings in this document.</p>
        ) : (
          <ul className={`outline-list${dragging?.drop === headings.length ? " drop-end" : ""}`} ref={list} role="list">
            {headings.map((h, i) => (
              <li key={`${h.line}-${i}`}>
                <button
                  data-outline-index={i}
                  className={`outline-item${i === current ? " current" : ""}${dragging?.from === i ? " dragging" : ""}${dragging && dragging.drop === i && dragging.from !== i ? " drop-before" : ""}`}
                  style={{ paddingLeft: 12 + (h.level - minLevel) * 14 }}
                  aria-current={i === current ? "location" : undefined}
                  title={`${h.text} (line ${h.line}). Drag, or press Alt+Up/Down, to move the section`}
                  onClick={() => {
                    if (suppressClick.current) suppressClick.current = false;
                    else go(h, i);
                  }}
                  onPointerDown={(e) => onPointerDown(e, i)}
                  onKeyDown={(e) => onItemKey(e, i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, index: i });
                  }}
                >
                  <span className="outline-level" aria-hidden="true">H{h.level}</span>
                  <span className="outline-text">{h.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {menu && headings[menu.index] && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={`Actions for heading ${headings[menu.index].text}`}
          onClose={() => setMenu(null)}
          items={[
            { label: "Copy Link to Heading", run: () => copyText(`#${slugs[menu.index]}`, "Link") },
            {
              label: "Copy Markdown Link",
              run: () => copyText(`[${headings[menu.index].text.replace(/([[\]])/g, "\\$1")}](#${slugs[menu.index]})`, "Markdown link"),
            },
            "separator",
            { label: "Move Section Up", run: () => move(menu.index, -1), shortcut: "Alt+↑" },
            { label: "Move Section Down", run: () => move(menu.index, 1), shortcut: "Alt+↓" },
          ]}
        />
      )}
    </section>
  );
}
