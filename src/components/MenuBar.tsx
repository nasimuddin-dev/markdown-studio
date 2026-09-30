import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { commands, formatShortcut } from "../features/commands";
import { MENUS, menuLabel, type MenuItem } from "../features/menus";
import { openRecentFile } from "../features/documents";
import { openRecentFolder } from "../features/workspace";
import { backend } from "../services";
import { basename, displayPath } from "../services/paths";
import { useSettings } from "../stores/settingsStore";
import type { RecentEntry, ViewMode } from "../types";
import { Icon } from "./Icon";

/** Menu items of this list only (not those of an open submenu inside it). */
const ownItems = (list: HTMLElement | null) =>
  [...(list?.querySelectorAll<HTMLButtonElement>(":scope > [role^=menuitem]:not([disabled]), :scope > .menu-sub > [role^=menuitem]:not([disabled])") ?? [])];

/** Hovering a submenu row opens it after a short pause, so a diagonal move toward it doesn't switch rows. */
const HOVER_DELAY = 120;

interface ListProps {
  /** Top-level menu name, for labels like "Table: …". */
  menu: string;
  items: MenuItem[];
  recent: RecentEntry[];
  /** Closes every menu, then runs the choice. */
  onRun(fn: () => unknown): void;
  /** Escape / ArrowLeft in a submenu: close it and return focus to its row. */
  onBack?(): void;
  /** Submenus open beside this row. */
  anchor?: DOMRect;
  focusFirst: boolean;
  label: string;
}

function MenuList({ menu, items, recent, onRun, onBack, anchor, focusFirst, label }: ListProps) {
  const list = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<{ index: number; rect: DOMRect; focus: boolean } | null>(null);
  const [pos, setPos] = useState<CSSProperties | undefined>(anchor ? { visibility: "hidden" } : undefined);
  const hover = useRef<number | undefined>(undefined);

  // Submenus are fixed-position flyouts beside their row, flipped to stay on screen.
  useLayoutEffect(() => {
    if (!anchor || !list.current) return;
    const { width, height } = list.current.getBoundingClientRect();
    let left = anchor.right - 2;
    if (left + width > window.innerWidth - 4) left = Math.max(4, anchor.left - width + 2);
    const top = Math.max(4, Math.min(anchor.top - 5, window.innerHeight - height - 4));
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    if (focusFirst) ownItems(list.current)[0]?.focus();
  }, [focusFirst]);
  useEffect(() => () => window.clearTimeout(hover.current), []);

  const openSubmenu = (index: number, row: HTMLElement, focus: boolean) => {
    window.clearTimeout(hover.current);
    setOpenSub({ index, rect: row.getBoundingClientRect(), focus });
  };
  const hoverRow = (index: number, row: HTMLElement | null) => {
    window.clearTimeout(hover.current);
    hover.current = window.setTimeout(() => {
      if (row && items[index]?.type === "submenu") openSubmenu(index, row, false);
      else setOpenSub(null);
    }, HOVER_DELAY);
  };

  const onKey = (e: KeyboardEvent) => {
    const els = ownItems(list.current);
    const idx = els.indexOf(document.activeElement as HTMLButtonElement);
    if (idx < 0) return; // the key belongs to an open submenu
    const current = els[idx];
    if (e.key === "ArrowDown") els[(idx + 1) % els.length]?.focus();
    else if (e.key === "ArrowUp") els[(idx - 1 + els.length) % els.length]?.focus();
    else if (e.key === "Home") els[0]?.focus();
    else if (e.key === "End") els[els.length - 1]?.focus();
    else if (e.key === "ArrowRight" && current.dataset.submenu) openSubmenu(Number(current.dataset.submenu), current, true);
    else if ((e.key === "ArrowLeft" || e.key === "Escape") && onBack) onBack();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const closeSub = (index: number) => {
    setOpenSub(null);
    (list.current?.querySelector(`[data-submenu="${index}"]`) as HTMLElement | null)?.focus();
  };

  // The recent-files placeholder expands to one row per entry.
  type Row = {
    i: number;
    item: Exclude<MenuItem, { type: "recent" }> | { type: "recentEntry"; entry: RecentEntry } | { type: "noRecent" };
  };
  const rows = items.flatMap((item, i): Row[] => {
    if (item.type !== "recent") return [{ item, i }];
    return recent.length ? recent.map((entry) => ({ item: { type: "recentEntry", entry }, i })) : [{ item: { type: "noRecent" }, i }];
  });

  return (
    <div
      className={`menu-list${anchor ? " menu-flyout" : ""}`}
      role="menu"
      aria-label={label}
      ref={list}
      style={pos}
      onKeyDown={onKey}
    >
      {rows.map(({ item, i }, key) => {
        if (item.type === "separator") return <div key={key} className="menu-separator" role="separator" />;
        if (item.type === "noRecent") {
          return (
            <button key={key} role="menuitem" className="menu-item" disabled onPointerEnter={() => hoverRow(i, null)}>
              <span className="menu-item-check" />
              <span className="menu-item-label">No recent files</span>
            </button>
          );
        }
        if (item.type === "recentEntry") {
          const { entry } = item;
          return (
            <button
              key={entry.path}
              role="menuitem"
              className="menu-item"
              title={entry.path}
              onPointerEnter={() => hoverRow(i, null)}
              onClick={() => onRun(() => (entry.kind === "file" ? openRecentFile(entry.path) : openRecentFolder(entry.path)))}
            >
              <span className="menu-item-check"><Icon name={entry.kind === "file" ? "file" : "folder"} size={14} /></span>
              <span className="menu-item-label">
                {basename(entry.path)}
                <span className="menu-item-hint">{displayPath(entry.path, 36)}</span>
              </span>
            </button>
          );
        }
        if (item.type === "submenu") {
          const open = openSub?.index === i;
          return (
            <div key={key} className="menu-sub">
              <button
                role="menuitem"
                className={`menu-item${open ? " open" : ""}`}
                aria-haspopup="menu"
                aria-expanded={open}
                data-submenu={i}
                onPointerEnter={(e) => hoverRow(i, e.currentTarget)}
                onClick={(e) => (open ? setOpenSub(null) : openSubmenu(i, e.currentTarget, false))}
              >
                <span className="menu-item-check" />
                <span className="menu-item-label">{item.label}</span>
                <Icon name="chevronRight" size={14} className="menu-item-arrow" />
              </button>
              {open && openSub && (
                <MenuList
                  menu={menu}
                  items={item.items}
                  recent={recent}
                  onRun={onRun}
                  onBack={() => closeSub(i)}
                  anchor={openSub.rect}
                  focusFirst={openSub.focus}
                  label={item.label}
                />
              )}
            </div>
          );
        }
        const command = commands[item.id];
        const disabled = command.enabled ? !command.enabled() : false;
        const checked = command.checked?.();
        return (
          <button
            key={key}
            role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={checked}
            className="menu-item"
            disabled={disabled}
            onPointerEnter={() => hoverRow(i, null)}
            onClick={() => onRun(command.run)}
          >
            <span className="menu-item-check">{checked && <Icon name="check" size={14} />}</span>
            <span className="menu-item-label">{menuLabel(item, menu)}</span>
            <kbd className="menu-item-shortcut">{formatShortcut(command.shortcut)}</kbd>
          </button>
        );
      })}
    </div>
  );
}

function Menu({ label, items, recent, open, onOpen, onClose }: {
  label: string;
  items: MenuItem[];
  recent: RecentEntry[];
  open: boolean;
  onOpen(): void;
  onClose(focusButton?: boolean): void;
}) {
  return (
    <div className="menu">
      <button
        className={`menu-button${open ? " open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {label}
      </button>
      {open && (
        <div
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose(true);
            }
          }}
        >
          <MenuList
            menu={label}
            items={items}
            recent={recent}
            label={label}
            focusFirst
            onRun={(fn) => {
              onClose();
              void fn();
            }}
          />
        </div>
      )}
    </div>
  );
}

const VIEW_MODES: { mode: ViewMode; icon: "editor" | "split" | "preview"; label: string }[] = [
  { mode: "editor", icon: "editor", label: "Editor only" },
  { mode: "split", icon: "split", label: "Split view" },
  { mode: "preview", icon: "preview", label: "Preview only" },
];

export function MenuBar() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const viewMode = useSettings((s) => s.settings.viewMode);
  const showExplorer = useSettings((s) => s.settings.showExplorer);
  const update = useSettings((s) => s.update);
  // On macOS the menus go to the system menu bar instead.
  const [nativeMenu, setNativeMenu] = useState(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { nativeMenus, runMenuCommand } = await import("../features/nativeMenu");
      const installed = await backend()
        .setNativeMenu(nativeMenus(MENUS))
        .catch(() => false);
      if (!installed || cancelled) return;
      unlisten = await backend().onMenuCommand(runMenuCommand);
      if (cancelled) unlisten();
      else setNativeMenu(true);
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (openIdx === null) return;
    if (MENUS[openIdx].label === "File") backend().listRecent().then(setRecent).catch(() => setRecent([]));
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpenIdx(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [openIdx]);

  return (
    <header className="menubar" ref={bar}>
      {!nativeMenu && <nav className="menus" aria-label="Application menu"
        onKeyDown={(e) => {
          if (openIdx === null) return;
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            setOpenIdx((openIdx + (e.key === "ArrowRight" ? 1 : MENUS.length - 1)) % MENUS.length);
          }
        }}
      >
        {MENUS.map((m, i) => (
          <Menu
            key={m.label}
            label={m.label}
            items={m.items}
            recent={recent}
            open={openIdx === i}
            onOpen={() => setOpenIdx(i)}
            onClose={(focusButton) => {
              setOpenIdx(null);
              if (focusButton) (bar.current?.querySelectorAll(".menu-button")[i] as HTMLElement | undefined)?.focus();
            }}
          />
        ))}
      </nav>}
      <div className="toolbar" role="toolbar" aria-label="View options">
        <button
          className={`icon-button${showExplorer ? " active" : ""}`}
          onClick={() => update({ showExplorer: !showExplorer })}
          title={`Toggle file explorer (${formatShortcut(commands.toggleExplorer.shortcut)})`}
          aria-label="Toggle file explorer"
          aria-pressed={showExplorer}
        >
          <Icon name="sidebar" />
        </button>
        <div className="segmented" role="group" aria-label="View mode">
          {VIEW_MODES.map((v) => (
            <button
              key={v.mode}
              className={`icon-button${viewMode === v.mode ? " active" : ""}`}
              onClick={() => update({ viewMode: v.mode })}
              title={v.label}
              aria-label={v.label}
              aria-pressed={viewMode === v.mode}
            >
              <Icon name={v.icon} />
            </button>
          ))}
        </div>
        <button className="icon-button" onClick={() => void commands.toggleTheme.run()} title="Toggle light/dark theme" aria-label="Toggle light or dark theme">
          <Icon name="theme" />
        </button>
        <button className="icon-button" onClick={() => void commands.settings.run()} title={`Settings (${formatShortcut(commands.settings.shortcut)})`} aria-label="Settings">
          <Icon name="settings" />
        </button>
      </div>
    </header>
  );
}
