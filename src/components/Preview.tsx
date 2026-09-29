import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { classifyLink, markdownPlugins } from "../services/markdown";
import { splitFrontMatter } from "../services/frontMatter";
import { MermaidDiagram } from "./MermaidDiagram";
import { backend } from "../services";
import { describeError } from "../services/errors";
import { isMarkdownPath, resolveRelative } from "../services/paths";
import { notify } from "../stores/uiStore";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { openPath } from "../features/documents";
import { scrollSync } from "../features/scrollSync";
import { toggleTaskInDocument } from "../features/tasks";
import { mountAllChunks, PreviewChunk, rehypeChunks } from "./PreviewChunks";

/** The position of a task checkbox among the document's task list items, or -1. */
function taskIndex(root: HTMLElement, box: HTMLInputElement): number {
  // In a long document only some chunks are rendered; each knows how many tasks come before it.
  const chunk = box.closest<HTMLElement>(".preview-chunk");
  const scope = chunk ?? root;
  const boxes = [...scope.querySelectorAll<HTMLLIElement>("li.task-list-item")].map((li) =>
    li.querySelector<HTMLInputElement>(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]'),
  );
  const i = boxes.indexOf(box);
  return i < 0 ? -1 : i + Number(chunk?.dataset.tasksBefore ?? 0);
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (ms <= 0) {
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const imageCache = new Map<string, string>();

/** Loads images referenced with a relative/local path through the backend. */
function LocalImage({ src, alt, title, docPath }: { src?: string; alt?: string; title?: string; docPath: string | null }) {
  const remote = !src || /^(https?:|data:)/i.test(src);
  const resolved = !remote && docPath ? resolveRelative(docPath, src!) : null;
  const [url, setUrl] = useState<string | null>(() => (resolved ? imageCache.get(resolved) ?? null : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!resolved) return;
    const cached = imageCache.get(resolved);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    setFailed(false);
    backend()
      .readImage(resolved)
      .then((data) => {
        imageCache.set(resolved, data);
        if (!cancelled) setUrl(data);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [resolved]);

  if (remote) return <img src={src} alt={alt ?? ""} title={title} loading="lazy" />;
  if (!resolved || failed) {
    return (
      <span className="preview-missing-image" title={src}>
        🖼 {alt || src} {docPath ? "(image not found)" : "(save the document to show local images)"}
      </span>
    );
  }
  return url ? <img src={url} alt={alt ?? ""} title={title} /> : <span className="preview-missing-image">Loading image…</span>;
}

/** Returns the text of a mermaid code block if this <pre> holds one. */
function mermaidSource(node: unknown): string | null {
  type HastLike = { tagName?: string; properties?: { className?: unknown }; children?: Array<{ value?: string }> };
  const code = (node as { children?: HastLike[] } | undefined)?.children?.[0];
  const classes = code?.properties?.className;
  if (code?.tagName !== "code" || !Array.isArray(classes) || !classes.includes("language-mermaid")) return null;
  return (code.children ?? []).map((c) => c.value ?? "").join("");
}

/** Document metadata (YAML front matter), shown like GitHub does: a key/value table. */
function FrontMatterTable({ entries }: { entries: Array<[string, string]> }) {
  return (
    <table className="front-matter" aria-label="Document metadata">
      <tbody>
        {entries.map(([key, value], i) => (
          <tr key={i}>
            <th scope="row">{key}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const MarkdownView = memo(function MarkdownView({ text, docPath }: { text: string; docPath: string | null }) {
  const renderMath = useSettings((s) => s.settings.renderMath);
  const renderDiagrams = useSettings((s) => s.settings.renderDiagrams);
  const plugins = useMemo(() => {
    const base = markdownPlugins({ math: renderMath });
    return { ...base, rehypePlugins: [...base.rehypePlugins, rehypeChunks] };
  }, [renderMath]);
  const frontMatter = useMemo(() => splitFrontMatter(text), [text]);
  const components = useMemo<Components>(
    () => ({
      pre: ({ node, children, ...rest }) => {
        const source = renderDiagrams ? mermaidSource(node) : null;
        return source !== null ? <MermaidDiagram code={source} /> : <pre {...rest}>{children}</pre>;
      },
      img: ({ src, alt, title }) => (
        <LocalImage src={typeof src === "string" ? src : undefined} alt={alt} title={title} docPath={docPath} />
      ),
      input: ({ node: _node, checked, ...props }) =>
        props.type === "checkbox" ? (
          // Enabled so it can be clicked; the click toggles the task in the source, and the
          // re-render (keyed on the state) shows the result.
          <input
            {...props}
            key={String(!!checked)}
            defaultChecked={!!checked}
            disabled={false}
            aria-label={checked ? "Completed task" : "Open task"}
          />
        ) : (
          <input {...props} />
        ),
      section: ({ node, children, ...rest }) => {
        const chunk = node?.properties?.dataChunk;
        if (typeof chunk !== "string") return <section {...rest}>{children}</section>;
        return (
          <PreviewChunk index={chunk} height={String(node!.properties.dataHeight)} tasksBefore={String(node!.properties.dataTasksBefore)}>
            {children}
          </PreviewChunk>
        );
      },
      a: ({ href, children, title }) => (
        <a href={href} title={title ?? href} data-href={href}>
          {children}
        </a>
      ),
    }),
    [docPath, renderDiagrams],
  );
  return (
    <>
      {frontMatter && frontMatter.entries.length > 0 && <FrontMatterTable entries={frontMatter.entries} />}
      <ReactMarkdown remarkPlugins={plugins.remarkPlugins} rehypePlugins={plugins.rehypePlugins} components={components}>
        {frontMatter ? frontMatter.body : text}
      </ReactMarkdown>
    </>
  );
});

/** Above this size the live preview pauses until the user asks for a render (NFR-002). */
export const LARGE_DOCUMENT_CHARS = 1_000_000;

/** Debounces preview updates (FR-031); keyed per document so tab switches render immediately. */
function DebouncedMarkdown({ text, docPath }: { text: string; docPath: string | null }) {
  const debounceMs = useSettings((s) => s.settings.previewDebounceMs);
  const large = text.length > LARGE_DOCUMENT_CHARS;
  // Large documents render on demand: re-rendering on every keystroke would lag typing.
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const debounced = useDebounced(large ? "" : text, debounceMs);
  const generation = useBulkChangeGeneration(large ? snapshot ?? "" : debounced);
  if (large) {
    const mb = (text.length / 1_000_000).toFixed(1);
    return (
      <article className="markdown-body" key={generation}>
        <div className="preview-paused" role="status">
          <span>Live preview is paused for large documents ({mb} MB of text) to keep typing fast.</span>
          <button className="button" onClick={() => setSnapshot(text)}>
            {snapshot === null ? "Render Now" : "Refresh Preview"}
          </button>
        </div>
        {snapshot !== null && <MarkdownView text={snapshot} docPath={docPath} />}
      </article>
    );
  }
  return (
    <article className="markdown-body" key={generation}>
      <MarkdownView text={debounced} docPath={docPath} />
    </article>
  );
}

/** A jump in length this big (a paste, a reload) re-creates the preview instead of updating it. */
const BULK_CHANGE_CHARS = 20_000;

/**
 * Counts bulk changes of the text. Keying the preview on it makes React build
 * thousands of new blocks off-document and insert them at once; inserting them
 * one by one into the existing preview costs quadratic time (seconds for a
 * few hundred KB).
 */
function useBulkChangeGeneration(text: string): number {
  const state = useRef({ length: text.length, generation: 0 });
  if (Math.abs(text.length - state.current.length) >= BULK_CHANGE_CHARS) state.current.generation++;
  state.current.length = text.length;
  return state.current.generation;
}

/**
 * Follows a link clicked in rendered Markdown without ever navigating the app
 * window (SEC-005): `#anchors` scroll within `container`, web links open in
 * the browser, links to Markdown files open in a tab.
 */
export async function followPreviewLink(anchor: HTMLAnchorElement, docPath: string | null, container: HTMLElement) {
  const target = classifyLink(anchor.getAttribute("data-href") ?? anchor.getAttribute("href"));
  switch (target.type) {
    case "anchor": {
      mountAllChunks();
      const el = container.querySelector(`[id="${CSS.escape(target.id)}"], [id="user-content-${CSS.escape(target.id)}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "external":
      try {
        await backend().openExternal(target.url);
      } catch (err) {
        notify("error", describeError(err, "open the link"));
      }
      break;
    case "document": {
      const resolved = docPath ? resolveRelative(docPath, target.href) : null;
      if (resolved && isMarkdownPath(resolved)) await openPath(resolved);
      else notify("info", "Only links to Markdown documents and web pages can be opened from the preview.");
      break;
    }
    case "blocked":
      notify("warning", "This link type is blocked for your safety.");
      break;
  }
}

export function Preview() {
  const doc = useDocuments((s) => s.docs.find((d) => d.id === s.activeId));
  const docPath = doc?.path ?? null;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      scrollSync.emit("preview", max > 0 ? el.scrollTop / max : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const off = scrollSync.on("editor", (ratio) => {
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
    });
    return () => {
      el.removeEventListener("scroll", onScroll);
      off();
    };
  }, []);

  /** Links never navigate the app window (SEC-005). */
  const onClick = async (e: MouseEvent<HTMLDivElement>) => {
    const clicked = e.target as HTMLElement;
    if (clicked instanceof HTMLInputElement && clicked.type === "checkbox" && doc && ref.current) {
      // The re-rendered preview shows the new state; never let the box drift from the source.
      e.preventDefault();
      const index = taskIndex(ref.current, clicked);
      if (index >= 0) toggleTaskInDocument(doc.id, index);
      return;
    }
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || !ref.current) return;
    e.preventDefault();
    await followPreviewLink(anchor, docPath, ref.current);
  };

  return (
    <div className="preview" ref={ref} onClick={onClick} role="document" aria-label="Markdown preview" tabIndex={0}>
      {doc ? <DebouncedMarkdown key={doc.id} text={doc.content} docPath={docPath} /> : <article className="markdown-body" />}
    </div>
  );
}
