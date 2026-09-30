import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A section's rows: each starts at a label (or a checkbox label) and runs
 * until the next one, so a setting's control and hint stay with its label.
 */
function rowsOf(section: HTMLElement): HTMLElement[][] {
  const rows: HTMLElement[][] = [];
  for (const child of Array.from(section.children) as HTMLElement[]) {
    if (child.tagName === "H3") continue;
    if (child.tagName === "LABEL" || !rows.length) rows.push([child]);
    else rows[rows.length - 1].push(child);
  }
  return rows;
}

/**
 * Settings with a section list beside them and a search box above: the list
 * is built from the sections' headings, a click scrolls to that section, and
 * the section in view is highlighted. Searching shows only the settings (and
 * sections) whose text matches. On narrow windows the list is hidden.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<number | null>(null);
  /** Indexes of the sections with matches while searching ("" when not searching), as a string so equal results don't re-render. */
  const [withMatches, setWithMatches] = useState("");
  /** Until this time, scrolling doesn't change the highlight (a clicked section stays highlighted). */
  const pinnedUntil = useRef(0);

  const sections = () => [...(body.current?.querySelectorAll<HTMLElement>(":scope > section") ?? [])];

  useLayoutEffect(() => {
    setNames(sections().map((s) => s.querySelector("h3")?.textContent ?? ""));
  }, [children]);

  // Filter the rows by the search text (after every render, so settings that change keep the filter).
  useLayoutEffect(() => {
    const q = query.trim().toLowerCase();
    let shown = 0;
    const found: number[] = [];
    for (const [index, section] of sections().entries()) {
      const title = section.querySelector("h3")?.textContent?.toLowerCase() ?? "";
      const all = !q || title.includes(q);
      let visible = 0;
      for (const row of rowsOf(section)) {
        const match = all || row.some((el) => el.textContent?.toLowerCase().includes(q));
        for (const el of row) el.style.display = match ? "" : "none";
        if (match) visible++;
      }
      section.style.display = visible ? "" : "none";
      if (visible) found.push(index);
      shown += visible;
    }
    setMatches(q ? shown : null);
    setWithMatches(q ? found.join(",") : "");
  });

  const onScroll = () => {
    const el = body.current;
    if (!el || Date.now() < pinnedUntil.current) return;
    const top = el.getBoundingClientRect().top;
    const all = sections();
    // The last section whose top has reached the top of the list (or the last one at the bottom).
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    let index = 0;
    all.forEach((s, i) => {
      if (s.getBoundingClientRect().top - top <= 24) index = i;
    });
    setCurrent(atEnd ? all.length - 1 : index);
  };

  const go = (index: number) => {
    const section = sections()[index];
    if (!section || !body.current) return;
    if (query) setQuery("");
    // The list is the sections' offset parent (position: relative).
    body.current.scrollTo({ top: section.offsetTop, behavior: "smooth" });
    setCurrent(index);
    pinnedUntil.current = Date.now() + 800;
    section.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
  };

  return (
    <div className="settings-layout">
      <div className="settings-side">
        <input
          className="text-input settings-search"
          type="search"
          placeholder="Search settings"
          aria-label="Search settings"
          aria-describedby="settings-search-status"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Escape clears the search first, then closes the dialog.
            if (e.key === "Escape" && query) {
              e.stopPropagation();
              setQuery("");
            }
          }}
        />
        <span className="sr-only" id="settings-search-status" role="status">
          {matches === null ? "" : matches ? `${matches} setting${matches === 1 ? "" : "s"} found` : "No settings found"}
        </span>
        <nav className="settings-nav" aria-label="Settings sections">
          {names.map((name, i) => {
            const searching = query.trim() !== "";
            const hasMatches = !searching || withMatches.split(",").includes(String(i));
            // While searching, the first section with matches is the current one.
            const isCurrent = searching ? withMatches.split(",")[0] === String(i) : i === current;
            return (
              <button
                key={name + i}
                type="button"
                className={[isCurrent && "current", !hasMatches && "no-match"].filter(Boolean).join(" ") || undefined}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => go(i)}
              >
                {name}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="settings-grid" ref={body} onScroll={onScroll}>
        {children}
        {matches === 0 && <p className="muted settings-no-match">No settings match “{query}”.</p>}
      </div>
    </div>
  );
}
