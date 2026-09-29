import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { activeDoc, useDocuments } from "../stores/documentsStore";
import { useUi } from "../stores/uiStore";
import { splitSlides } from "../features/slides";
import { getEditorView } from "../features/editorBridge";
import { followPreviewLink, MarkdownView } from "./Preview";

/**
 * View → Present as Slides: the active document as full-window slides.
 * Arrow keys, Space, Page Up/Down, Home and End move between slides; Esc
 * ends the show. Clicking a slide goes to the next one.
 */
export function SlideShow() {
  const setPresenting = useUi((s) => s.setPresenting);
  const text = useDocuments((s) => s.docs.find((d) => d.id === s.activeId)?.content ?? "");
  const docPath = activeDoc()?.path ?? null;
  const slides = useMemo(() => splitSlides(text), [text]);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, slides.length - 1);
  const ref = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    // Back to where the show was started from (the editor, if that was a menu that has closed).
    return () => (previous?.isConnected ? previous.focus() : getEditorView()?.focus());
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
        <MarkdownView text={slides[current]} docPath={docPath} />
      </article>
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
        <button className="button small" onClick={() => setPresenting(false)}>
          End Show (Esc)
        </button>
      </div>
    </div>
  );
}
