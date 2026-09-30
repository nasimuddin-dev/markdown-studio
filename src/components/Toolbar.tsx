import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { commands, formatShortcut } from "../features/commands";
import { getEditorView, runOnEditor } from "../features/editorBridge";
import { insertTableOf } from "../features/formatting";
import { tableAround } from "../features/tables";
import { TablePicker } from "./TablePicker";
import { formatStateAt, NO_FORMAT, type FormatState } from "../features/formatState";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { useUi } from "../stores/uiStore";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { Icon, type IconName } from "./Icon";

type Button = { id: string; icon: IconName; pressed?: (f: FormatState) => boolean };

/** Button groups, like the Home tab of a word processor. Each runs an existing command. */
const GROUPS: Button[][] = [
  [
    { id: "undo", icon: "undo" },
    { id: "redo", icon: "redo" },
  ],
  [
    { id: "bold", icon: "bold", pressed: (f) => f.bold },
    { id: "italic", icon: "italic", pressed: (f) => f.italic },
    { id: "strikethrough", icon: "strikethrough", pressed: (f) => f.strikethrough },
    { id: "inlineCode", icon: "code", pressed: (f) => f.code },
  ],
  [
    { id: "bulletList", icon: "listBullet", pressed: (f) => f.list === "bullet" },
    { id: "orderedList", icon: "listOrdered", pressed: (f) => f.list === "ordered" },
    { id: "taskList", icon: "listTask", pressed: (f) => f.list === "task" },
    { id: "quote", icon: "quote", pressed: (f) => f.quote },
  ],
  [
    { id: "link", icon: "link", pressed: (f) => f.link },
    { id: "insertImage", icon: "image" },
    { id: "table", icon: "table", pressed: (f) => f.table },
    { id: "codeBlock", icon: "codeBlock", pressed: (f) => f.codeBlock },
    { id: "horizontalRule", icon: "rule" },
    { id: "footnote", icon: "footnote" },
    { id: "toc", icon: "toc" },
  ],
];

const HEADINGS = [
  { level: 0, label: "Normal text", command: "paragraph" },
  { level: 1, label: "Heading 1", command: "heading1" },
  { level: 2, label: "Heading 2", command: "heading2" },
  { level: 3, label: "Heading 3", command: "heading3" },
  { level: 4, label: "Heading 4", command: "heading4" },
  { level: 5, label: "Heading 5", command: "heading5" },
  { level: 6, label: "Heading 6", command: "heading6" },
];

/** Shown by the table button when the cursor is already in a table. */
const TABLE_ACTIONS = [
  "fixTable", "separator",
  "tableRowAbove", "tableRowBelow", "tableColumnLeft", "tableColumnRight", "separator",
  "tableDeleteRow", "tableDeleteColumn", "separator",
  "tableAlignLeft", "tableAlignCenter", "tableAlignRight", "tableMoveColumnLeft", "tableMoveColumnRight", "separator",
  "formatTable", "sortTableAsc", "sortTableDesc", "copyTableCsv",
];

const AI_ACTIONS = ["aiImprove", "aiFixGrammar", "aiShorter", "aiSummarize", "aiContinue", "aiTranslate", "separator", "aiWrite", "aiAsk"];

const tooltip = (id: string) => {
  const c = commands[id];
  const label = c.label.replace(/…$/, "");
  return c.shortcut ? `${label} (${formatShortcut(c.shortcut)})` : label;
};

const run = (id: string) => {
  void commands[id]?.run();
};

const menuItems = (ids: string[]) =>
  ids.map((id): MenuEntry =>
    id === "separator"
      ? "separator"
      : { label: commands[id].label.replace(/^(AI|Table): /, ""), shortcut: formatShortcut(commands[id].shortcut) || undefined, run: () => run(id) },
  );

/** A toolbar control, in display order: a command button, the paragraph style list or the AI menu. */
type Slot = { group: number } & ({ kind: "button"; button: Button } | { kind: "style" } | { kind: "ai" });

function slots(aiEnabled: boolean): Slot[] {
  const out: Slot[] = [];
  GROUPS.forEach((group, g) => {
    group.forEach((button) => out.push({ group: g, kind: "button", button }));
    if (g === 0) out.push({ group: 0, kind: "style" });
  });
  if (aiEnabled) out.push({ group: GROUPS.length, kind: "ai" });
  return out;
}

const commandEntry = (id: string): MenuEntry => ({ label: commands[id].label, shortcut: formatShortcut(commands[id].shortcut) || undefined, run: () => run(id) });

/** Room kept for the More button when some controls don't fit. */
const MORE_WIDTH = 40;

/**
 * Formatting toolbar above the editor. Buttons show the formatting at the
 * cursor (pressed), keep the editor's focus and selection, and form one tab
 * stop: arrow keys move between them (WAI-ARIA toolbar pattern). It stays on
 * one row: controls that don't fit move, in order, into a More menu at the end.
 */
export function Toolbar() {
  const cursor = useUi((s) => s.cursor);
  const content = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content);
  const aiEnabled = useSettings((s) => s.settings.aiEnabled);
  // Re-read the editor whenever the cursor or the text changes.
  const format = useMemo(() => {
    const view = getEditorView();
    return view ? formatStateAt(view.state) : NO_FORMAT;
  }, [cursor, content]); // eslint-disable-line react-hooks/exhaustive-deps
  // Table tools also for tables with mistakes (not parsed as tables) and multi-line selections, so Fix Table is at hand.
  const tableish = useMemo(() => {
    const view = getEditorView();
    if (!view) return false;
    const { state } = view;
    const sel = state.selection.main;
    if (!sel.empty && state.doc.lineAt(sel.from).number !== state.doc.lineAt(sel.to).number) return true;
    return tableAround(state, state.doc.lineAt(sel.head).number) !== null;
  }, [cursor, content]); // eslint-disable-line react-hooks/exhaustive-deps
  const bar = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [aiMenu, setAiMenu] = useState<{ x: number; y: number } | null>(null);
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number } | null>(null);
  const [tablePicker, setTablePicker] = useState<{ x: number; y: number } | null>(null);
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);

  const all = useMemo(() => slots(aiEnabled), [aiEnabled]);
  // How many controls fit; the rest go to the More menu. Measured with everything shown.
  const [fit, setFit] = useState(all.length);
  const measuring = useRef(true);
  useLayoutEffect(() => {
    if (!measuring.current || !bar.current) return;
    measuring.current = false;
    const el = bar.current;
    const available = el.clientWidth;
    const left = el.getBoundingClientRect().left;
    const ends = [...el.querySelectorAll<HTMLElement>("[data-slot]")].map((c) => c.getBoundingClientRect().right - left);
    if (!ends.length || ends[ends.length - 1] <= available) {
      setFit(all.length);
      return;
    }
    let n = 0;
    while (n < ends.length && ends[n] + MORE_WIDTH <= available) n++;
    setFit(Math.max(1, n));
  });
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      measuring.current = true;
      setFit((f) => (f === all.length ? all.length + 1 : all.length)); // show everything, then measure
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [all]);
  useEffect(() => {
    measuring.current = true;
    setFit(all.length + 1);
  }, [all]);
  const shown = Math.min(fit, all.length);

  const items = () => [...(bar.current?.querySelectorAll<HTMLElement>("[data-toolbar-item]:not([hidden])") ?? [])];
  const onKeyDown = (e: KeyboardEvent) => {
    const list = items();
    const current = list.indexOf(document.activeElement as HTMLElement);
    if (current < 0) return;
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: list.length - 1 }[e.key];
    if (next === undefined || (e.target as HTMLElement).tagName === "SELECT" && (e.key === "Home" || e.key === "End")) return;
    e.preventDefault();
    const i = (next + list.length) % list.length;
    setFocusIndex(i);
    list[i].focus();
  };
  // Keep the editor's focus and selection when a button is clicked with the mouse.
  const keepFocus = (e: MouseEvent) => e.preventDefault();
  // One tab stop among the visible controls; hidden ones are never tabbable.
  let index = 0;
  const tab = (visible: boolean) => (!visible ? -1 : index++ === focusIndex ? 0 : -1);
  useEffect(() => {
    if (!items().some((el) => el.tabIndex === 0)) setFocusIndex(0);
  });

  const openAt = (e: MouseEvent, set: (p: { x: number; y: number }) => void) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    set({ x: r.left, y: r.bottom + 2 });
  };

  const heading = HEADINGS.find((h) => h.level === format.heading);
  const inTable = format.table || tableish;

  /** The More menu: the hidden controls in order, a separator between groups. */
  const moreEntries = (): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    let lastGroup = -1;
    for (const slot of all.slice(shown)) {
      if (lastGroup !== -1 && slot.group !== lastGroup) entries.push("separator");
      lastGroup = slot.group;
      if (slot.kind === "style") entries.push(...HEADINGS.map((h) => commandEntry(h.command)));
      else if (slot.kind === "ai") entries.push(...AI_ACTIONS.map((id): MenuEntry => (id === "separator" ? "separator" : commandEntry(id))));
      else if (slot.button.id === "table" && inTable) entries.push(...menuItems(TABLE_ACTIONS));
      else entries.push(commandEntry(slot.button.id));
    }
    return entries;
  };

  const renderSlot = (slot: Slot, i: number) => {
    const visible = i < shown;
    const common = { "data-slot": i, "data-toolbar-item": true, hidden: !visible || undefined, tabIndex: tab(visible) } as const;
    if (slot.kind === "style")
      return (
        <select
          key="style"
          {...common}
          className="toolbar-select"
          aria-label="Paragraph style"
          title="Paragraph style"
          value={heading?.command ?? "paragraph"}
          onChange={(e) => {
            run(e.target.value);
            getEditorView()?.focus();
          }}
        >
          {HEADINGS.map((h) => (
            <option key={h.command} value={h.command}>
              {h.label}
            </option>
          ))}
        </select>
      );
    if (slot.kind === "ai")
      return (
        <button
          key="ai"
          {...common}
          className="toolbar-button toolbar-text"
          title="AI assistant"
          aria-haspopup="menu"
          aria-expanded={!!aiMenu}
          onMouseDown={keepFocus}
          onClick={(e) => openAt(e, setAiMenu)}
        >
          <Icon name="sparkle" size={16} /> AI
        </button>
      );
    const b = slot.button;
    // Inside a table the table button opens the table tools instead of inserting another table.
    if (b.id === "table" && inTable)
      return (
        <button
          key={b.id}
          {...common}
          className="toolbar-button pressed"
          title="Table tools"
          aria-label="Table tools"
          aria-haspopup="menu"
          aria-expanded={!!tableMenu}
          onMouseDown={keepFocus}
          onClick={(e) => openAt(e, setTableMenu)}
        >
          <Icon name={b.icon} size={16} />
        </button>
      );
    const pressed = b.pressed?.(format);
    return (
      <button
        key={b.id}
        {...common}
        className={`toolbar-button${pressed ? " pressed" : ""}`}
        title={tooltip(b.id)}
        aria-label={commands[b.id].label.replace(/…$/, "")}
        aria-pressed={b.pressed ? !!pressed : undefined}
        aria-haspopup={b.id === "table" ? "dialog" : undefined}
        onMouseDown={keepFocus}
        onClick={(e) => {
          if (b.id !== "table") return run(b.id);
          // Outside a table, the table button asks for the size first.
          openAt(e, setTablePicker);
        }}
      >
        <Icon name={b.icon} size={16} />
      </button>
    );
  };

  const groupCount = GROUPS.length + (aiEnabled ? 1 : 0);
  return (
    <div className="format-toolbar" role="toolbar" aria-label="Formatting" ref={bar} onKeyDown={onKeyDown}>
      {Array.from({ length: groupCount }, (_, g) => {
        const members = all.map((slot, i) => ({ slot, i })).filter((x) => x.slot.group === g);
        const anyVisible = members.some((x) => x.i < shown);
        return (
          <div className="toolbar-group" key={g} hidden={!anyVisible || undefined}>
            {members.map(({ slot, i }) => renderSlot(slot, i))}
          </div>
        );
      })}
      {shown < all.length && (
        <div className="toolbar-group toolbar-more">
          <button
            className="toolbar-button"
            title="More formatting tools"
            aria-label="More formatting tools"
            aria-haspopup="menu"
            aria-expanded={!!moreMenu}
            tabIndex={tab(true)}
            data-toolbar-item
            onMouseDown={keepFocus}
            onClick={(e) => openAt(e, setMoreMenu)}
          >
            <Icon name="more" size={16} />
          </button>
        </div>
      )}
      {tablePicker && (
        <TablePicker
          x={tablePicker.x}
          y={tablePicker.y}
          onClose={() => {
            setTablePicker(null);
            getEditorView()?.focus();
          }}
          onPick={(columns, rows) => {
            setTablePicker(null);
            runOnEditor(insertTableOf(columns, rows));
          }}
        />
      )}
      {tableMenu && (
        <ContextMenu
          x={tableMenu.x}
          y={tableMenu.y}
          label="Table tools"
          onClose={() => setTableMenu(null)}
          items={menuItems(TABLE_ACTIONS)}
        />
      )}
      {aiMenu && (
        <ContextMenu
          x={aiMenu.x}
          y={aiMenu.y}
          label="AI assistant"
          onClose={() => setAiMenu(null)}
          items={menuItems(AI_ACTIONS)}
        />
      )}
      {moreMenu && (
        <ContextMenu
          x={moreMenu.x}
          y={moreMenu.y}
          label="More formatting tools"
          onClose={() => setMoreMenu(null)}
          items={moreEntries()}
        />
      )}
    </div>
  );
}
