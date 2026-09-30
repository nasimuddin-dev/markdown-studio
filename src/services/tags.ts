/** An inline tag: `#word` after a space, `(` or at a line start, with at least one letter (not `#1`, not a heading). */
export const INLINE_TAG = /(?<=^|[\s(])#([\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*)/gu;

/** Splits text into plain parts and inline `#tags` (for exports that style tags). */
export function splitTags(text: string): Array<{ text: string; tag: boolean }> {
  if (!text.includes("#")) return [{ text, tag: false }];
  const parts: Array<{ text: string; tag: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_TAG)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), tag: false });
    parts.push({ text: m[0], tag: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), tag: false });
  return parts;
}

/** The colour exports use for tags (the preview's note blue). */
export const TAG_COLOR = "0969DA";

interface HNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
}

/** Elements whose text is never a tag. */
const SKIP = new Set(["a", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "script", "style", "math", "svg"]);

function transform(node: HNode) {
  if (!node.children || (node.tagName && SKIP.has(node.tagName))) return;
  node.children = node.children.flatMap((child): HNode[] => {
    if (child.type !== "text" || !child.value?.includes("#")) {
      transform(child);
      return [child];
    }
    const text = child.value;
    const parts: HNode[] = [];
    let last = 0;
    for (const m of text.matchAll(INLINE_TAG)) {
      if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
      parts.push({ type: "element", tagName: "span", properties: { className: ["md-tag"] }, children: [{ type: "text", value: m[0] }] });
      last = m.index + m[0].length;
    }
    if (!parts.length) return [child];
    if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
    return parts;
  });
}

/**
 * Rehype plugin: wraps inline `#tags` in `span.md-tag`, outside links, code
 * and headings. It runs after sanitizing and only adds a fixed class name.
 */
export function rehypeTags() {
  return (tree: HNode) => transform(tree);
}
