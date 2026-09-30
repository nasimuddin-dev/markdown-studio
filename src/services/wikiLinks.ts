import GithubSlugger from "github-slugger";
import type { Link, PhrasingContent, Root, Text } from "mdast";
import { SKIP, visit } from "unist-util-visit";

/** `[[Page]]`, `[[Page|shown text]]`, `[[folder/Page#Heading]]`. */
export const WIKI_LINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g;

/**
 * Where a wiki link points: the page as a path relative to the document, with
 * `.md` added when it has no extension, and a heading as its GitHub anchor.
 */
export function wikiLinkHref(target: string): string {
  const [page, heading] = target.split("#", 2);
  const path = page.trim();
  const file = path ? (/\.[a-z0-9]+$/i.test(path) ? path : `${path}.md`) : "";
  const anchor = heading?.trim() ? `#${new GithubSlugger().slug(heading.trim())}` : "";
  return encodeURI(file).replace(/\(/g, "%28").replace(/\)/g, "%29") + anchor;
}

/** Remark plugin: turns wiki links in text into ordinary links (never inside code, which isn't text). */
export function remarkWikiLinks() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined || !node.value.includes("[[") || parent.type === "link") return;
      const parts: PhrasingContent[] = [];
      let last = 0;
      for (const m of node.value.matchAll(WIKI_LINK)) {
        if (m.index! > last) parts.push({ type: "text", value: node.value.slice(last, m.index) });
        const link: Link = { type: "link", url: wikiLinkHref(m[1]), children: [{ type: "text", value: (m[2] ?? m[1]).trim() }] };
        parts.push(link);
        last = m.index! + m[0].length;
      }
      if (!parts.length) return;
      if (last < node.value.length) parts.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      return [SKIP, index + parts.length];
    });
  };
}
