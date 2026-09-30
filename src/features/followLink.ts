import { EditorView, ViewPlugin } from "@codemirror/view";
import { syntaxHighlighting } from "@codemirror/language";
import { tagHighlighter, tags as t } from "@lezer/highlight";
import type { Extension, StateCommand } from "@codemirror/state";
import GithubSlugger from "github-slugger";
import { backend } from "../services";
import { describeError } from "../services/errors";
import { classifyLink } from "../services/markdown";
import { isMarkdownPath, resolveRelative } from "../services/paths";
import { activeDoc } from "../stores/documentsStore";
import { notify } from "../stores/uiStore";
import { openPath } from "./documents";
import { requestReveal } from "./editorBridge";
import { findAllLinks, findLinkDefinitions, maskCode } from "./lint";
import { extractHeadings } from "./outline";

/** The line (1-based) of the heading or `<a id>`/`<a name>` an anchor points to, or null. */
export function anchorLine(text: string, id: string): number | null {
  const wanted = id.toLowerCase();
  const slugger = new GithubSlugger();
  for (const h of extractHeadings(text)) if (slugger.slug(h.text) === wanted) return h.line;
  for (const m of text.matchAll(/<a\s+[^>]*(?:id|name)\s*=\s*["']([^"']+)["']/gi)) {
    if (m[1] === id) return text.slice(0, m.index).split("\n").length;
  }
  return null;
}

/**
 * Opens what a link points to, never navigating the app window (SEC-005):
 * web pages in the browser, Markdown documents in a tab (at the heading after
 * `#`), and `#anchors` of the current document through `showAnchor`.
 */
export async function openLink(href: string, docPath: string | null, showAnchor: (id: string) => void) {
  const target = classifyLink(href);
  switch (target.type) {
    case "anchor":
      showAnchor(target.id);
      break;
    case "external":
      try {
        await backend().openExternal(target.url);
      } catch (err) {
        notify("error", describeError(err, "open the link"));
      }
      break;
    case "document": {
      const resolved = docPath ? resolveRelative(docPath, target.href) : null;
      if (!resolved || !isMarkdownPath(resolved)) {
        notify("info", "Only links to Markdown documents and web pages can be opened.");
        break;
      }
      await openPath(resolved);
      const hash = target.href.split("#")[1];
      const doc = activeDoc();
      if (hash && doc?.path === resolved) {
        let id = hash;
        try {
          id = decodeURIComponent(hash);
        } catch {
          /* keep it as written */
        }
        const line = anchorLine(doc.content, id);
        if (line) requestReveal(doc.id, line, 0, 0);
      }
      break;
    }
    case "blocked":
      notify("warning", "This link type is blocked for your safety.");
      break;
  }
}

/** What is at a position of the editor's text that Ctrl/Cmd+click can follow. */
export type EditorLink = { kind: "href"; href: string } | { kind: "definition"; pos: number };

const normalize = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The link at `pos`: an inline link or image, a reference definition, an HTML
 * link, a web address (bare or in `<>`), or a reference (`[text][id]`,
 * `[id][]`, `[id]`), which leads to its definition. Nothing inside code.
 */
export function linkAt(text: string, pos: number): EditorLink | null {
  const masked = maskCode(text);
  if (masked[pos] !== text[pos] && masked[pos] === " ") return null;
  for (const link of findAllLinks(text)) {
    if (pos >= link.from && pos <= link.to) return link.target ? { kind: "href", href: link.target } : null;
  }
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd = text.indexOf("\n", pos) < 0 ? text.length : text.indexOf("\n", pos);
  const line = masked.slice(lineStart, lineEnd);
  const at = pos - lineStart;
  for (const m of line.matchAll(/<?(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"])>?/gi)) {
    if (at >= m.index && at <= m.index + m[0].length) return { kind: "href", href: m[1] };
  }
  const definitions = new Map<string, number>();
  for (const d of findLinkDefinitions(text)) if (!definitions.has(normalize(d.text))) definitions.set(normalize(d.text), d.from);
  for (const m of line.matchAll(/!?\[((?:[^[\]\n]|\[[^\]\n]*\])*)\](?:\[([^\]\n]*)\])?/g)) {
    if (at < m.index || at > m.index + m[0].length) continue;
    const label = m[2]?.trim() ? m[2] : m[1];
    const def = definitions.get(normalize(label));
    if (def !== undefined) return { kind: "definition", pos: def };
  }
  return null;
}

type Target = Parameters<StateCommand>[0];

/** Follows the link at `pos` in the editor. Returns false when there's none. */
export function followLinkAt(view: Target, pos: number): boolean {
  const link = linkAt(view.state.doc.toString(), pos);
  if (!link) return false;
  if (link.kind === "definition") {
    view.dispatch(view.state.update({ selection: { anchor: link.pos }, effects: EditorView.scrollIntoView(link.pos, { y: "center" }) }));
    return true;
  }
  const doc = activeDoc();
  void openLink(link.href, doc?.path ?? null, (id) => {
    const line = anchorLine(view.state.doc.toString(), id);
    if (line === null) {
      notify("info", `No heading matches “#${id}” in this document.`);
      return;
    }
    const from = view.state.doc.line(line).from;
    view.dispatch(view.state.update({ selection: { anchor: from }, effects: EditorView.scrollIntoView(from, { y: "start", yMargin: 12 }) }));
  });
  return true;
}

/** Follows the link at the cursor (the keyboard way to Ctrl/Cmd+click). */
export const followLinkAtCursor: StateCommand = (target) => followLinkAt(target, target.state.selection.main.head);

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const followKey = (e: KeyboardEvent | MouseEvent) => (isMac ? e.metaKey : e.ctrlKey);

/**
 * Ctrl+click (Cmd+click on macOS) follows a link in the editor. While the key
 * is held, links are underlined with a pointer cursor.
 */
export function followLinks(): Extension {
  return [
    syntaxHighlighting(tagHighlighter([{ tag: [t.link, t.url], class: "cm-md-link" }])),
    EditorView.domEventHandlers({
      mousedown(e, view) {
        if (e.button !== 0 || !followKey(e) || e.shiftKey || e.altKey) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false);
        if (!followLinkAt({ state: view.state, dispatch: view.dispatch }, pos)) return false;
        e.preventDefault();
        return true;
      },
    }),
    ViewPlugin.define((view) => {
      const set = (on: boolean) => view.dom.classList.toggle("cm-follow-links", on);
      const onKey = (e: KeyboardEvent) => set(followKey(e));
      const off = () => set(false);
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);
      window.addEventListener("blur", off);
      return {
        destroy() {
          window.removeEventListener("keydown", onKey);
          window.removeEventListener("keyup", onKey);
          window.removeEventListener("blur", off);
        },
      };
    }),
  ];
}
