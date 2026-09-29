/**
 * Inline formulas for PDF export, as styled text: PDF text can't flow around
 * pictures, so `$E = mc^2$` becomes text runs with italic variables and real
 * superscripts and subscripts. Formulas outside the LaTeX subset, with nested
 * scripts, or needing symbols the bundled Roboto font doesn't have (arrows,
 * set notation…) return null, and the caller keeps their LaTeX source.
 */
import { parseLatex, type MathNode } from "./latex";

export interface MathRun {
  text: string;
  italics?: boolean;
  sup?: boolean;
  sub?: boolean;
}

/** Symbols Roboto lacks, replaced by a glyph it has that looks the same. */
const SUBSTITUTES: Record<string, string> = { "ϵ": "ε", "ϕ": "φ", "⋅": "·", "∙": "·", "∗": "*", "∼": "~", "⋯": "…" };

/** Characters beyond ASCII, Latin-1 and Greek that Roboto can draw (checked by a test). */
export const EXTRA_GLYPHS = "ϑϖ−′″∑∫∏√∞∂≤≥≠≈…ℓ";

const SPACED = new Set(["=", "<", ">", "≤", "≥", "≠", "≈", "+", "−", "×", "÷", "±", "~"]);

function hasGlyph(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || (cp >= 0x391 && cp <= 0x3c9) || EXTRA_GLYPHS.includes(ch);
}

class Unrenderable extends Error {}

function runs(nodes: MathNode[], pos: "sup" | "sub" | undefined): MathRun[] {
  const out: MathRun[] = [];
  const push = (text: string, italics = false) => out.push({ text, ...(italics ? { italics } : {}), ...(pos ? { [pos]: true } : {}) });
  /** Wraps a multi-character argument in brackets: a/(b+c). */
  const wrapped = (body: MathNode[]) => {
    const inner = runs(body, pos);
    if (inner.map((r) => r.text).join("").trim().length <= 1) return inner;
    return [{ ...inner[0], italics: false, text: "(" }, ...inner, { ...inner[0], italics: false, text: ")" }].map(clean);
  };
  const scripts = (sub?: MathNode[], sup?: MathNode[]) => {
    if (pos && (sub || sup)) throw new Unrenderable("Nested scripts");
    if (sub) out.push(...runs(sub, "sub"));
    if (sup) out.push(...runs(sup, "sup"));
  };
  for (const n of nodes) {
    switch (n.t) {
      case "text": {
        const v = [...n.v].map((c) => SUBSTITUTES[c] ?? c).join("");
        const prev = out[out.length - 1]?.text ?? "";
        // A sign at the start or after a bracket or operator is unary: -x, (-1), a = -b.
        const unary = !prev || /[([{,]$|\s$/.test(prev);
        if (!n.upright && SPACED.has(v) && !pos) push(unary && (v === "−" || v === "+" || v === "±") ? v : ` ${v} `);
        else push(v, !n.upright && /^[A-Za-zα-ω]$/.test(v));
        break;
      }
      case "fn":
        push(n.name);
        if (n.body.length) {
          push(" ");
          out.push(...runs(n.body, pos));
        }
        break;
      case "group":
        out.push(...runs(n.body, pos));
        break;
      case "frac":
        out.push(...wrapped(n.num));
        push("/");
        out.push(...wrapped(n.den));
        break;
      case "sqrt":
        if (n.degree) {
          if (pos) throw new Unrenderable("Nested scripts");
          out.push(...runs(n.degree, "sup"));
        }
        push("√");
        out.push(...wrapped(n.body));
        break;
      case "scripts":
        out.push(...runs(n.base, pos));
        scripts(n.sub, n.sup);
        break;
      case "bigop":
        push({ sum: "∑", int: "∫", prod: "∏", lim: "lim" }[n.op]);
        scripts(n.sub, n.sup);
        if (n.body.length) {
          push(" ");
          out.push(...runs(n.body, pos));
        }
        break;
      case "fence":
        push(n.open);
        out.push(...runs(n.body, pos));
        push(n.close);
        break;
    }
  }
  return out;
}

function clean(run: MathRun): MathRun {
  const { italics, ...rest } = run;
  return italics ? run : rest;
}

/** Text runs for an inline formula, or null to keep its LaTeX source. */
export function mathTextRuns(latex: string): MathRun[] | null {
  let out: MathRun[];
  try {
    out = runs(parseLatex(latex), undefined);
  } catch {
    return null;
  }
  // Merge neighbours with the same style, and trim the padding around a leading or trailing operator.
  const merged: MathRun[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && !!last.italics === !!r.italics && !!last.sup === !!r.sup && !!last.sub === !!r.sub) last.text += r.text;
    else merged.push({ ...r });
  }
  if (merged.length) {
    merged[0].text = merged[0].text.replace(/^ +/, "");
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/ +$/, "");
  }
  const result = merged.filter((r) => r.text !== "").map((r) => ({ ...r, text: r.text.replace(/ {2,}/g, " ") }));
  if (!result.length || !result.every((r) => [...r.text].every(hasGlyph))) return null;
  return result;
}
