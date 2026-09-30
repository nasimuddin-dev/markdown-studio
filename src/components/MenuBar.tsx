import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { commands, formatShortcut, type Command } from "../features/commands";
import { openRecentFile } from "../features/documents";
import { openRecentFolder } from "../features/workspace";
import { backend } from "../services";
import { basename, displayPath } from "../services/paths";
import { useSettings } from "../stores/settingsStore";
import type { RecentEntry, ViewMode } from "../types";
import { Icon } from "./Icon";

type Item = { type: "command"; command: Command; label?: string } | { type: "separator" } | { type: "recent"; entry: RecentEntry };

const c = (id: keyof typeof commands): Item => ({ type: "command", command: commands[id] });
/** A Table menu item, without the "Table: " prefix the command palette needs. */
const t = (id: keyof typeof commands): Item => ({ type: "command", command: commands[id], label: commands[id].label.replace(/^Table: /, "") });
const sep: Item = { type: "separator" };

const MENUS: { label: string; items: (recent: RecentEntry[]) => Item[] }[] = [
  {
    label: "File",
    items: (recent) => [
      c("newFile"), c("newFromTemplate"), c("newFileInWorkspace"), sep, c("openFile"), c("openFolder"), c("goToFile"),
      ...(recent.length ? [sep, ...recent.slice(0, 10).map((entry): Item => ({ type: "recent", entry })), c("clearRecent")] : []),
      sep, c("save"), c("saveAs"), c("saveAll"), c("renameFile"), c("fileHistory"), c("compareWithFile"), sep, c("importDocx"), c("importPdf"), c("importHtml"), c("importCsv"), c("convertFolder"), c("combineFolder"), sep, c("exportPdf"), c("exportDocx"), c("exportHtml"), c("copyFormatted"), c("copyHtml"), c("print"), c("exportFolderPdf"), c("exportFolderDocx"), c("exportFolderHtml"), sep, c("closeTab"), c("reopenClosedTab"), c("closeFolder"), sep, c("settings"),
    ],
  },
  {
    label: "Edit",
    items: () => [c("undo"), c("redo"), sep, c("find"), c("replace"), c("gotoLine"), c("goToHeading"), c("findInFiles"), c("checkLinks"), c("nextProblem"), c("previousProblem"), c("fixAllProblems"), sep, c("gitNextChange"), c("gitPreviousChange"), c("gitShowChange"), c("gitRevertChange"), sep, c("selectAll"), sep, c("sortLinesAsc"), c("sortLinesDesc"), c("removeDuplicateLines"), c("joinLines"), c("upperCase"), c("lowerCase"), c("titleCase")],
  },
  {
    label: "Format",
    items: () => [
      c("bold"), c("italic"), c("strikethrough"), c("inlineCode"), c("link"), c("insertImage"), sep,
      c("heading1"), c("heading2"), c("heading3"), c("heading4"), c("heading5"), c("heading6"), c("paragraph"), c("promoteHeading"), c("demoteHeading"), c("numberHeadings"), c("removeHeadingNumbers"), c("moveSectionUp"), c("moveSectionDown"), sep,
      c("bulletList"), c("orderedList"), c("taskList"), c("toggleTaskCheck"), c("quote"), c("calloutNote"), c("calloutTip"), c("calloutImportant"), c("calloutWarning"), c("calloutCaution"), sep,
      c("codeBlock"), c("horizontalRule"), c("footnote"), sep, c("toc"),
    ],
  },
  {
    label: "Table",
    items: () => [
      t("table"), t("fixTable"), t("convertToTable"), t("formatTable"), sep,
      t("tableRowAbove"), t("tableRowBelow"), t("tableDeleteRow"), sep,
      t("tableColumnLeft"), t("tableColumnRight"), t("tableDeleteColumn"), t("tableMoveColumnLeft"), t("tableMoveColumnRight"), sep,
      t("tableAlignLeft"), t("tableAlignCenter"), t("tableAlignRight"), sep,
      t("sortTableAsc"), t("sortTableDesc"), sep, t("importCsv"), t("copyTableCsv"),
    ],
  },
  {
    label: "View",
    items: () => [
      c("viewEditor"), c("viewSplit"), c("viewPreview"), c("toggleView"), sep, c("commandPalette"), sep, c("toggleExplorer"), c("toggleOutline"), c("toggleToolbar"), c("toggleWordWrap"), c("toggleLineNumbers"), c("toggleTheme"), sep, c("foldAll"), c("unfoldAll"), sep, c("focusMode"), c("fullScreen"), c("presentSlides"), c("toggleReadOnly"),
      sep, c("zoomIn"), c("zoomOut"), c("zoomReset"), sep, c("nextTab"), c("prevTab"),
    ],
  },
  {
    label: "AI",
    items: () => [c("aiImprove"), c("aiFixGrammar"), c("aiShorter"), sep, c("aiSummarize"), c("aiContinue"), c("aiTranslate"), sep, c("aiWrite"), c("aiAsk")],
  },
  { label: "Help", items: () => [c("shortcuts"), c("commandPalette"), sep, c("exportLogs"), c("checkUpdates"), c("about")] },
];

function Menu({ label, items, open, onOpen, onClose }: {
  label: string;
  items: Item[];
  open: boolean;
  onOpen(): void;
  onClose(focusButton?: boolean): void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not([disabled])")?.focus();
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    const els = [...(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])") ?? [])];
    const idx = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") els[(idx + 1) % els.length]?.focus();
    else if (e.key === "ArrowUp") els[(idx - 1 + els.length) % els.length]?.focus();
    else if (e.key === "Home") els[0]?.focus();
    else if (e.key === "End") els[els.length - 1]?.focus();
    else if (e.key === "Escape") onClose(true);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const run = (fn: () => unknown) => {
    onClose();
    void fn();
  };

  return (
    <div className="menu">
      <button
        ref={btn}
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
        <div className="menu-list" role="menu" aria-label={label} ref={list} onKeyDown={onKey}>
          {items.map((item, i) => {
            if (item.type === "separator") return <div key={i} className="menu-separator" role="separator" />;
            if (item.type === "recent") {
              const { entry } = item;
              return (
                <button
                  key={entry.path}
                  role="menuitem"
                  className="menu-item"
                  title={entry.path}
                  onClick={() => run(() => (entry.kind === "file" ? openRecentFile(entry.path) : openRecentFolder(entry.path)))}
                >
                  <span className="menu-item-label">
                    <Icon name={entry.kind === "file" ? "file" : "folder"} size={14} /> {basename(entry.path)}
                    <span className="menu-item-hint">{displayPath(entry.path, 36)}</span>
                  </span>
                </button>
              );
            }
            const { command } = item;
            const disabled = command.enabled ? !command.enabled() : false;
            return (
              <button key={command.id} role="menuitem" className="menu-item" disabled={disabled} onClick={() => run(command.run)}>
                <span className="menu-item-label">{item.label ?? command.label}</span>
                <kbd className="menu-item-shortcut">{formatShortcut(command.shortcut)}</kbd>
              </button>
            );
          })}
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

  useEffect(() => {
    if (openIdx === null) return;
    if (openIdx === 0) backend().listRecent().then(setRecent).catch(() => setRecent([]));
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpenIdx(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [openIdx]);

  return (
    <header className="menubar" ref={bar}>
      <nav className="menus" aria-label="Application menu"
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
            items={m.items(recent)}
            open={openIdx === i}
            onOpen={() => setOpenIdx(i)}
            onClose={(focusButton) => {
              setOpenIdx(null);
              if (focusButton) (bar.current?.querySelectorAll(".menu-button")[i] as HTMLElement | undefined)?.focus();
            }}
          />
        ))}
      </nav>
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
