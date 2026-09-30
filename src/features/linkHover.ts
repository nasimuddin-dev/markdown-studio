import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { backend } from "../services";
import { isMarkdownPath, resolveRelative } from "../services/paths";
import { activeDoc, useDocuments } from "../stores/documentsStore";
import { findAllLinks } from "./lint";
import { anchorLine } from "./followLink";

/** The link to another Markdown document at `pos` (inline, reference definition, HTML or wiki), if any. */
export function documentLinkAt(text: string, pos: number): { from: number; to: number; target: string } | null {
  for (const link of findAllLinks(text)) {
    if (pos < link.from || pos > link.to || link.image || !link.target || link.target.startsWith("#")) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(link.target) && !/^[a-z]:[\\/]/i.test(link.target)) continue;
    if (isMarkdownPath(link.target.split(/[?#]/)[0])) return { from: link.from, to: link.to, target: link.target };
  }
  return null;
}

/**
 * A short plain-text excerpt of a document for a hover preview: from the
 * heading an anchor names (else the top, after front matter), about `max`
 * characters, with the Markdown syntax that matters most stripped.
 */
export function excerpt(text: string, anchor: string | null, max = 400): string {
  const lines = text.replace(/^---\r?\n[\s\S]*?\n(---|\.\.\.)[ \t]*\r?\n/, "").split("\n");
  let start = 0;
  if (anchor) {
    const line = anchorLine(lines.join("\n"), anchor);
    if (line) start = line - 1;
  }
  let out = "";
  let gap = "";
  for (const line of lines.slice(start)) {
    const clean = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    // Lines of a paragraph join with spaces; paragraphs and headings go on their own lines.
    if (!clean || /^#{1,6}\s/.test(line)) gap = out ? "\n" : "";
    if (!clean) continue;
    out += (out ? gap || " " : "") + clean;
    gap = /^#{1,6}\s/.test(line) ? "\n" : "";
    if (out.length >= max) break;
  }
  return out.length > max ? `${out.slice(0, max).replace(/\s+\S*$/, "")}…` : out;
}

/** Hovering a link to another document in the editor shows the start of it. */
export function linkHover(): Extension {
  return hoverTooltip(
    async (view, pos): Promise<Tooltip | null> => {
      const hit = documentLinkAt(view.state.doc.toString(), pos);
      const docPath = activeDoc()?.path;
      if (!hit || !docPath) return null;
      const path = resolveRelative(docPath, hit.target);
      if (!path) return null;
      const open = useDocuments.getState().docs.find((d) => d.path === path);
      const text = open ? open.content : await backend().readTextFile(path).then((f) => f.content, () => null);
      const hash = hit.target.indexOf("#");
      let anchor: string | null = null;
      if (hash >= 0) {
        try {
          anchor = decodeURIComponent(hit.target.slice(hash + 1));
        } catch {
          anchor = hit.target.slice(hash + 1);
        }
      }
      return {
        pos: hit.from,
        end: hit.to,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-link-preview";
          if (text === null) dom.textContent = "The linked file wasn't found.";
          else dom.textContent = excerpt(text, anchor) || "(empty document)";
          return { dom };
        },
      };
    },
    { hoverTime: 450 },
  );
}
