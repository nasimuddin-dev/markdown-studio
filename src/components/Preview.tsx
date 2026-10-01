import { memo, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import { markdownPlugins } from "../services/markdown";
import { splitFrontMatter } from "../services/frontMatter";
import { MermaidDiagram } from "./MermaidDiagram";
import { backend } from "../services";
import { resolveRelative } from "../services/paths";
import { LruCache } from "../services/lruCache";
import { IMAGE_CACHE_BYTES, LARGE_DOCUMENT_CHARS } from "../services/limits";
import { useDocuments } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";
import { copyText } from "../features/pathActions";
import { scrollSync } from "../features/scrollSync";
import { openLink } from "../features/followLink";
import { revealLineAt } from "../features/editorBridge";
import { lineForTop, rehypeSourceLines, topForLine } from "../services/sourceLines";
import { toggleTaskInDocument } from "../features/tasks";
import { mountAllChunks, PreviewChunk, rehypeChunks } from "./PreviewChunks";
import { PreviewFind } from "./PreviewFind";
import { useUi } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { Icon } from "./Icon";

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

/**
 * react-markdown drops every `data:` address; pictures embedded as
 * `data:image/…` (an import opened without saving, a pasted inline image) are
 * safe in an <img> and are kept. Links and everything else keep the default rule.
 */
function previewUrl(url: string, key: string, node: { tagName?: string }): string {
  if (key === "src" && node.tagName === "img" && /^data:image\/[a-z0-9.+-]+[;,]/i.test(url)) return url;
  return defaultUrlTransform(url);
}

/** Decoded local pictures (data URLs), bounded so a long session with many pictures doesn't keep growing. */
const imageCache = new LruCache<string>(IMAGE_CACHE_BYTES, (dataUrl) => dataUrl.length);

/** Loads images referenced with a relative/local path through the backend. */
function LocalImage({ src, alt, title, docPath }: { src?: string; alt?: string; title?: string; docPath: string | null }) {
  const remote = !src || /^(https?:|data:)/i.test(src);
  const web = !!src && /^https?:/i.test(src);
  const webImages = useSettings((s) => s.settings.previewRemoteImages);
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

  if (web && !webImages) {
    // No request leaves the computer for a document's web pictures (Settings → Preview).
    return (
      <span className="preview-missing-image" title={src}>
        🖼 {alt || src} (pictures from the web are off in Settings → Preview)
      </span>
    );
  }
  if (remote) return <img src={src} alt={alt ?? ""} title={title} loading="lazy" />;
  if (!resolved || failed) {
    return (
      <span className="preview-missing-image" title={src}>
        🖼 {alt || src} {docPath ? "(image not found)" : "(save the document to show local images)"}
      </span>
    );
  }
  return url ? <img src={url} alt={alt ?? ""} title={title} data-path={resolved} className="preview-local-image" /> : <span className="preview-missing-image">Loading image…</span>;
}

/** Returns the text of a mermaid code block if this <pre> holds one. */
function mermaidSource(node: unknown): string | null {
  type HastLike = { tagName?: string; properties?: { className?: unknown }; children?: Array<{ value?: string }> };
  const code = (node as { children?: HastLike[] } | undefined)?.children?.[0];
  const classes = code?.properties?.className;
  if (code?.tagName !== "code" || !Array.isArray(classes) || !classes.includes("language-mermaid")) return null;
  return (code.children ?? []).map((c) => c.value ?? "").join("");
}

/**
 * A heading with a link icon on hover that copies its `#anchor`. Mouse only
 * (hidden from assistive technology, so the heading's name stays its text);
 * the Outline's Copy Link to Heading does the same from the keyboard.
 */
function Heading({ level, id, children, ...rest }: ComponentProps<"h1"> & { level: number }) {
  const Tag = `h${level}` as "h1";
  const anchor = typeof id === "string" ? id.replace(/^user-content-/, "") : "";
  return (
    <Tag id={id} {...rest}>
      {children}
      {anchor && (
        <span className="heading-anchor" aria-hidden="true" title="Copy link to this heading" onClick={() => void copyText(`#${anchor}`, "Link")}>
          <Icon name="link" size={14} />
        </span>
      )}
    </Tag>
  );
}

/** A code block with a Copy button (shown on hover or keyboard focus). */
function CodeBlock({ line, ...props }: ComponentProps<"pre"> & { line?: string }) {
  const pre = useRef<HTMLPreElement>(null);
  return (
    <div className="code-block" data-line={line}>
      <pre ref={pre} {...props} />
      <button
        type="button"
        className="code-copy"
        title="Copy code"
        aria-label="Copy code"
        onClick={() => void copyText(pre.current?.textContent?.replace(/\n$/, "") ?? "", "Code")}
      >
        Copy
      </button>
    </div>
  );
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
    return { ...base, rehypePlugins: [...base.rehypePlugins, rehypeSourceLines, rehypeChunks] };
  }, [renderMath]);
  const frontMatter = useMemo(() => splitFrontMatter(text), [text]);
  const components = useMemo<Components>(
    () => ({
      pre: ({ node, children, ...rest }) => {
        const source = renderDiagrams ? mermaidSource(node) : null;
        // The source line goes on the outermost element, like other top-level blocks.
        const { "data-line": line, ...props } = rest as typeof rest & { "data-line"?: string };
        return source !== null ? (
          <div data-line={line}>
            <MermaidDiagram code={source} />
          </div>
        ) : (
          <CodeBlock line={line} {...props}>
            {children}
          </CodeBlock>
        );
      },
      h1: ({ node: _n, ...p }) => <Heading level={1} {...p} />,
      h2: ({ node: _n, ...p }) => <Heading level={2} {...p} />,
      h3: ({ node: _n, ...p }) => <Heading level={3} {...p} />,
      h4: ({ node: _n, ...p }) => <Heading level={4} {...p} />,
      h5: ({ node: _n, ...p }) => <Heading level={5} {...p} />,
      h6: ({ node: _n, ...p }) => <Heading level={6} {...p} />,
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
          <PreviewChunk
            index={chunk}
            height={String(node!.properties.dataHeight)}
            tasksBefore={String(node!.properties.dataTasksBefore)}
            line={node!.properties.dataLine === undefined ? undefined : String(node!.properties.dataLine)}
          >
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
      <ReactMarkdown remarkPlugins={plugins.remarkPlugins} rehypePlugins={plugins.rehypePlugins} components={components} urlTransform={previewUrl}>
        {frontMatter ? frontMatter.body : text}
      </ReactMarkdown>
    </>
  );
});

/** Above this size the live preview pauses until the user asks for a render (NFR-002). */
export { LARGE_DOCUMENT_CHARS };

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
    <article className="markdown-body" key={generation} data-lines={lineCount(debounced)}>
      <MarkdownView text={debounced} docPath={docPath} />
    </article>
  );
}

function lineCount(text: string): number {
  let n = 1;
  for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) n++;
  return n;
}

/**
 * The preview's top-level blocks as scroll anchors (source line and top in
 * pixels within the scrolled content), ending with the end of the document;
 * null when there are none (an empty or paused preview).
 */
function previewBlocks(el: HTMLElement) {
  const article = el.querySelector<HTMLElement>(":scope > article[data-lines]");
  if (!article) return null;
  const blocks = article.querySelectorAll<HTMLElement>(":scope > [data-line], :scope > .preview-chunk > [data-line], :scope > .preview-chunk[data-line]");
  if (!blocks.length) return null;
  const base = el.getBoundingClientRect().top - el.scrollTop;
  const end = { line: Number(article.dataset.lines) + 1, top: el.scrollHeight };
  return {
    count: blocks.length + 1,
    anchor: (i: number) => (i < blocks.length ? { line: Number(blocks[i].dataset.line), top: blocks[i].getBoundingClientRect().top - base } : end),
  };
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
  await openLink(anchor.getAttribute("data-href") ?? anchor.getAttribute("href") ?? "", docPath, (id) => {
    mountAllChunks();
    const el = container.querySelector(`[id="${CSS.escape(id)}"], [id="user-content-${CSS.escape(id)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
      const blocks = previewBlocks(el);
      scrollSync.emit("preview", { ratio: max > 0 ? el.scrollTop / max : 0, line: blocks && lineForTop(blocks.count, blocks.anchor, el.scrollTop) });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const off = scrollSync.on("editor", ({ ratio, line }) => {
      const max = el.scrollHeight - el.clientHeight;
      // The very top and bottom stay aligned; in between, the same source line goes to the top.
      const blocks = line !== null && ratio > 0 && ratio < 1 ? previewBlocks(el) : null;
      el.scrollTop = (blocks && line !== null ? topForLine(blocks.count, blocks.anchor, line) : null) ?? ratio * max;
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
    // A local picture (not inside a link) opens at full size.
    if (clicked instanceof HTMLImageElement && clicked.dataset.path && !clicked.closest("a")) {
      useUi.getState().setImagePreview(clicked.dataset.path, false);
      return;
    }
    // A #tag lists where else it's used in the folder.
    if (clicked.classList.contains("md-tag") && !clicked.closest("a") && useWorkspace.getState().root) {
      useUi.getState().openTagPicker(clicked.textContent ?? "");
      return;
    }
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || !ref.current) return;
    e.preventDefault();
    await followPreviewLink(anchor, docPath, ref.current);
  };

  /** In split view, a double-click shows the block's source in the editor, at the same height. */
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (useSettings.getState().settings.viewMode !== "split" || !ref.current) return;
    const block = (e.target as HTMLElement).closest<HTMLElement>("[data-line]");
    if (!block || !ref.current.contains(block) || (e.target as HTMLElement).closest("a, button, input")) return;
    const top = block.getBoundingClientRect().top - ref.current.getBoundingClientRect().top;
    // The preview stays where it is while the editor scrolls to the line.
    scrollSync.hold("preview");
    revealLineAt(Number(block.dataset.line), Math.min(top, ref.current.clientHeight - 40));
  };

  const finding = useUi((s) => s.previewFind);
  return (
    <>
      {finding && <PreviewFind container={ref} />}
      <div className="preview" ref={ref} onClick={onClick} onDoubleClick={onDoubleClick} role="document" aria-label="Markdown preview" tabIndex={0}>
        {doc ? <DebouncedMarkdown key={doc.id} text={doc.content} docPath={docPath} /> : <article className="markdown-body" />}
      </div>
    </>
  );
}
