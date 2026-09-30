import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Nodes, Parents, PhrasingContent, RootContent } from "mdast";
import { stripFrontMatter } from "../frontMatter";

/** The text of inline content: link and emphasis text, image alt text, code as written. */
function inline(nodes: PhrasingContent[]): string {
  return nodes
    .map((n): string => {
      switch (n.type) {
        case "text":
        case "inlineCode":
          return n.value;
        case "inlineMath" as string:
          return (n as unknown as { value: string }).value;
        case "break":
          return "\n";
        case "image":
          return n.alt ?? "";
        case "html":
          return n.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
        case "footnoteReference":
          return `[${n.label ?? n.identifier}]`;
        default:
          return "children" in n ? inline((n as Parents).children as PhrasingContent[]) : "";
      }
    })
    .join("");
}

const indentLines = (text: string, prefix: string) => text.split("\n").map((l, i) => (i === 0 || !l ? l : prefix + l)).join("\n");

function block(node: RootContent): string {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return inline(node.children);
    case "code":
      return node.value;
    case "math" as string:
      return (node as unknown as { value: string }).value;
    case "blockquote":
      return node.children.map((c) => block(c)).join("\n\n");
    case "list": {
      const start = node.start ?? 1;
      return node.children
        .map((item, i) => {
          const marker = typeof item.checked === "boolean" ? (item.checked ? "☑ " : "☐ ") : node.ordered ? `${start + i}. ` : "• ";
          const body = item.children.map((c) => block(c)).join(item.spread ? "\n\n" : "\n");
          return marker + indentLines(body, " ".repeat(marker.length));
        })
        .join(node.spread ? "\n\n" : "\n");
    }
    case "table":
      return node.children.map((row) => row.children.map((cell) => inline(cell.children)).join("\t")).join("\n");
    case "thematicBreak":
      return "—";
    case "html":
      return node.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    case "definition":
      return "";
    case "footnoteDefinition":
      return `[${node.label ?? node.identifier}] ${node.children.map((c) => block(c)).join(" ")}`;
    default:
      return "children" in node ? (node as Parents).children.map((c) => block(c as RootContent)).join("\n\n") : "";
  }
}

/**
 * Markdown as plain text, for places that show neither Markdown nor
 * formatting: no `#`, `**` or link addresses; list bullets and numbers,
 * checkboxes (☐ ☑) and tab-separated table cells stay. Front matter is left out.
 */
export function markdownToPlainText(markdown: string): string {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(stripFrontMatter(markdown)) as Nodes & { children: RootContent[] };
  return tree.children
    .map((n) => block(n))
    .filter((t) => t.trim())
    .join("\n\n")
    .concat("\n");
}
