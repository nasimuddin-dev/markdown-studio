import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { commands, formatShortcut } from "../features/commands";
import { getEditorView } from "../features/editorBridge";
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
  "tableRowAbove", "tableRowBelow", "tableColumnLeft", "tableColumnRight", "separator",
  "tableDeleteRow", "tableDeleteColumn", "separator",
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

/**
 * Formatting toolbar above the editor. Buttons show the formatting at the
 * cursor (pressed), keep the editor's focus and selection, and form one tab
 * stop: arrow keys move between them (WAI-ARIA toolbar pattern).
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
  const bar = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [aiMenu, setAiMenu] = useState<{ x: number; y: number } | null>(null);
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number } | null>(null);

  const items = () => [...(bar.current?.querySelectorAll<HTMLElement>("[data-toolbar-item]") ?? [])];
  const onKeyDown = (e: KeyboardEvent) => {
    const all = items();
    const current = all.indexOf(document.activeElement as HTMLElement);
    if (current < 0) return;
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: all.length - 1 }[e.key];
    if (next === undefined || (e.target as HTMLElement).tagName === "SELECT" && (e.key === "Home" || e.key === "End")) return;
    e.preventDefault();
    const i = (next + all.length) % all.length;
    setFocusIndex(i);
    all[i].focus();
  };
  // Keep the editor's focus and selection when a button is clicked with the mouse.
  const keepFocus = (e: MouseEvent) => e.preventDefault();
  let index = 0;
  const tab = () => (index++ === focusIndex ? 0 : -1);

  const heading = HEADINGS.find((h) => h.level === format.heading);
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting" ref={bar} onKeyDown={onKeyDown}>
      {GROUPS.map((group, g) => (
        <div className="toolbar-group" key={g}>
          {group.map((b) => {
            const pressed = b.pressed?.(format);
            // Inside a table the table button opens the table tools instead of inserting another table.
            if (b.id === "table" && format.table)
              return (
                <button
                  key={b.id}
                  className="toolbar-button pressed"
                  title="Table tools"
                  aria-label="Table tools"
                  aria-haspopup="menu"
                  aria-expanded={!!tableMenu}
                  tabIndex={tab()}
                  data-toolbar-item
                  onMouseDown={keepFocus}
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setTableMenu({ x: r.left, y: r.bottom + 2 });
                  }}
                >
                  <Icon name={b.icon} size={16} />
                </button>
              );
            return (
              <button
                key={b.id}
                className={`toolbar-button${pressed ? " pressed" : ""}`}
                title={tooltip(b.id)}
                aria-label={commands[b.id].label.replace(/…$/, "")}
                aria-pressed={b.pressed ? !!pressed : undefined}
                tabIndex={tab()}
                data-toolbar-item
                onMouseDown={keepFocus}
                onClick={() => run(b.id)}
              >
                <Icon name={b.icon} size={16} />
              </button>
            );
          })}
          {g === 0 && (
            <select
              className="toolbar-select"
              aria-label="Paragraph style"
              title="Paragraph style"
              value={heading?.command ?? "paragraph"}
              tabIndex={tab()}
              data-toolbar-item
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
          )}
        </div>
      ))}
      {aiEnabled && (
        <div className="toolbar-group">
          <button
            className="toolbar-button toolbar-text"
            title="AI assistant"
            aria-haspopup="menu"
            aria-expanded={!!aiMenu}
            tabIndex={tab()}
            data-toolbar-item
            onMouseDown={keepFocus}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setAiMenu({ x: r.left, y: r.bottom + 2 });
            }}
          >
            <Icon name="sparkle" size={16} /> AI
          </button>
        </div>
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
    </div>
  );
}
