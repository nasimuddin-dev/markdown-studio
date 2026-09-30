/**
 * The user's custom CSS for rendered documents, scoped so it can only style
 * the document (`.markdown-body`), never the app around it. The CSS is parsed
 * by the browser and rebuilt rule by rule, so unbalanced braces or other
 * mistakes can't escape the scope; `@import` and unknown at-rules are dropped.
 */

const SCOPE = ".markdown-body";

/** Parses CSS into rules without applying it to the page. */
function parseRules(css: string): CSSRuleList | null {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet.cssRules;
  } catch {
    // Engines without constructable style sheets: a style element in an inert document.
    try {
      const doc = document.implementation.createHTMLDocument("");
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.appendChild(style);
      return style.sheet?.cssRules ?? null;
    } catch {
      return null;
    }
  }
}

/** Splits a selector list at top-level commas (not those inside `:is(a, b)` or `[x=","]`). */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Puts one selector inside the document: `h1` → `.markdown-body h1`;
 * `body`, `html` and `:root` mean the document itself; selectors that already
 * start with `.markdown-body` are kept.
 */
export function scopeSelector(selector: string): string {
  const s = selector.trim().replace(/^(?:(?::root|html)(?:\s+body)?|body)(?![\w-])/, SCOPE);
  if (s.startsWith(SCOPE) && !/^[\w-]/.test(s.slice(SCOPE.length))) return s;
  return `${SCOPE} ${s}`;
}

/** At-rules whose contents are scoped like the rest. */
const GROUPS = new Set(["media", "supports", "container", "layer"]);
/** At-rules that style no elements by themselves; kept as they are. */
const KEEP = new Set(["font-face", "keyframes", "-webkit-keyframes", "page", "property", "counter-style", "font-feature-values", "font-palette-values", "layer"]);
const STYLE_RULE = 1;

function rebuild(rules: CSSRuleList): string[] {
  const out: string[] = [];
  for (const rule of Array.from(rules)) {
    const at = /^@([\w-]+)/.exec(rule.cssText)?.[1]?.toLowerCase();
    if (!at && rule.type === STYLE_RULE) {
      const r = rule as CSSStyleRule;
      out.push(`${splitSelectors(r.selectorText).map(scopeSelector).join(", ")} { ${r.style.cssText} }`);
    } else if (at && GROUPS.has(at) && "cssRules" in rule) {
      // @media, @supports, @container and @layer blocks: keep the condition, scope what's inside.
      const header = rule.cssText.slice(0, rule.cssText.indexOf("{")).trim();
      out.push(`${header} {\n${rebuild((rule as CSSGroupingRule).cssRules).join("\n")}\n}`);
    } else if (at && KEEP.has(at)) {
      out.push(rule.cssText);
    }
    // Anything else (@import, unknown rules) is dropped.
  }
  return out;
}

/** The custom CSS limited to rendered documents, or "" when there's none (or it can't be parsed). */
export function scopeCustomCss(css: string): string {
  if (!css.trim()) return "";
  const rules = parseRules(css);
  return rules ? rebuild(rules).join("\n") : "";
}
