/**
 * Inline formulas for PDF export, as styled text: PDF text can't flow around
 * pictures, so `$E = mc^2$` becomes text runs with italic variables and real
 * superscripts and subscripts. Formulas outside the LaTeX subset, with nested
 * scripts, or with a symbol none of the fonts has, return null, and the caller
 * keeps their LaTeX source. Symbols the bundled Roboto font lacks (arrows, set
 * notation, logic…) are drawn in KaTeX's fonts, as in the preview.
 */
import { parseLatex, type MathNode } from "./latex";

export interface MathRun {
  text: string;
  italics?: boolean;
  sup?: boolean;
  sub?: boolean;
  /** Drawn in KaTeX's main font (`symbols`), its AMS font (`ams`), or as a plain capital in the AMS font (`doubleStruck`: ℝ is "R"). */
  font?: "symbols" | "ams" | "doubleStruck";
  /** A single symbol with a slash drawn over it (∉ is ∈ with a slash), as KaTeX draws it. */
  slashed?: boolean;
}

/** Symbols Roboto lacks, replaced by a glyph it has that looks the same. */
const SUBSTITUTES: Record<string, string> = { "ϵ": "ε", "ϕ": "φ", "⋅": "·", "∙": "·", "∗": "*", "∼": "~", "⋯": "…", "‖": "∥" };

/** Characters beyond ASCII, Latin-1 and Greek that Roboto can draw (checked by a test). */
export const EXTRA_GLYPHS = "ϑϖ−′″∑∫∏√∞∂≤≥≠≈…ℓ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎";

/** Symbols Roboto lacks that KaTeX_Main-Regular has (checked by a test). */
export const SYMBOL_GLYPHS = "∓⋆∘≃≡≅∝≪≫→←↔⇒⇐⇔↦⟹⟺↑↓∈∋⊂⊆⊃⊇∪∩∖∅∀∃∧∨⊕⊗⊥∥∠△∇ℏℜℑℵ⋮⋱⟨⟩∣⌊⌋⌈⌉";

/** Negated relations that KaTeX_AMS-Regular has (checked by a test). */
export const AMS_GLYPHS = "⊈⊉≁∤∦⊬⊭⇏⇍⇎↛↚∄";

/** Negated symbols no bundled font has: drawn as the symbol with a slash over it. */
const SLASHED: Record<string, string> = { "∉": "∈", "∌": "∋", "⊄": "⊂", "⊅": "⊃", "≢": "≡" };

/** The width of "/" in KaTeX_Main-Regular, in em (checked by a test). */
export const SLASH_WIDTH = 0.5;

/**
 * The spacing, in em, that moves the slash back over the symbol: like KaTeX's
 * \notin, the slash ends 1mu (1/18 em) before the symbol's end.
 */
export const SLASH_SPACING = -(SLASH_WIDTH + 1 / 18);

/** Double-struck capitals (\mathbb), which KaTeX draws as plain capitals in its AMS font. */
export const DOUBLE_STRUCK_LETTERS: Record<string, string> = { "ℝ": "R", "ℕ": "N", "ℤ": "Z", "ℚ": "Q", "ℂ": "C", "ℙ": "P", "ℍ": "H" };

/** Relations and binary operators, set with a space on each side (as TeX does). */
/** Characters a script inside a script can use (Roboto has these). */
const SUPERSCRIPT_CHARS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ",
};
const SUBSCRIPT_CHARS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
};

const SPACED = new Set([
  "=", "<", ">", "≤", "≥", "≠", "≈", "+", "−", "×", "÷", "±", "∓", "~", "≡", "≅", "≃", "∝", "≪", "≫",
  "→", "←", "↔", "⇒", "⇐", "⇔", "↦", "⟹", "⟺", "∈", "∋", "⊂", "⊆", "⊃", "⊇", "∪", "∩", "∖", "∧", "∨", "⊕", "⊗", "∘",
  "∉", "∌", "⊄", "⊅", "≢", "⊈", "⊉", "≁", "∤", "∦", "⊬", "⊭", "⇏", "⇍", "⇎", "↛", "↚",
]);

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
    if (pos && (sub || sup)) {
      // A script inside a script (e^{-x^2}): digits and signs as Unicode superscript or subscript
      // characters; anything else (e^{x^a}) in the linear form x^a, as in plain-text math.
      for (const [body, chars, mark] of [[sub, SUBSCRIPT_CHARS, "_"], [sup, SUPERSCRIPT_CHARS, "^"]] as const) {
        if (!body) continue;
        const text = runs(body, pos).map((r) => r.text).join("").replace(/\s+/g, "");
        if (!text) throw new Unrenderable("Empty script");
        if ([...text].every((c) => c in chars)) push([...text].map((c) => chars[c]).join(""));
        else {
          push(mark);
          out.push(...wrapped(body));
        }
      }
      return;
    }
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
      case "matrix":
        // In a line of text, a matrix is written row by row: (a, b; c, d).
        push(n.open || "[");
        n.rows.forEach((row, r) => {
          if (r) push("; ");
          row.forEach((cell, c) => {
            if (c) push(", ");
            out.push(...runs(cell, pos));
          });
        });
        push(n.close || "]");
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
  if (!result.length) return null;
  // Split runs where the font changes; a character no font has keeps the LaTeX.
  const split: MathRun[] = [];
  for (const r of result) {
    const scripted = { ...(r.sup ? { sup: true } : {}), ...(r.sub ? { sub: true } : {}) };
    for (const ch of r.text) {
      if (SLASHED[ch]) {
        // A run of its own: the PDF builder draws the slash over it.
        split.push({ text: SLASHED[ch], ...scripted, font: "symbols", slashed: true });
        continue;
      }
      const font = hasGlyph(ch) ? undefined : SYMBOL_GLYPHS.includes(ch) ? "symbols" : AMS_GLYPHS.includes(ch) ? "ams" : DOUBLE_STRUCK_LETTERS[ch] ? "doubleStruck" : null;
      if (font === null) return null;
      const text = font === "doubleStruck" ? DOUBLE_STRUCK_LETTERS[ch] : ch;
      // The symbol fonts are upright.
      const italics = !!r.italics && !font;
      const last = split[split.length - 1];
      if (last && !last.slashed && last.font === font && !!last.italics === italics && !!last.sup === !!r.sup && !!last.sub === !!r.sub) last.text += text;
      else split.push({ text, ...(italics ? { italics } : {}), ...scripted, ...(font ? { font } : {}) });
    }
  }
  return split;
}
