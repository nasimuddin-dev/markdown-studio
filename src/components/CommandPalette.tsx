import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUi } from "../stores/uiStore";
import { useDocuments } from "../stores/documentsStore";
import { commands, formatShortcut } from "../features/commands";
import { fuzzyFilter } from "../features/fuzzy";
import { insertSnippet, listSnippets, listTemplates, newFromTemplate, type Template } from "../features/templates";
import { useWorkspace } from "../stores/workspaceStore";
import { backend } from "../services";
import { isMarkdownPath } from "../services/paths";
import { openPath } from "../features/documents";
import { requestReveal } from "../features/editorBridge";
import { collectFolderHeadings, type FolderHeading } from "../features/workspace";
import { recentCommands, rememberCommand } from "../features/recentCommands";
import { extractHeadings } from "../features/outline";
import { goToHeading } from "./Outline";

type PaletteMode = "commands" | "templates" | "snippets" | "files" | "headings" | "folderHeadings" | "compare";

const LABELS: Record<PaletteMode, { dialog: string; placeholder: string; list: string; empty: string }> = {
  commands: { dialog: "Command palette", placeholder: "Type a command or tab name…", list: "Commands", empty: "No matching commands" },
  templates: { dialog: "New from template", placeholder: "Choose a template…", list: "Templates", empty: "No matching templates" },
  snippets: { dialog: "Insert snippet", placeholder: "Choose a snippet…", list: "Snippets", empty: "No matching snippets" },
  files: { dialog: "Go to file", placeholder: "Type part of a file name or path…", list: "Files", empty: "No matching files" },
  compare: { dialog: "Compare with file", placeholder: "Choose a file to compare with…", list: "Files", empty: "No matching files" },
  headings: { dialog: "Go to heading", placeholder: "Type part of a heading…", list: "Headings", empty: "No matching headings" },
  folderHeadings: { dialog: "Go to heading in folder", placeholder: "Type part of a heading in any document…", list: "Headings", empty: "No matching headings" },
};

/** Position in the recently used list (unlisted commands after all of them). */
const rank = (recent: string[], itemId: string) => {
  const i = recent.indexOf(itemId.slice(4));
  return i < 0 ? recent.length : i;
};

/** A path relative to the folder, with forward slashes. */
function relativePath(path: string, root: string) {
  return (path.startsWith(root) ? path.slice(root.length) : path).replace(/^[\\/]+/, "").replace(/\\/g, "/");
}

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  /** Heading level - 1, for Go to Heading. */
  indent?: number;
  run(): void | Promise<void>;
}

function highlight(text: string, indices: number[]): ReactNode {
  if (!indices.length) return text;
  const set = new Set(indices);
  return [...text].map((ch, i) => (set.has(i) ? <mark key={i}>{ch}</mark> : ch));
}

/** Searchable list of every command and open tab (Ctrl/Cmd+Shift+P). */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const mode = useUi((s) => s.paletteMode);
  const setOpen = useUi((s) => s.setPaletteOpen);
  if (!open) return null;
  return <PaletteBody key={mode} mode={mode} onClose={() => setOpen(false)} />;
}

function PaletteBody({ mode, onClose }: { mode: PaletteMode; onClose(): void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const docs = useDocuments((s) => s.docs);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [files, setFiles] = useState<string[] | null>(null);
  const [folderHeadings, setFolderHeadings] = useState<FolderHeading[] | null>(null);
  const root = useWorkspace((s) => s.root);
  useEffect(() => {
    if (mode === "templates") void listTemplates().then(setTemplates);
    if (mode === "snippets") void listSnippets().then(setTemplates);
    if ((mode === "files" || mode === "compare") && root) {
      void backend()
        .listWorkspaceFiles(root)
        .then((all) => setFiles(all.filter(isMarkdownPath)), () => setFiles([]));
    }
    if (mode === "folderHeadings" && root) void collectFolderHeadings(root).then(setFolderHeadings);
  }, [mode, root]);

  const items = useMemo<PaletteItem[]>(() => {
    if (mode === "templates" || mode === "snippets") {
      const run = mode === "templates" ? newFromTemplate : insertSnippet;
      return (templates ?? []).map((t) => ({ id: `tpl:${t.id}`, label: t.name, hint: t.description, run: () => void run(t) }));
    }
    if (mode === "headings") {
      const content = docs.find((d) => d.id === useDocuments.getState().activeId)?.content ?? "";
      return extractHeadings(content).map((h, index) => ({
        id: `heading:${index}`,
        label: h.text,
        hint: `H${h.level} · line ${h.line}`,
        indent: h.level - 1,
        run: () => goToHeading(h, index),
      }));
    }
    if (mode === "folderHeadings") {
      return (folderHeadings ?? []).map(({ path, heading }, index) => ({
        id: `folder-heading:${index}`,
        label: heading.text,
        hint: `${relativePath(path, root ?? "")} · H${heading.level}`,
        run: () => void openPath(path).then((id) => id && requestReveal(id, heading.line, 0, 0)),
      }));
    }
    if (mode === "compare") {
      const active = docs.find((d) => d.id === useDocuments.getState().activeId);
      return (files ?? [])
        .filter((path) => path !== active?.path)
        .map((path) => ({
          id: `compare:${path}`,
          label: relativePath(path, root ?? ""),
          run: () => active && useUi.getState().setCompare({ docId: active.id, path }),
        }));
    }
    if (mode === "files") {
      // Open files first, then the rest in folder order; matching uses the relative path.
      const open = new Set(docs.map((d) => d.path));
      const sorted = [...(files ?? [])].sort((a, b) => Number(open.has(b)) - Number(open.has(a)));
      return sorted.map((path) => ({
        id: `file:${path}`,
        label: relativePath(path, root ?? ""),
        hint: open.has(path) ? "Open" : undefined,
        run: () => void openPath(path),
      }));
    }
    const recent = recentCommands();
    const cmdItems = Object.values(commands)
      .filter((c) => c.id !== "commandPalette" && (!c.enabled || c.enabled()))
      .map((c) => ({
        id: `cmd:${c.id}`,
        label: c.label.replace(/…$/, ""),
        shortcut: c.shortcut,
        hint: recent.includes(c.id) ? "Recently used" : undefined,
        run: c.run,
      }))
      // Recently used commands first (newest first); the rest keep their order. With a query, matching decides.
      .sort((a, b) => rank(recent, a.id) - rank(recent, b.id));
    const tabItems = docs.map((d) => ({
      id: `tab:${d.id}`,
      label: `Go to Tab: ${d.name}`,
      hint: d.path ?? "Not saved",
      run: () => useDocuments.getState().setActive(d.id),
    }));
    return [...cmdItems, ...tabItems];
  }, [docs, mode, templates, files, folderHeadings, root]);

  const results = useMemo(() => fuzzyFilter(items, query, (i) => i.label).slice(0, mode === "headings" ? 1000 : mode === "folderHeadings" ? 200 : 50), [items, query, mode]);

  useEffect(() => {
    // Remember where focus was before the palette took it, to give it back on close.
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus?.();
  }, []);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    if (item.id.startsWith("cmd:")) rememberCommand(item.id.slice(4));
    onClose();
    // Let the palette unmount (and focus return) before running.
    setTimeout(() => void item.run(), 0);
  };

  return (
    <div className="palette-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={LABELS[mode].dialog}>
        <input
          ref={input}
          className="palette-input"
          placeholder={LABELS[mode].placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `palette-item-${active}` : undefined}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "PageDown") setActive((a) => Math.min(a + 8, results.length - 1));
            else if (e.key === "PageUp") setActive((a) => Math.max(a - 8, 0));
            else if (e.key === "Enter") runItem(results[active]?.item);
            else if (e.key === "Escape") onClose();
            else return;
            e.preventDefault();
            e.stopPropagation();
          }}
        />
        <ul className="palette-list" id="palette-list" role="listbox" ref={list} aria-label={LABELS[mode].list}>
          {results.length === 0 && (mode === "commands" || mode === "headings" || (mode === "templates" || mode === "snippets" ? templates !== null : mode === "folderHeadings" ? folderHeadings !== null : files !== null)) && (
            <li className="palette-empty">{LABELS[mode].empty}</li>
          )}
          {results.map(({ item, match }, i) => (
            <li
              key={item.id}
              id={`palette-item-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              className={`palette-item${i === active ? " active" : ""}`}
              onPointerMove={() => setActive(i)}
              onClick={() => runItem(item)}
            >
              <span className="palette-label" style={item.indent && !query ? { paddingLeft: `${item.indent}em` } : undefined}>
                {highlight(item.label, match.indices)}
              </span>
              {item.hint && <span className="palette-hint">{item.hint}</span>}
              {item.shortcut && <kbd>{formatShortcut(item.shortcut)}</kbd>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
