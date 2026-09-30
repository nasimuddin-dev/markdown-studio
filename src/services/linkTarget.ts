/**
 * How a followed link is handled (preview clicks, Ctrl/Cmd+click in the
 * editor). Kept apart from the Markdown pipeline so the editor can use it
 * without loading the renderer.
 */
export type LinkTarget =
  | { type: "anchor"; id: string }
  | { type: "external"; url: string }
  | { type: "document"; href: string }
  | { type: "blocked" };

export function classifyLink(href: string | undefined | null): LinkTarget {
  if (!href) return { type: "blocked" };
  const h = href.trim();
  if (h.startsWith("#")) return { type: "anchor", id: decodeURIComponent(h.slice(1)) };
  if (/^(https?:|mailto:)/i.test(h)) return { type: "external", url: h };
  // Any other scheme (javascript:, file:, data:, custom) is refused.
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) && !/^[a-zA-Z]:[\\/]/.test(h)) return { type: "blocked" };
  return { type: "document", href: h };
}
