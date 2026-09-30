import { rehypeAlerts } from "./alerts";
import remarkGfm from "remark-gfm";
import remarkGemoji from "remark-gemoji";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Options } from "react-markdown";

/**
 * Preview security policy (FR-034, SEC-004):
 * raw HTML in documents is parsed, then sanitized with GitHub's allow-list
 * (rehype-sanitize's default schema). Scripts, event handlers, iframes, forms,
 * styles and `javascript:` URLs are removed. Syntax highlighting and heading
 * ids are added *after* sanitizing so they are not stripped.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Keep the classes remark-math uses to mark formulas.
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https", "data"],
  },
};

export interface MarkdownFeatures {
  /** `$inline$` and `$$display$$` LaTeX math, rendered as MathML. */
  math: boolean;
}

type HastNode = { type: string; children?: HastNode[] };

function hasRawHtml(node: HastNode): boolean {
  if (node.type === "raw") return true;
  return node.children?.some(hasRawHtml) ?? false;
}

/**
 * rehype-raw, skipped when the document has no inline or block HTML. It
 * re-parses the whole tree with an HTML parser, which is the costliest step
 * for long documents and changes nothing when there's no HTML to parse.
 */
function rehypeRawWhenNeeded() {
  const parseRaw = rehypeRaw();
  return (tree: HastNode, file: unknown) => (hasRawHtml(tree) ? parseRaw(tree as never, file as never) : undefined);
}

/**
 * The Markdown pipeline shared by the preview and exports. Math is rendered
 * by KaTeX to native MathML (no fonts or stylesheets needed) *after*
 * sanitizing, so it cannot be used to smuggle in unsafe markup.
 */
export function markdownPlugins(features: MarkdownFeatures = { math: true }) {
  // GitHub emoji shortcodes (:tada:) become emoji, as on GitHub.
  const remarkPlugins: NonNullable<Options["remarkPlugins"]> = [remarkGfm, remarkGemoji];
  // GitHub alerts (> [!NOTE]) are styled after sanitizing; they only add fixed class names.
  const rehypePlugins: NonNullable<Options["rehypePlugins"]> = [rehypeRawWhenNeeded, [rehypeSanitize, sanitizeSchema], rehypeAlerts];
  if (features.math) {
    remarkPlugins.push([remarkMath, { singleDollarTextMath: true }]);
    rehypePlugins.push([rehypeKatex, { output: "mathml", throwOnError: false, strict: "ignore", trust: false }]);
  }
  rehypePlugins.push([rehypeHighlight, { detect: false, plainText: ["mermaid", "math"] }], rehypeSlug);
  return { remarkPlugins, rehypePlugins };
}

const defaults = markdownPlugins();
export const remarkPlugins = defaults.remarkPlugins;
export const rehypePlugins = defaults.rehypePlugins;

export { classifyLink, type LinkTarget } from "./linkTarget";

export { countWords } from "./textStats";
