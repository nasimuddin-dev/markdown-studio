/**
 * What the Markdown editor needs from the HTML language, without the CSS and
 * JavaScript parsers the full `@codemirror/lang-html` bundles for `<style>`
 * and `<script>` content (about 140 KB at start-up).
 *
 * `vite.config.ts` hands this module to `@codemirror/lang-markdown` (and only
 * to it) in place of `@codemirror/lang-html`. Inline HTML in Markdown is
 * highlighted, and its tags complete and close themselves as before; `<style>`
 * and `<script>` contents inside a Markdown document stay plain text. Fenced
 * ```` ```html ```` and ```` ```js ```` blocks still load the full languages
 * on demand (through `@codemirror/language-data`).
 *
 * Nothing here may import `@codemirror/lang-html`: its module-level set-up
 * reads the CSS and JavaScript languages, so any import keeps them in the
 * bundle. `autoCloseTags` is adapted from `@codemirror/lang-html` 6.4 (MIT,
 * Marijn Haverbeke and others).
 */
import { EditorSelection, type Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { LanguageSupport, LRLanguage, syntaxTree } from "@codemirror/language";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { SyntaxNode } from "@lezer/common";
import { parser } from "@lezer/html";

/** The HTML parser alone (no nested languages), with HTML's comment syntax. */
const htmlPlain = LRLanguage.define({
  name: "html",
  parser,
  languageData: {
    commentTokens: { block: { open: "<!--", close: "-->" } },
    wordChars: "-_",
  },
});

/** The element names `@codemirror/lang-html` offers when a tag is started (the Markdown editor's `<` completion). */
const TAGS =
  "a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption center cite code col colgroup command data datagrid datalist dd del details dfn div dl dt em embed eventsource fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd keygen label legend li link map mark menu meta meter nav noscript object ol optgroup option output p param pre progress q rp rt ruby samp script section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track ul var video wbr";
const tagOptions = TAGS.split(" ").map((name) => ({ label: `<${name}`, type: "type" }));

/** Tag-name completion after `<` (what `@codemirror/lang-markdown` asks for). */
export function htmlCompletionSource(context: CompletionContext): CompletionResult | null {
  const before = /<[:\-.\w·-￿]*$/.exec(context.state.sliceDoc(Math.max(0, context.pos - 25), context.pos));
  if (!before && !context.explicit) return null;
  const from = before ? context.pos - before[0].length : context.pos;
  return { from, options: tagOptions, validFor: /^<[:\-.\w·-￿]*$/ };
}

const selfClosers = new Set("area base br col command embed frame hr img input keygen link meta param source track wbr menuitem".split(" "));

function elementName(doc: Text, tree: SyntaxNode | null, max = doc.length): string {
  if (!tree) return "";
  const name = tree.firstChild?.getChild("TagName");
  return name ? doc.sliceString(name.from, Math.min(name.to, max)) : "";
}

function isClosed(doc: Text, elt: SyntaxNode, name: string): boolean {
  for (;;) {
    if (elt.lastChild?.name !== "CloseTag") return false;
    const next = elt.parent;
    if (!next || elementName(doc, next) !== name) return true;
    elt = next;
  }
}

/** Inserts the closing tag when `>` ends an opening tag, or completes it when `</` is typed. */
const autoCloseTags = EditorView.inputHandler.of((view, from, to, text, insertTransaction) => {
  if (view.composing || view.state.readOnly || from !== to || (text !== ">" && text !== "/") || !htmlPlain.isActiveAt(view.state, from, -1)) return false;
  const base = insertTransaction();
  const { state } = base;
  const closeTags = state.changeByRange((range) => {
    const didType = state.doc.sliceString(range.from - 1, range.to) === text;
    const { head } = range;
    const after = syntaxTree(state).resolveInner(head, -1);
    let name: string;
    if (didType && text === ">" && after.name === "EndTag") {
      const tag = after.parent!;
      if ((name = elementName(state.doc, tag.parent, head)) && !selfClosers.has(name) && !isClosed(state.doc, tag.parent!, name)) {
        const end = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0);
        return { range, changes: { from: head, to: end, insert: `</${name}>` } };
      }
    } else if (didType && text === "/" && after.name === "IncompleteCloseTag") {
      const tag = after.parent!;
      if (after.from === head - 2 && tag.lastChild?.name !== "CloseTag" && (name = elementName(state.doc, tag, head)) && !selfClosers.has(name)) {
        const end = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0);
        const insert = `${name}>`;
        return { range: EditorSelection.cursor(head + insert.length, -1), changes: { from: head, to: end, insert } };
      }
    }
    return { range };
  });
  if (closeTags.changes.empty) return false;
  view.dispatch([base, state.update(closeTags, { userEvent: "input.complete", scrollIntoView: true })]);
  return true;
});

/** `html()` as `@codemirror/lang-markdown` calls it: `{ matchClosingTags: false }`. */
export function html(config: { matchClosingTags?: boolean; selfClosingTags?: boolean } = {}): LanguageSupport {
  const dialect = [config.matchClosingTags === false ? "noMatch" : "", config.selfClosingTags ? "selfClosing" : ""].filter(Boolean).join(" ");
  const language = dialect ? htmlPlain.configure({ dialect }) : htmlPlain;
  return new LanguageSupport(language, [htmlPlain.data.of({ autocomplete: htmlCompletionSource }), autoCloseTags]);
}
