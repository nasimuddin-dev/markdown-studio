import { backend } from "../services";
import { splitFrontMatter } from "../services/frontMatter";
import { basename, isInside, isMarkdownPath } from "../services/paths";
import { INLINE_TAG } from "../services/tags";
import { activeDoc, useDocuments } from "../stores/documentsStore";
import { notify, promptText } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { getEditorView } from "./editorBridge";
import { findAllLinks, maskCode } from "./lint";
import type { TextChange } from "./referenceLinks";

/** A tag used in a document: its name (without #) and the line it's on (1-based). */
export interface TagUse {
  tag: string;
  line: number;
}

/** Inline `#tags` outside front matter, code, links and headings, with the offset of their `#`. */
function inlineTags(text: string): Array<{ tag: string; from: number; line: number }> {
  const fm = splitFrontMatter(text);
  // Blank the front matter, keeping offsets and line numbers.
  let masked = maskCode(fm ? fm.raw.replace(/[^\n]/g, " ") + text.slice(fm.raw.length) : text);
  for (const link of findAllLinks(masked)) masked = masked.slice(0, link.from) + " ".repeat(link.to - link.from) + masked.slice(link.to);
  const out: Array<{ tag: string; from: number; line: number }> = [];
  let offset = 0;
  masked.split("\n").forEach((line, i) => {
    if (!/^ {0,3}#{1,6}(\s|$)/.test(line)) {
      for (const m of line.matchAll(INLINE_TAG)) out.push({ tag: m[1], from: offset + m.index, line: i + 1 });
    }
    offset += line.length + 1;
  });
  return out;
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
  for (const { tag, line } of inlineTags(text)) out.push({ tag, line });
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

/** The inline tag at a position (on the `#` or in the word), without `#`. */
export function tagAt(text: string, pos: number): string | null {
  return inlineTags(text).find((t) => pos >= t.from && pos <= t.from + 1 + t.tag.length)?.tag ?? null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * The edits that rename a tag (any capitalisation) and its nested tags
 * (`#project/alpha` for `project`): inline and in the front matter `tags`.
 */
export function planTagRename(text: string, oldTag: string, newTag: string): TextChange[] {
  const lower = oldTag.toLowerCase();
  const changes: TextChange[] = [];
  for (const t of inlineTags(text)) {
    const key = t.tag.toLowerCase();
    if (key === lower || key.startsWith(`${lower}/`)) changes.push({ from: t.from + 1, to: t.from + 1 + oldTag.length, insert: newTag });
  }
  const fm = splitFrontMatter(text);
  if (fm) {
    const word = new RegExp(`(?<=^|[\\s,[#"'])${escapeRegex(oldTag)}(?=$|[\\s,\\]"'/])`, "giu");
    let offset = 0;
    let inTags = false;
    for (const line of fm.raw.split("\n")) {
      const key = /^(tags?):/i.exec(line);
      if (key) inTags = true;
      else if (!/^\s+-\s/.test(line)) inTags = false;
      if (inTags) {
        const start = key ? key[0].length : line.indexOf("-") + 1;
        for (const m of line.slice(start).matchAll(word)) changes.push({ from: offset + start + m.index, to: offset + start + m.index + m[0].length, insert: newTag });
      }
      offset += line.length + 1;
    }
  }
  return changes.sort((a, b) => a.from - b.from);
}

/** Applies non-overlapping changes, sorted by position. */
function applyChanges(text: string, changes: TextChange[]): string {
  let out = "";
  let last = 0;
  for (const c of changes) {
    out += text.slice(last, c.from) + c.insert;
    last = c.to;
  }
  return out + text.slice(last);
}

/** Rename Tag: the tag at the cursor, in this document and the folder's other documents. */
export async function renameTag(tag?: string | null) {
  const view = getEditorView();
  const doc = activeDoc();
  if (!view || !doc) return;
  const oldTag = tag ?? tagAt(view.state.doc.toString(), view.state.selection.main.head);
  if (!oldTag) {
    notify("info", "Put the cursor on a #tag to rename it.");
    return;
  }
  const typed = await promptText({
    title: "Rename Tag",
    message: `Rename #${oldTag} in this document and in the folder's other documents (nested tags like #${oldTag}/… too).`,
    value: oldTag,
    okLabel: "Rename",
  });
  if (typed === null) return;
  const newTag = typed.trim().replace(/^#/, "");
  if (newTag === oldTag) return;
  if (!/^[\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*$/u.test(newTag)) {
    notify("warning", "A tag can have letters, digits, _, - and /, with at least one letter, and no spaces.");
    return;
  }
  const changes = planTagRename(view.state.doc.toString(), oldTag, newTag);
  if (changes.length) view.dispatch(view.state.update({ changes, userEvent: "input.rename" }));
  view.focus();
  const root = useWorkspace.getState().root;
  const path = doc.path;
  if (!root || !path || !isInside(path, root)) return;
  const { rewriteWorkspaceLinks } = await import("./linkUpdate");
  await rewriteWorkspaceLinks(
    root,
    (text) => {
      const edits = planTagRename(text, oldTag, newTag);
      return { text: applyChanges(text, edits), count: edits.length };
    },
    (uses, files) => `#${oldTag} is used ${uses} ${uses === 1 ? "time" : "times"} in ${files} other ${files === 1 ? "file" : "files"} of “${basename(root)}”. Rename ${uses === 1 ? "it" : "them"} too?`,
    path,
    { title: "Rename in other files?", button: "Rename", done: "Renamed the tag in" },
  );
}
