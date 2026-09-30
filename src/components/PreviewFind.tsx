import { useEffect, useRef, useState, type RefObject } from "react";
import { useUi } from "../stores/uiStore";
import { Icon } from "./Icon";
import { mountAllChunks } from "./PreviewChunks";

/** At most this many matches are found and highlighted. */
const MAX_MATCHES = 1000;

/**
 * Ranges of the visible text under `root` that match `query` (ignoring case).
 * Text in buttons and hidden elements (such as the code blocks' Copy button)
 * doesn't count.
 */
export function findTextRanges(root: HTMLElement, query: string, limit = MAX_MATCHES): Range[] {
  if (!query) return [];
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("button, .sr-only, [aria-hidden='true'], style, script") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text);
    starts.push(text.length);
    text += (n as Text).data;
  }
  // Lower-casing can change the length of a few characters; then match case exactly.
  const lower = text.toLocaleLowerCase();
  const haystack = lower.length === text.length ? lower : text;
  const needle = lower.length === text.length ? query.toLocaleLowerCase() : query;
  const nodeAt = (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const ranges: Range[] = [];
  for (let at = haystack.indexOf(needle); at >= 0 && ranges.length < limit; at = haystack.indexOf(needle, at + needle.length)) {
    const a = nodeAt(at);
    const b = nodeAt(at + needle.length - 1);
    const range = document.createRange();
    range.setStart(nodes[a], at - starts[a]);
    range.setEnd(nodes[b], at + needle.length - starts[b]);
    ranges.push(range);
  }
  return ranges;
}

type HighlightRegistry = Map<string, unknown>;
const highlights = (): HighlightRegistry | null => (typeof CSS !== "undefined" && "highlights" in CSS ? (CSS as unknown as { highlights: HighlightRegistry }).highlights : null);
const HighlightClass = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;

function paint(all: Range[], current: Range | null) {
  const registry = highlights();
  if (!registry || !HighlightClass) return false;
  registry.set("preview-find", new HighlightClass(...all));
  if (current) registry.set("preview-find-current", new HighlightClass(current));
  else registry.delete("preview-find-current");
  return true;
}

function clearPaint() {
  highlights()?.delete("preview-find");
  highlights()?.delete("preview-find-current");
}

/** Find in the preview (Ctrl/Cmd+F while the preview is shown alone or has focus). */
export function PreviewFind({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const token = useUi((s) => s.previewFindToken);
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [current, setCurrent] = useState(0);
  const [generation, setGeneration] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Opening (again) focuses the field; everything is built so it can be searched.
  useEffect(() => {
    mountAllChunks();
    input.current?.focus();
    input.current?.select();
  }, [token]);

  // Search again when the preview changes (typing in the editor, another tab).
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setGeneration((g) => g + 1), 200);
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [container]);

  useEffect(() => {
    const el = container.current;
    const found = el ? findTextRanges(el, query) : [];
    setRanges(found);
    setCurrent((c) => (c < found.length ? c : 0));
  }, [query, generation, container]);

  useEffect(() => {
    const range = ranges[current] ?? null;
    const painted = paint(ranges, range);
    const el = container.current;
    if (!range || !el) return;
    // Without the highlight API (older WebKit), the current match is selected instead,
    // unless typing in the field (a selection elsewhere would take the typing away).
    if (!painted && document.activeElement !== input.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    const rect = range.getBoundingClientRect?.();
    const box = el.getBoundingClientRect();
    if (rect && (rect.top < box.top + 40 || rect.bottom > box.bottom - 20)) el.scrollTop += rect.top - box.top - el.clientHeight / 3;
  }, [ranges, current, container]);

  useEffect(() => clearPaint, []);

  const move = (step: number) => ranges.length && setCurrent((c) => (c + step + ranges.length) % ranges.length);
  const close = () => {
    clearPaint();
    useUi.getState().setPreviewFind(false);
    container.current?.focus();
  };

  return (
    <div className="preview-find" role="search" aria-label="Find in preview">
      <input
        ref={input}
        type="search"
        aria-label="Find in preview"
        placeholder="Find in preview"
        value={query}
        spellCheck={false}
        onChange={(e) => {
          setQuery(e.target.value);
          setCurrent(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            move(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
      />
      <span className="preview-find-count" role="status" aria-live="polite">
        {query ? (ranges.length ? `${current + 1} of ${ranges.length}${ranges.length >= MAX_MATCHES ? "+" : ""}` : "No results") : ""}
      </span>
      <button className="icon-button small" title="Previous match (Shift+Enter)" aria-label="Previous match" onClick={() => move(-1)} disabled={!ranges.length}>
        <Icon name="chevronDown" size={15} className="flip" />
      </button>
      <button className="icon-button small" title="Next match (Enter)" aria-label="Next match" onClick={() => move(1)} disabled={!ranges.length}>
        <Icon name="chevronDown" size={15} />
      </button>
      <button className="icon-button small" title="Close (Escape)" aria-label="Close find" onClick={close}>
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
