import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Settings with a section list beside them: the list is built from the
 * sections' headings, a click scrolls to that section, and the section in
 * view is highlighted. On narrow windows only the settings show.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  /** Until this time, scrolling doesn't change the highlight (a clicked section stays highlighted). */
  const pinnedUntil = useRef(0);

  const sections = () => [...(body.current?.querySelectorAll<HTMLElement>(":scope > section") ?? [])];

  useLayoutEffect(() => {
    setNames(sections().map((s) => s.querySelector("h3")?.textContent ?? ""));
  }, [children]);

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
    // The list is the sections' offset parent (position: relative).
    body.current.scrollTo({ top: section.offsetTop, behavior: "smooth" });
    setCurrent(index);
    pinnedUntil.current = Date.now() + 800;
    section.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
  };

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {names.map((name, i) => (
          <button key={name + i} type="button" className={i === current ? "current" : undefined} aria-current={i === current ? "true" : undefined} onClick={() => go(i)}>
            {name}
          </button>
        ))}
      </nav>
      <div className="settings-grid" ref={body} onScroll={onScroll}>
        {children}
      </div>
    </div>
  );
}
