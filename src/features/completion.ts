import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import GithubSlugger from "github-slugger";
import { backend } from "../services";
import { basename, dirname, isMarkdownPath, relativePath } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { findLinkDefinitions, maskCode } from "./lint";
import { extractHeadings } from "./outline";

const CACHE_MS = 10_000;
let cache: { root: string; at: number; files: Promise<string[]> } | null = null;

/** Workspace file list for completion, cached briefly. */
function workspaceFiles(root: string): Promise<string[]> {
  if (!cache || cache.root !== root || Date.now() - cache.at > CACHE_MS) {
    cache = { root, at: Date.now(), files: backend().listWorkspaceFiles(root).catch(() => []) };
  }
  return cache.files;
}

export function invalidateWorkspaceFiles() {
  cache = null;
}

/** `#anchor` completions for the headings of the current document. */
export function headingCompletions(text: string): Completion[] {
  const slugger = new GithubSlugger();
  return extractHeadings(text).map((h) => ({
    label: "#" + slugger.slug(h.text),
    detail: `${"#".repeat(h.level)} ${h.text}`,
    type: "constant",
  }));
}

/** File completions relative to the document's folder. */
export function fileCompletions(files: string[], docPath: string, images: boolean): Completion[] {
  const dir = dirname(docPath);
  const out: Completion[] = [];
  for (const f of files) {
    if (f === docPath) continue;
    const isMd = isMarkdownPath(f);
    if (images ? isMd : !isMd) continue;
    const rel = relativePath(dir, f);
    if (rel === null) continue;
    out.push({
      label: encodeURI(rel),
      detail: basename(f),
      type: images ? "variable" : "text",
      // Closer files first.
      boost: -rel.split("/").length,
    });
  }
  return out;
}

/** Completes link destinations after `](`: headings for `#`, otherwise workspace files. */
export async function linkCompletionSource(ctx: CompletionContext): Promise<CompletionResult | null> {
  const m = ctx.matchBefore(/!?\[[^\]\n]*\]\([^)\s]*/);
  if (!m) return null;
  const at = m.text.indexOf("](") + 2;
  const from = m.from + at;
  const typed = m.text.slice(at);
  const image = m.text.startsWith("!");

  if (typed.startsWith("#")) {
    return { from, options: headingCompletions(ctx.state.doc.toString()), validFor: /^#[^)\s]*$/ };
  }
  const doc = activeDoc();
  const root = useWorkspace.getState().root;
  if (!doc?.path || !root) return null;
  const files = await workspaceFiles(root);
  if (ctx.aborted) return null;
  const options = fileCompletions(files, doc.path, image);
  return options.length ? { from, options, validFor: /^[^)\s#]*$/ } : null;
}

/**
 * Completes labels the document defines: link references after `][`
 * (`[text][` → `[text][guide`), with the address as detail, and footnotes
 * after `[^` (except at the start of a line, where a definition is being written).
 */
export function referenceCompletionSource(ctx: CompletionContext): CompletionResult | null {
  const reference = ctx.matchBefore(/!?\[[^\]\n]*\]\[[^\]\n]*/);
  const footnote = reference ? null : ctx.matchBefore(/\[\^[^\]\s]*/);
  const m = reference ?? footnote;
  if (!m) return null;
  const line = ctx.state.doc.lineAt(m.from);
  if (footnote && !line.text.slice(0, m.from - line.from).trim()) return null;
  const text = ctx.state.doc.toString();
  const seen = new Set<string>();
  const options: Completion[] = [];
  // Close the brackets unless a ] already follows.
  const close = ctx.state.sliceDoc(ctx.pos, ctx.pos + 1) === "]" ? "" : "]";
  if (reference) {
    for (const d of findLinkDefinitions(text)) {
      if (d.text.startsWith("^") || seen.has(d.text.toLowerCase())) continue;
      seen.add(d.text.toLowerCase());
      options.push({ label: d.text, apply: d.text + close, detail: d.target, type: "constant" });
    }
  } else {
    for (const f of maskCode(text).matchAll(/^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/gm)) {
      if (seen.has(f[1].toLowerCase())) continue;
      seen.add(f[1].toLowerCase());
      options.push({ label: f[1], apply: f[1] + close, detail: f[2].slice(0, 60), type: "constant" });
    }
  }
  if (!options.length) return null;
  const from = reference ? m.from + m.text.lastIndexOf("[") + 1 : m.from + 2;
  return { from, options, validFor: reference ? /^[^\]\n]*$/ : /^[^\]\s]*$/ };
}

let emojiOptions: Promise<Completion[]> | null = null;

/** Every GitHub emoji shortcode, loaded on first use. */
function loadEmojiOptions(): Promise<Completion[]> {
  emojiOptions ??= import("gemoji").then(({ gemoji }) =>
    gemoji.flatMap((g) =>
      g.names.map((name): Completion => ({ label: `:${name}:`, displayLabel: `${g.emoji}  :${name}:`, detail: g.description, type: "text" })),
    ),
  );
  return emojiOptions;
}

/** True inside inline code or a code block, where shortcodes aren't converted. */
function inCode(state: EditorState, pos: number): boolean {
  for (let node: ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]> | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
    if (/Code/.test(node.name)) return true;
  }
  return false;
}

/**
 * Completes GitHub emoji shortcodes after a colon and two characters
 * (`:roc` → `:rocket:`), except right after a letter, digit or backtick
 * (times, URLs, code being typed) and inside code.
 */
export async function emojiCompletionSource(ctx: CompletionContext): Promise<CompletionResult | null> {
  const m = ctx.matchBefore(/:[a-z0-9_+-]{2,}$/i);
  if (!m) return null;
  if (/[\w:`]/.test(ctx.state.sliceDoc(m.from - 1, m.from))) return null;
  if (inCode(ctx.state, ctx.pos)) return null;
  const options = await loadEmojiOptions();
  if (ctx.aborted) return null;
  return { from: m.from, options, validFor: /^:[a-z0-9_+-]*$/i };
}

export function linkCompletion(): Extension {
  return autocompletion({ override: [linkCompletionSource, referenceCompletionSource, emojiCompletionSource], icons: false, activateOnTyping: true });
}
