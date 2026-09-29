import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Element, ElementContent, Root } from "hast";

/**
 * Long documents render their preview in chunks of top-level blocks. A chunk
 * builds its DOM only when it comes near the visible area (then stays), so a
 * pasted or opened long document shows quickly. Mounted chunks use
 * `display: contents`, so the layout is the same as without chunks.
 */

/** Documents with fewer top-level blocks than this render as one piece. */
export const CHUNK_MIN_BLOCKS = 150;
const BLOCKS_PER_CHUNK = 50;

/** Rough rendered height of a stretch of Markdown source, for placeholders. */
export function estimateHeight(source: string, blocks: number): number {
  let lines = 0;
  for (const line of source.split("\n")) lines += Math.max(1, Math.ceil(line.length / 100));
  return Math.round(lines * 18 + blocks * 12);
}

function countTasks(node: ElementContent | Root): number {
  if (!("children" in node)) return 0;
  let n = 0;
  for (const child of node.children) {
    if (child.type !== "element") continue;
    const classes = child.properties?.className;
    if (child.tagName === "li" && Array.isArray(classes) && classes.includes("task-list-item")) n++;
    n += countTasks(child);
  }
  return n;
}

/**
 * Rehype plugin: wraps runs of top-level blocks in `<section data-chunk>`
 * elements carrying an estimated height and the number of task list items
 * before them. Runs last, after sanitizing.
 */
export function rehypeChunks() {
  return (tree: Root, file: { value?: unknown }) => {
    const blocks = tree.children.filter((c) => c.type === "element");
    if (blocks.length < CHUNK_MIN_BLOCKS) return;
    const source = typeof file.value === "string" ? file.value : "";
    const chunks: Element[] = [];
    let current: ElementContent[] = [];
    let count = 0;
    let tasksBefore = 0;
    const flush = () => {
      if (!current.length) return;
      const first = current.find((c) => c.position)?.position?.start.offset ?? 0;
      const last = [...current].reverse().find((c) => c.position)?.position?.end.offset ?? first;
      const chunk: Element = {
        type: "element",
        tagName: "section",
        properties: { dataChunk: String(chunks.length), dataHeight: String(estimateHeight(source.slice(first, last), count)), dataTasksBefore: String(tasksBefore) },
        children: current,
      };
      tasksBefore += countTasks(chunk);
      chunks.push(chunk);
      current = [];
      count = 0;
    };
    for (const child of tree.children) {
      if (child.type === "doctype") continue;
      current.push(child as ElementContent);
      if (child.type === "element" && ++count >= BLOCKS_PER_CHUNK) flush();
    }
    flush();
    tree.children = chunks;
  };
}

const mountAllListeners = new Set<() => void>();

/**
 * Builds every chunk of the preview (for jumping to a heading or an anchor
 * that may not be rendered yet); resolves once they are in the page.
 */
export function mountAllChunks(): Promise<void> {
  if (!mountAllListeners.size) return Promise.resolve();
  for (const mount of [...mountAllListeners]) mount();
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/** One chunk: a sized placeholder until it nears the visible area. */
export function PreviewChunk({ index, height, tasksBefore, children }: { index: string; height: string; tasksBefore: string; children: ReactNode }) {
  // The first chunk is at the top, where the preview opens.
  const [mounted, setMounted] = useState(index === "0");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mounted) return;
    const mount = () => setMounted(true);
    mountAllListeners.add(mount);
    const el = ref.current;
    const root = el?.closest(".preview") ?? null;
    let observer: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && mount(), { root, rootMargin: "1500px 0px" });
      observer.observe(el);
    } else mount();
    return () => {
      mountAllListeners.delete(mount);
      observer?.disconnect();
    };
  }, [mounted]);
  return mounted ? (
    <div className="preview-chunk" data-tasks-before={tasksBefore}>
      {children}
    </div>
  ) : (
    <div ref={ref} className="preview-chunk pending" style={{ height: `${height}px` }} aria-hidden="true" />
  );
}
