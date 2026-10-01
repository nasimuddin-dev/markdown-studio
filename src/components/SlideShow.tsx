import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { activeDoc, useDocuments } from "../stores/documentsStore";
import { useUi } from "../stores/uiStore";
import { splitNotes, splitSlides } from "../features/slides";
import { rememberFocus } from "../features/editorBridge";
import { followPreviewLink, MarkdownView } from "./Preview";

/**
 * View → Present as Slides: the active document as full-window slides.
 * Arrow keys, Space, Page Up/Down, Home and End move between slides; Esc
 * ends the show. Clicking a slide goes to the next one. N shows or hides the
 * speaker notes (text after a "Note:" line on a slide).
 */
export function SlideShow() {
  const setPresenting = useUi((s) => s.setPresenting);
  const text = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content ?? "");
  const docPath = activeDoc()?.path ?? null;
  const slides = useMemo(() => splitSlides(text).map(splitNotes), [text]);
  const hasNotes = slides.some((sl) => sl.notes);
  const [showNotes, setShowNotes] = useState(false);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, slides.length - 1);
  const ref = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const restore = rememberFocus();
    ref.current?.focus();
    return restore;
  }, []);

  useEffect(() => {
    const go = (i: number) => setIndex(Math.max(0, Math.min(slides.length - 1, i)));
    const onKey = (e: KeyboardEvent) => {
      const keys: Record<string, () => void> = {
        Escape: () => setPresenting(false),
        ArrowRight: () => go(current + 1),
        ArrowDown: () => go(current + 1),
        PageDown: () => go(current + 1),
        " ": () => go(current + (e.shiftKey ? -1 : 1)),
        ArrowLeft: () => go(current - 1),
        ArrowUp: () => go(current - 1),
        PageUp: () => go(current - 1),
        Home: () => go(0),
        End: () => go(slides.length - 1),
        n: () => setShowNotes((v) => !v),
        N: () => setShowNotes((v) => !v),
      };
      const action = keys[e.key];
      if (!action || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      action();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [current, slides.length, setPresenting]);

  useEffect(() => {
    slideRef.current?.scrollTo?.({ top: 0 });
  }, [current]);

  const onClick = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor) {
      e.preventDefault();
      if (slideRef.current) await followPreviewLink(anchor, docPath, slideRef.current);
      return;
    }
    if (target.closest("button, input, summary")) return;
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  };

  return (
    <div className="slideshow" role="dialog" aria-modal="true" aria-label="Slide show" tabIndex={-1} ref={ref} onClick={onClick}>
      <article className="markdown-body slide" ref={slideRef} key={current} aria-roledescription="slide">
        <MarkdownView text={slides[current].body} docPath={docPath} />
      </article>
      {showNotes && (
        <aside className="slide-notes" aria-label="Speaker notes">
          {slides[current].notes ? <MarkdownView text={slides[current].notes} docPath={docPath} /> : <p className="muted">No notes for this slide.</p>}
        </aside>
      )}
      <div className="slideshow-bar">
        <button className="button small" onClick={() => setIndex(current - 1)} disabled={current === 0} aria-label="Previous slide">
          ‹
        </button>
        <span aria-live="polite">
          Slide {current + 1} of {slides.length}
        </span>
        <button className="button small" onClick={() => setIndex(current + 1)} disabled={current >= slides.length - 1} aria-label="Next slide">
          ›
        </button>
        {hasNotes && (
          <button className="button small" aria-pressed={showNotes} onClick={() => setShowNotes(!showNotes)}>
            Notes (N)
          </button>
        )}
        <button className="button small" onClick={() => setPresenting(false)}>
          End Show (Esc)
        </button>
      </div>
    </div>
  );
}
