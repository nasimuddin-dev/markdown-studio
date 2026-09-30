import { basename, isInside } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { notify, promptText } from "../stores/uiStore";
import { useWorkspace } from "../stores/workspaceStore";
import { getEditorView } from "./editorBridge";
import { findAllLinks, localTargets } from "./lint";
import { extractHeadings, headingSlugs } from "./outline";
import type { TextChange } from "./referenceLinks";

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
export function planHeadingRename(text: string, line: number, value: string): { changes: TextChange[]; renamed: Map<string, string> } | null {
  const h = headingAt(text, line);
  if (!h || !value.trim()) return null;
  const heading = { from: h.from, to: h.to, insert: value.trim() };
  const after = text.slice(0, heading.from) + heading.insert + text.slice(heading.to);
  const before = headingSlugs(extractHeadings(text));
  const now = headingSlugs(extractHeadings(after));
  const renamed = new Map<string, string>();
  if (before.length === now.length) before.forEach((slug, i) => slug !== now[i] && renamed.set(slug, now[i]));
  const changes: TextChange[] = [heading];
  for (const link of findAllLinks(text)) {
    // Links inside the heading's own text are replaced with it.
    if (!link.target.startsWith("#") || link.sourceLength !== undefined || (link.to > heading.from && link.from < heading.to)) continue;
    const next = renamed.get(decode(link.target.slice(1)).toLowerCase());
    if (next !== undefined) changes.push({ from: link.targetFrom + 1, to: link.targetFrom + link.target.length, insert: next });
  }
  return { changes, renamed };
}

/** Rewrites `#anchor` parts of links in `text` (a document at `path`) that point to `docPath`. */
export function rewriteAnchorLinks(text: string, path: string, docPath: string, renamed: Map<string, string>): { text: string; count: number } {
  const edits: TextChange[] = [];
  for (const { link, path: target } of localTargets(findAllLinks(text), path)) {
    const hash = link.target.indexOf("#");
    if (hash < 0 || link.sourceLength !== undefined || !target || !isInside(target, docPath) || !isInside(docPath, target)) continue;
    const next = renamed.get(decode(link.target.slice(hash + 1)).toLowerCase());
    if (next !== undefined) edits.push({ from: link.targetFrom + hash + 1, to: link.targetFrom + link.target.length, insert: next });
  }
  let out = text;
  for (const e of edits.reverse()) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return { text: out, count: edits.length };
}

/** Asks for a new name for the heading at the cursor (or on `line`) and renames it, updating links to it. */
export async function renameHeading(line?: number) {
  const view = getEditorView();
  const doc = activeDoc();
  if (!view || !doc) return;
  const target = headingAt(view.state.doc.toString(), line ?? view.state.doc.lineAt(view.state.selection.main.head).number);
  if (!target) {
    notify("info", "Put the cursor on a heading to rename it.");
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
    (text, file) => rewriteAnchorLinks(text, file, path, plan.renamed),
    (links, files) =>
      `${links} ${links === 1 ? "link" : "links"} in ${files} ${files === 1 ? "file" : "files"} point to this heading in “${basename(path)}”. Update ${links === 1 ? "it" : "them"} to the new name?`,
    path,
  );
}
