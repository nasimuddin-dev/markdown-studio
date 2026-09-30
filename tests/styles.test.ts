/**
 * Rules for the UI stylesheets (src/styles/app/*.css), so they stay consistent
 * as the app grows: design tokens instead of literal colours, sizes, radii
 * and layers; no selector defined twice (the cause of past UI bugs); every
 * area file imported; every custom property defined.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STYLES = join(__dirname, "..", "src", "styles");
const APP = join(STYLES, "app");
const files = readdirSync(APP).filter((f) => f.endsWith(".css"));
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const css = Object.fromEntries(files.map((f) => [f, read(join(APP, f))]));

interface Decl {
  file: string;
  line: number;
  /** Enclosing at-rules, outermost first, e.g. ["@media print"]. */
  context: string[];
  selector: string;
  property: string;
  value: string;
}

/** A small CSS walker: rules with their at-rule context, and their declarations. */
function parse(file: string, text: string) {
  const rules: Array<{ key: string; line: number }> = [];
  const decls: Decl[] = [];
  const stack: string[] = [];
  let buf = "";
  let line = 1;
  let startLine = 1;
  const src = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  for (const ch of src) {
    if (ch === "\n") line++;
    if (ch === "{") {
      const head = buf.trim().replace(/\s+/g, " ");
      stack.push(head);
      if (!head.startsWith("@")) rules.push({ key: `${stack.filter((s) => s.startsWith("@")).join(" ")} | ${head}`, line: startLine });
      buf = "";
    } else if (ch === "}" || ch === ";") {
      const text = buf.trim();
      const selector = [...stack].reverse().find((s) => !s.startsWith("@"));
      const m = /^([\w-]+)\s*:\s*([\s\S]+)$/.exec(text);
      if (m && selector) decls.push({ file, line, context: stack.filter((s) => s.startsWith("@")), selector, property: m[1], value: m[2].replace(/\s*!important$/, "") });
      if (ch === "}") stack.pop();
      buf = "";
    } else {
      if (!buf.trim()) startLine = line;
      buf += ch;
    }
  }
  return { rules, decls };
}

const parsed = files.map((f) => ({ file: f, ...parse(f, css[f]) }));
const decls = parsed.flatMap((p) => p.decls);
const outsideTokens = decls.filter((d) => d.file !== "tokens.css");
const where = (d: Decl) => `${d.file}:${d.line} ${d.selector} { ${d.property}: ${d.value} }`;

describe("UI stylesheets", () => {
  it("app.css imports every area file once, tokens first and forced colours last", () => {
    const imports = [...read(join(STYLES, "app.css")).matchAll(/@import "\.\/app\/([\w-]+\.css)";/g)].map((m) => m[1]);
    expect([...imports].sort()).toEqual([...files].sort());
    expect(imports[0]).toBe("tokens.css");
    expect(imports[imports.length - 1]).toBe("forced-colors.css");
  });

  it("defines each selector once per context (merge rules instead of repeating them)", () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const p of parsed) {
      for (const r of p.rules) {
        const at = `${p.file}:${r.line}`;
        if (seen.has(r.key)) dups.push(`${r.key} (${seen.get(r.key)} and ${at})`);
        else seen.set(r.key, at);
      }
    }
    expect(dups).toEqual([]);
  });

  it("uses colour tokens outside tokens.css (print styles excepted)", () => {
    const raw = outsideTokens.filter(
      (d) => /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(d.value) && !d.context.some((c) => c.startsWith("@media print")),
    );
    expect(raw.map(where)).toEqual([]);
  });

  it("uses the type scale for font sizes (slides have their own)", () => {
    const bad = outsideTokens.filter(
      (d) => d.property === "font-size" && d.file !== "slides.css" && !/^(var\(--text-[\w-]+\)|[\d.]+(em|%)|inherit|smaller|larger)$/.test(d.value),
    );
    expect(bad.map(where)).toEqual([]);
  });

  it("uses the radius scale", () => {
    const bad = outsideTokens.filter((d) => d.property === "border-radius" && !/^(var\(--radius-[\w-]+\)|50%|0|inherit)$/.test(d.value));
    expect(bad.map(where)).toEqual([]);
  });

  it("uses named layers for z-index (values under 10 are local to a component)", () => {
    const bad = outsideTokens.filter((d) => d.property === "z-index" && !/^(var\(--z-[\w-]+\)|[0-9]|-1|auto)$/.test(d.value));
    expect(bad.map(where)).toEqual([]);
  });

  it("uses only custom properties that are defined somewhere", () => {
    const defined = new Set(decls.filter((d) => d.property.startsWith("--")).map((d) => d.property));
    // Properties set from components (style={{ "--x": … }}) count as defined.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
    for (const f of walk(join(__dirname, "..", "src"))) for (const m of read(f).matchAll(/["'](--[\w-]+)["']/g)) defined.add(m[1]);
    const used = outsideTokens.flatMap((d) => [...d.value.matchAll(/var\((--[\w-]+)(,[^)]*)?\)/g)].filter((m) => !m[2]).map((m) => ({ name: m[1], d })));
    const undefinedVars = used.filter((u) => !defined.has(u.name)).map((u) => `${u.name} in ${where(u.d)}`);
    expect(undefinedVars).toEqual([]);
  });

  it("defines each theme colour for both the light and the dark theme", () => {
    const tokens = parse("tokens.css", css["tokens.css"]).decls;
    const light = new Set(tokens.filter((d) => d.selector === ":root" && !d.context.length && /#|rgb/.test(d.value)).map((d) => d.property));
    const dark = new Set(tokens.filter((d) => d.selector.includes('[data-theme="dark"]')).map((d) => d.property));
    // Translucent overlays and fixed highlight colours are shared by both themes.
    const shared = new Set(["--backdrop", "--backdrop-light", "--on-danger", "--find-match-current-text", "--mark-bg", "--mark-text", "--shadow-sm", "--shadow-md"]);
    const missing = [...light].filter((p) => !dark.has(p) && !shared.has(p) && !p.startsWith("--diff-") && !/--(editor-selection|selection-match|search-match|find-match)/.test(p));
    expect(missing).toEqual([]);
  });
});
