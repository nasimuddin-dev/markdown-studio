import { backend } from "../services";
import { splitFrontMatter } from "../services/frontMatter";
import { isMarkdownPath } from "../services/paths";
import { INLINE_TAG } from "../services/tags";
import { useDocuments } from "../stores/documentsStore";
import { findAllLinks, maskCode } from "./lint";

/** A tag used in a document: its name (without #) and the line it's on (1-based). */
export interface TagUse {
  tag: string;
  line: number;
}

/**
 * The tags of a document: `tags` (or `tag`) in the front matter, as a list
 * or comma-separated, and inline `#tags` outside code, links and headings.
 */
export function extractTags(text: string): TagUse[] {
  const out: TagUse[] = [];
  const fm = splitFrontMatter(text);
  if (fm) {
    const entry = fm.entries.find(([k]) => /^tags?$/i.test(k));
    const line = fm.raw.split("\n").findIndex((l) => /^tags?:/i.test(l)) + 1;
    for (const t of entry?.[1].split(/[,\s]+/) ?? []) {
      const tag = t.replace(/^[[\]"'#]+|[[\]"']+$/g, "").trim();
      if (tag) out.push({ tag, line: Math.max(1, line) });
    }
  }
  let masked = maskCode(fm ? fm.body : text);
  for (const link of findAllLinks(masked)) masked = masked.slice(0, link.from) + " ".repeat(link.to - link.from) + masked.slice(link.to);
  masked.split("\n").forEach((line, i) => {
    if (/^ {0,3}#{1,6}(\s|$)/.test(line)) return;
    for (const m of line.matchAll(INLINE_TAG)) out.push({ tag: m[1], line: i + 1 });
  });
  return out;
}

/** Tags across the folder's Markdown files (open tabs as edited): tag → the files and first line using it. */
export async function collectFolderTags(root: string): Promise<Map<string, Array<{ path: string; line: number; count: number }>>> {
  const b = backend();
  const paths = (await b.listWorkspaceFiles(root).catch(() => [] as string[])).filter(isMarkdownPath);
  const open = new Map(useDocuments.getState().docs.filter((d) => d.path).map((d) => [d.path!, d.content]));
  const byTag = new Map<string, Array<{ path: string; line: number; count: number }>>();
  for (const path of paths) {
    const text = open.get(path) ?? (await b.readTextFile(path).then((f) => f.content, () => ""));
    const seen = new Map<string, { path: string; line: number; count: number }>();
    for (const { tag, line } of extractTags(text)) {
      const key = tag.toLowerCase();
      const hit = seen.get(key);
      if (hit) hit.count++;
      else seen.set(key, { path, line, count: 1 });
    }
    for (const [key, hit] of seen) byTag.set(key, [...(byTag.get(key) ?? []), hit]);
  }
  return byTag;
}
