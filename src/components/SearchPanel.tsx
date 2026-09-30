import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../stores/workspaceStore";
import { useUi } from "../stores/uiStore";
import { backend } from "../services";
import { toAppError } from "../services/errors";
import { basename } from "../services/paths";
import { openPath } from "../features/documents";
import { openFolderDialog } from "../features/workspace";
import { requestReveal } from "../features/editorBridge";
import { replaceInWorkspace } from "../features/replaceInFiles";
import type { SearchMatch, SearchResult } from "../types";
import { Icon } from "./Icon";

function relative(path: string, root: string) {
  const rel = path.startsWith(root) ? path.slice(root.length).replace(/^[\\/]/, "") : path;
  const idx = Math.max(rel.lastIndexOf("/"), rel.lastIndexOf("\\"));
  return idx > 0 ? rel.slice(0, idx) : "";
}

function Toggle({ label, title, on, set }: { label: string; title: string; on: boolean; set(v: boolean): void }) {
  return (
    <button
      type="button"
      className={`search-toggle${on ? " on" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={on}
      onClick={() => set(!on)}
    >
      {label}
    </button>
  );
}

/** Find in Files across the open workspace. */
export function SearchPanel() {
  const root = useWorkspace((s) => s.root);
  const focusToken = useUi((s) => s.searchFocusToken);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCase] = useState(false);
  const [wholeWord, setWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);
  const run = useRef(0);
  const [replacement, setReplacement] = useState("");
  const [replacing, setReplacing] = useState(false);
  /** Bumped after Replace All, so the search runs again on the new text. */
  const [searchAgain, setSearchAgain] = useState(0);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focusToken]);

  useEffect(() => {
    if (!root || !query) {
      setResult(null);
      setError(null);
      return;
    }
    const id = ++run.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await backend().searchWorkspace(root, { query, caseSensitive, wholeWord, regex, include, exclude });
        if (id === run.current) {
          setResult(r);
          setError(null);
        }
      } catch (e) {
        if (id === run.current) {
          setResult(null);
          setError(toAppError(e).message);
        }
      } finally {
        if (id === run.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [root, query, caseSensitive, wholeWord, regex, include, exclude, searchAgain]);

  const replaceAll = async () => {
    if (!root || !query || replacing) return;
    setReplacing(true);
    try {
      await replaceInWorkspace(root, { query, caseSensitive, wholeWord, regex, include, exclude }, replacement);
    } finally {
      setReplacing(false);
      setSearchAgain((n) => n + 1);
    }
  };

  const open = async (path: string, m: SearchMatch) => {
    const id = await openPath(path);
    if (id) requestReveal(id, m.line, m.column, m.length);
  };

  if (!root) {
    return (
      <section className="search-panel" aria-label="Search">
        <div className="explorer-header"><span className="explorer-title">Search</span></div>
        <div className="explorer-empty">
          <p>Open a folder to search across its files.</p>
          <button className="button primary" onClick={() => void openFolderDialog()}>
            <Icon name="folderOpen" /> Open Folder
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="search-panel" aria-label="Search">
      <div className="explorer-header"><span className="explorer-title">Search</span></div>
      <div className="search-box">
        <input
          ref={input}
          className="text-input"
          placeholder="Search in files"
          aria-label="Search in files"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />
        <div className="search-toggles">
          <Toggle label="Aa" title="Match case" on={caseSensitive} set={setCase} />
          <Toggle label="ab" title="Match whole word" on={wholeWord} set={setWord} />
          <Toggle label=".*" title="Use regular expression" on={regex} set={setRegex} />
          <button
            type="button"
            className={`search-toggle${include || exclude ? " on" : ""}`}
            title="File filters: include or exclude files"
            aria-label="File filters"
            aria-expanded={showFilters}
            aria-controls="search-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            …
          </button>
        </div>
      </div>
      <div className="search-box replace-box">
        <input
          className="text-input"
          placeholder={regex ? "Replace with ($1 for groups)" : "Replace with"}
          aria-label="Replace with"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void replaceAll();
          }}
          spellCheck={false}
        />
        <button
          type="button"
          className="button replace-all"
          disabled={!result || result.totalMatches === 0 || replacing}
          onClick={() => void replaceAll()}
          title="Replace every match in every Markdown file of the folder (Ctrl+Enter in the field)"
        >
          Replace All
        </button>
      </div>
      {showFilters && (
        <div className="search-filters" id="search-filters">
          <label htmlFor="search-include">Files to include</label>
          <input id="search-include" className="text-input" placeholder="e.g. docs, *.md, guide/**" value={include} onChange={(e) => setInclude(e.target.value)} spellCheck={false} />
          <label htmlFor="search-exclude">Files to exclude</label>
          <input id="search-exclude" className="text-input" placeholder="e.g. drafts, archive/**" value={exclude} onChange={(e) => setExclude(e.target.value)} spellCheck={false} />
        </div>
      )}
      <div className="search-summary" role="status" aria-live="polite">
        {error
          ? <span className="search-error">{error}</span>
          : busy && !result
            ? "Searching…"
            : result
              ? result.totalMatches === 0
                ? `No results in ${result.filesSearched} file${result.filesSearched === 1 ? "" : "s"}.`
                : `${result.totalMatches}${result.truncated ? "+" : ""} result${result.totalMatches === 1 ? "" : "s"} in ${result.files.length} file${result.files.length === 1 ? "" : "s"}${result.truncated ? " (limit reached)" : ""}`
              : ""}
      </div>
      {result && (
        <ul className="search-results" aria-label="Search results">
          {result.files.map((f) => {
            const isCollapsed = !!collapsed[f.path];
            return (
              <li key={f.path}>
                <button className="search-file" title={f.path} aria-expanded={!isCollapsed} onClick={() => setCollapsed((c) => ({ ...c, [f.path]: !isCollapsed }))}>
                  <Icon name={isCollapsed ? "chevronRight" : "chevronDown"} size={14} />
                  <Icon name="file" size={14} className="tree-file-icon" />
                  <span className="search-file-name">{basename(f.path)}</span>
                  <span className="search-file-dir">{relative(f.path, root)}</span>
                  <span className="badge">{f.matches.length}</span>
                </button>
                {!isCollapsed && (
                  <ul>
                    {f.matches.map((m, i) => (
                      <li key={i}>
                        <button className="search-match" title={`Line ${m.line}`} onClick={() => void open(f.path, m)}>
                          {m.preview.slice(0, m.previewStart)}
                          <mark>{m.preview.slice(m.previewStart, m.previewStart + m.length)}</mark>
                          {m.preview.slice(m.previewStart + m.length)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
