import { basename, isInside } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { notify, promptText } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { getEditorView } from "./editorBridge";
import { findAllLinks, localTargets } from "./lint";
import { extractHeadings, headingSlugs, plainHeadingText } from "./outline";
import GithubSlugger from "github-slugger";
import type { TextChange } from "./referenceLinks";
import { labelAt, planLabelRename, type LabelTarget } from "./renameLabel";
import type { EditorView } from "@codemirror/view";

/**
 * Renaming a heading keeps links to it working: `#anchor` links in the same
 * document, and `file.md#anchor` links in the folder's other documents.
 */

const ATX = /^( {0,3}#{1,6}[ \t]+)(.*?)((?:[ \t]+#+)?[ \t]*)$/;

/** The heading on (or, for a setext heading, underlined by) a line: its line and the range of its text. */
export function headingAt(text: string, line: number): { line: number; from: number; to: number; raw: string } | null {
  const headings = extractHeadings(text);
  const h = headings.find((x) => x.line === line) ?? headings.find((x) => x.line === line - 1 && !ATX.test(lineText(text, x.line)));
  if (!h) return null;
  const start = lineStart(text, h.line);
  const source = lineText(text, h.line);
  const atx = ATX.exec(source);
  if (atx) return { line: h.line, from: start + atx[1].length, to: start + atx[1].length + atx[2].length, raw: atx[2] };
  const lead = source.length - source.trimStart().length;
  const raw = source.trim();
  return { line: h.line, from: start + lead, to: start + lead + raw.length, raw };
}

function lineStart(text: string, line: number): number {
  let pos = 0;
  for (let n = 1; n < line; n++) pos = text.indexOf("\n", pos) + 1;
  return pos;
}

function lineText(text: string, line: number): string {
  const start = lineStart(text, line);
  const end = text.indexOf("\n", start);
  return text.slice(start, end < 0 ? text.length : end);
}

function decode(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

/**
 * The edits that rename the heading on `line` to `value` and update this
 * document's `#anchor` links, and how anchors changed (renaming can also
 * change the numbering of later headings with the same text).
 */
/** A wiki link naming the renamed heading by its text (`[[page#Old Text]]`): the edit that writes the new text. */
function wikiHeadingEdit(text: string, link: { targetFrom: number; sourceLength?: number }, wiki: WikiRename): TextChange | null {
  const written = text.slice(link.targetFrom, link.targetFrom + (link.sourceLength ?? 0));
  const hash = written.indexOf("#");
  if (hash < 0 || new GithubSlugger().slug(written.slice(hash + 1).trim()) !== wiki.oldSlug) return null;
  return { from: link.targetFrom + hash + 1, to: link.targetFrom + written.length, insert: wiki.text };
}

/** The renamed heading, for wiki links that name it: its old anchor and its new text. */
export interface WikiRename {
  oldSlug: string;
  text: string;
}

export function planHeadingRename(text: string, line: number, value: string): { changes: TextChange[]; renamed: Map<string, string>; wiki: WikiRename } | null {
  const h = headingAt(text, line);
  if (!h || !value.trim()) return null;
  const heading = { from: h.from, to: h.to, insert: value.trim() };
  const after = text.slice(0, heading.from) + heading.insert + text.slice(heading.to);
  const before = headingSlugs(extractHeadings(text));
  const now = headingSlugs(extractHeadings(after));
  const renamed = new Map<string, string>();
  if (before.length === now.length) before.forEach((slug, i) => slug !== now[i] && renamed.set(slug, now[i]));
  const changes: TextChange[] = [heading];
  const index = extractHeadings(text).findIndex((x) => x.line === h.line);
  const wiki: WikiRename = { oldSlug: before[index], text: plainHeadingText(value) };
  for (const link of findAllLinks(text)) {
    // Links inside the heading's own text are replaced with it.
    if (link.to > heading.from && link.from < heading.to) continue;
    // [[#Heading]] in the same document.
    if (link.wiki && link.target.startsWith("#")) {
      const edit = wikiHeadingEdit(text, link, wiki);
      if (edit) changes.push(edit);
      continue;
    }
    if (!link.target.startsWith("#") || link.sourceLength !== undefined) continue;
    const next = renamed.get(decode(link.target.slice(1)).toLowerCase());
    if (next !== undefined) changes.push({ from: link.targetFrom + 1, to: link.targetFrom + link.target.length, insert: next });
  }
  return { changes, renamed, wiki };
}

/** Rewrites `#anchor` parts of links in `text` (a document at `path`) that point to `docPath`. */
export function rewriteAnchorLinks(text: string, path: string, docPath: string, renamed: Map<string, string>, wiki?: WikiRename): { text: string; count: number } {
  const edits: TextChange[] = [];
  for (const { link, path: target } of localTargets(findAllLinks(text), path)) {
    if (link.wiki) {
      const edit = wiki && target && isInside(target, docPath) && isInside(docPath, target) ? wikiHeadingEdit(text, link, wiki) : null;
      if (edit) edits.push(edit);
      continue;
    }
    const hash = link.target.indexOf("#");
    if (hash < 0 || link.sourceLength !== undefined || !target || !isInside(target, docPath) || !isInside(docPath, target)) continue;
    const next = renamed.get(decode(link.target.slice(hash + 1)).toLowerCase());
    if (next !== undefined) edits.push({ from: link.targetFrom + hash + 1, to: link.targetFrom + link.target.length, insert: next });
  }
  let out = text;
  for (const e of edits.reverse()) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return { text: out, count: edits.length };
}

async function renameLabel(view: EditorView, target: LabelTarget) {
  const footnote = target.kind === "footnote";
  const value = await promptText({
    title: footnote ? "Rename Footnote" : "Rename Link Label",
    message: footnote ? "Every reference to this footnote, and its definition, get the new label." : "Every link that uses this label, and its definition, get the new label.",
    value: target.label,
    okLabel: "Rename",
  });
  if (value === null || !value.trim() || value.trim() === target.label) return;
  if (/[[\]]/.test(value) || (footnote && /\s/.test(value.trim()))) {
    notify("info", footnote ? "A footnote label can't contain spaces or square brackets." : "A link label can't contain square brackets.");
    return;
  }
  const changes = planLabelRename(view.state.doc.toString(), target, value);
  if (!changes.length) return;
  view.dispatch(view.state.update({ changes, userEvent: "input.rename", scrollIntoView: true }));
  view.focus();
}

/** Asks for a new name for the heading at the cursor (or on `line`) and renames it, updating links to it. */
export async function renameHeading(line?: number) {
  const view = getEditorView();
  const doc = activeDoc();
  if (!view || !doc) return;
  const target = headingAt(view.state.doc.toString(), line ?? view.state.doc.lineAt(view.state.selection.main.head).number);
  if (!target) {
    // Not a heading: a footnote or link reference label is renamed everywhere in the document.
    const label = line === undefined ? labelAt(view.state.doc.toString(), view.state.selection.main.head) : null;
    if (label) return renameLabel(view, label);
    notify("info", "Put the cursor on a heading, a footnote or a link reference to rename it.");
    return;
  }
  const value = await promptText({
    title: "Rename Heading",
    message: "Links to this heading in this document, and in the folder's other documents, are updated too.",
    value: target.raw,
    okLabel: "Rename",
  });
  if (value === null || value === target.raw) return;
  const plan = planHeadingRename(view.state.doc.toString(), target.line, value);
  if (!plan) return;
  view.dispatch(view.state.update({ changes: plan.changes, userEvent: "input.rename", scrollIntoView: true }));
  view.focus();
  const root = useWorkspace.getState().root;
  const path = doc.path;
  if (!plan.renamed.size || !root || !path || !isInside(path, root)) return;
  const { rewriteWorkspaceLinks } = await import("./linkUpdate");
  await rewriteWorkspaceLinks(
    root,
    (text, file) => rewriteAnchorLinks(text, file, path, plan.renamed, plan.wiki),
    (links, files) =>
      `${links} ${links === 1 ? "link" : "links"} in ${files} ${files === 1 ? "file" : "files"} point to this heading in “${basename(path)}”. Update ${links === 1 ? "it" : "them"} to the new name?`,
    path,
  );
}
