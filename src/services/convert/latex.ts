/**
 * A small LaTeX math parser for exporting formulas as native equations
 * (Word). It covers the common subset (fractions, roots, sub- and
 * superscripts, sums, integrals, limits, \left…\right brackets, text, Greek
 * letters, operators, function names, \not and matrix environments) and throws
 * `UnsupportedLatex` for anything else (other environments, alignment, unknown commands), so the
 * caller can keep the formula's source instead of exporting it wrongly.
 */

export type MathNode =
  | { t: "text"; v: string; upright?: boolean }
  | { t: "fn"; name: string; body: MathNode[] }
  | { t: "group"; body: MathNode[] }
  | { t: "frac"; num: MathNode[]; den: MathNode[] }
  | { t: "sqrt"; body: MathNode[]; degree?: MathNode[] }
  | { t: "scripts"; base: MathNode[]; sub?: MathNode[]; sup?: MathNode[] }
  | { t: "bigop"; op: "sum" | "int" | "prod" | "lim"; sub?: MathNode[]; sup?: MathNode[]; body: MathNode[] }
  | { t: "fence"; open: string; close: string; body: MathNode[] }
  /** A matrix: rows of cells, inside the environment's brackets. */
  | { t: "matrix"; open: string; close: string; rows: MathNode[][][] };

export class UnsupportedLatex extends Error {}

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", varpi: "ϖ", rho: "ρ",
  sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", cdot: "⋅", pm: "±", mp: "∓", div: "÷", ast: "∗", star: "⋆", circ: "∘", bullet: "∙",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", sim: "∼", simeq: "≃", equiv: "≡", cong: "≅",
  propto: "∝", ll: "≪", gg: "≫", lt: "<", gt: ">",
  to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔", Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔",
  mapsto: "↦", implies: "⟹", iff: "⟺", uparrow: "↑", downarrow: "↓",
  in: "∈", notin: "∉", ni: "∋", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", cup: "∪", cap: "∩",
  setminus: "∖", emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬", lnot: "¬", land: "∧", wedge: "∧",
  lor: "∨", vee: "∨", oplus: "⊕", otimes: "⊗", perp: "⊥", parallel: "∥", angle: "∠", triangle: "△",
  infty: "∞", partial: "∂", nabla: "∇", hbar: "ℏ", ell: "ℓ", Re: "ℜ", Im: "ℑ", aleph: "ℵ", prime: "′", degree: "°",
  ldots: "…", cdots: "⋯", dots: "…", vdots: "⋮", ddots: "⋱", langle: "⟨", rangle: "⟩", lvert: "|", rvert: "|",
  vert: "|", Vert: "‖", mid: "∣", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
  nsubseteq: "⊈", nsupseteq: "⊉", nsim: "≁", nmid: "∤", nparallel: "∦", nvdash: "⊬", nvDash: "⊭", nexists: "∄",
  nrightarrow: "↛", nleftarrow: "↚", nRightarrow: "⇏", nLeftarrow: "⇍", nLeftrightarrow: "⇎",
  "{": "{", "}": "}", "%": "%", "&": "&", "_": "_", "#": "#", "$": "$", "|": "‖",
  ",": " ", ";": " ", ":": " ", " ": " ", quad: " ", qquad: "  ", "!": "",
};

const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "log", "ln", "lg", "exp", "max", "min", "sup", "inf", "det", "dim", "ker", "gcd", "deg", "arg", "Pr",
]);

/** \not before a symbol: the negated symbol. */
const NEGATED: Record<string, string> = {
  "=": "≠", "∈": "∉", "∋": "∌", "⊂": "⊄", "⊃": "⊅", "⊆": "⊈", "⊇": "⊉", "≡": "≢", "∼": "≁", "∣": "∤", "∥": "∦",
  "∃": "∄", "→": "↛", "←": "↚", "⇒": "⇏", "⇐": "⇍", "⇔": "⇎",
};

/** Matrix environments and their brackets. */
const MATRICES: Record<string, [string, string]> = {
  matrix: ["", ""], smallmatrix: ["", ""], pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"],
};

const BIG_OPS: Record<string, "sum" | "int" | "prod" | "lim"> = { sum: "sum", int: "int", prod: "prod", lim: "lim" };

const DOUBLE_STRUCK: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ", H: "ℍ" };

/** Relations end the body of a sum or integral: `\sum_k a_k = S`. */
const RELATIONS = new Set(["=", "<", ">", "≤", "≥", "≠", "≈", "≡", "≢", "∼", "≁", "≃", "≅", "∝", "→", "⇒", "⇔", "↦", ",", ";"]);

function tokenize(src: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < src.length; ) {
    const ch = src[i];
    if (ch === "\\") {
      const m = /^\\([a-zA-Z]+|.)/.exec(src.slice(i));
      if (!m) throw new UnsupportedLatex("Trailing backslash");
      tokens.push(m[0]);
      i += m[0].length;
    } else if (/\s/.test(ch)) {
      // Kept (collapsed) for \text{…}; skipped everywhere else.
      if (tokens[tokens.length - 1] !== " ") tokens.push(" ");
      i++;
    } else if (/\d/.test(ch)) {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i))!;
      tokens.push(m[0]);
      i += m[0].length;
    } else {
      tokens.push(ch);
      i++;
    }
  }
  return tokens;
}

class Parser {
  private i = 0;
  /** Inside a matrix, "&" and "\\" end a cell and \end ends the matrix. */
  private matrixDepth = 0;
  constructor(private tokens: string[]) {}

  parse(): MathNode[] {
    const nodes = this.list(null);
    if (this.i < this.tokens.length) throw new UnsupportedLatex(`Unexpected ${this.tokens[this.i]}`);
    return nodes;
  }

  /** The next token that isn't whitespace. */
  private peek() {
    while (this.tokens[this.i] === " ") this.i++;
    return this.tokens[this.i];
  }

  /** Nodes until `stop` ("}" or "\\right"), which is left unconsumed. */
  private list(stop: string | null): MathNode[] {
    const out: MathNode[] = [];
    while (this.i < this.tokens.length && this.peek() !== stop) {
      const tok = this.peek();
      if (tok === "}" || tok === "\\right") break;
      if (this.matrixDepth && (tok === "&" || tok === "\\\\" || tok === "\\end")) break;
      if (tok === "^" || tok === "_") {
        this.i++;
        const arg = this.argument();
        const last = out.pop();
        if (last?.t === "bigop") {
          if (tok === "^" ? last.sup : last.sub) throw new UnsupportedLatex("Double script");
          out.push({ ...last, [tok === "^" ? "sup" : "sub"]: arg });
        } else if (last?.t === "scripts" && !(tok === "^" ? last.sup : last.sub)) {
          out.push({ ...last, [tok === "^" ? "sup" : "sub"]: arg });
        } else {
          out.push({ t: "scripts", base: last ? [last] : [], [tok === "^" ? "sup" : "sub"]: arg });
        }
        continue;
      }
      out.push(this.atom());
    }
    // A function name takes the next atom (sin x, log(n)) as its argument.
    for (let k = 0; k < out.length; k++) {
      const node = out[k];
      if (node.t === "fn" && node.body.length === 0 && k + 1 < out.length && !(out[k + 1].t === "text" && RELATIONS.has((out[k + 1] as { v: string }).v))) {
        out.splice(k, 2, { ...node, body: [out[k + 1]] });
      }
    }
    // Sums, products, integrals and limits take the following atoms, up to a relation, as their body.
    for (let k = 0; k < out.length; k++) {
      const node = out[k];
      if (node.t === "bigop" && node.body.length === 0) {
        let end = k + 1;
        while (end < out.length && !(out[end].t === "text" && RELATIONS.has((out[end] as { v: string }).v))) end++;
        out.splice(k, end - k, { ...node, body: out.slice(k + 1, end) });
      }
    }
    return out;
  }

  /** A script or command argument: one token or a {group}. */
  private argument(): MathNode[] {
    if (this.peek() === "{") {
      this.i++;
      const body = this.list("}");
      this.expect("}");
      return body;
    }
    if (this.peek() === undefined || this.peek() === "}") throw new UnsupportedLatex("Missing argument");
    return [this.atom()];
  }

  private expect(tok: string) {
    if (this.peek() !== tok) throw new UnsupportedLatex(`Expected ${tok}`);
    this.i++;
  }

  /** The raw text of a {…} argument, for \text and friends. */
  private rawArgument(): string {
    this.expect("{");
    let depth = 1;
    let text = "";
    while (this.i < this.tokens.length) {
      const tok = this.tokens[this.i++];
      if (tok === "{") depth++;
      if (tok === "}" && --depth === 0) return text;
      text += tok.startsWith("\\") && tok.length === 2 ? tok[1] : tok === "~" ? " " : tok;
    }
    throw new UnsupportedLatex("Unclosed {");
  }

  private delimiter(): string {
    this.peek();
    const tok = this.tokens[this.i++];
    if (tok === undefined) throw new UnsupportedLatex("Missing delimiter");
    if (tok === ".") return "";
    if (tok.startsWith("\\")) {
      const sym = SYMBOLS[tok.slice(1)];
      if (sym === undefined) throw new UnsupportedLatex(`Unknown delimiter ${tok}`);
      return sym;
    }
    return tok;
  }

  private atom(): MathNode {
    this.peek();
    const tok = this.tokens[this.i++];
    if (tok === "{") {
      const body = this.list("}");
      this.expect("}");
      return { t: "group", body };
    }
    if (!tok.startsWith("\\")) {
      if (tok === "&" || tok === "~") throw new UnsupportedLatex(`Unsupported ${tok}`);
      return { t: "text", v: tok === "'" ? "′" : tok === "-" ? "−" : tok === "*" ? "∗" : tok };
    }
    const name = tok.slice(1);
    switch (name) {
      case "frac":
      case "dfrac":
      case "tfrac":
        return { t: "frac", num: this.argument(), den: this.argument() };
      case "sqrt": {
        let degree: MathNode[] | undefined;
        if (this.peek() === "[") {
          this.i++;
          degree = this.list("]");
          this.expect("]");
        }
        return { t: "sqrt", body: this.argument(), degree };
      }
      case "left": {
        const open = this.delimiter();
        const body = this.list("\\right");
        this.expect("\\right");
        return { t: "fence", open, close: this.delimiter(), body };
      }
      case "text":
      case "textrm":
      case "mathrm":
      case "operatorname":
      case "textit":
      case "mathit":
      case "textbf":
      case "mathbf":
      case "mathsf":
      case "mathtt":
        return { t: "text", v: this.rawArgument(), upright: name !== "mathit" && name !== "textit" };
      case "mathbb": {
        const letters = this.rawArgument();
        return { t: "text", v: [...letters].map((c) => DOUBLE_STRUCK[c] ?? c).join(""), upright: true };
      }
      case "not": {
        const next = this.atom();
        const negated = next.t === "text" ? NEGATED[next.v] : undefined;
        if (!negated) throw new UnsupportedLatex("\\not before this symbol");
        return { t: "text", v: negated };
      }
      case "begin":
        return this.matrix();
      case "big": case "Big": case "bigg": case "Bigg": case "displaystyle": case "textstyle": case "limits":
        return { t: "group", body: [] };
    }
    if (name in BIG_OPS) return { t: "bigop", op: BIG_OPS[name], body: [] };
    if (FUNCTIONS.has(name)) return { t: "fn", name, body: [] };
    if (name in SYMBOLS) return { t: "text", v: SYMBOLS[name] };
    throw new UnsupportedLatex(`Unsupported command \\${name}`);
  }

  /** A matrix environment, after \begin: cells split by "&", rows by "\\". */
  private matrix(): MathNode {
    const env = this.rawArgument();
    const brackets = MATRICES[env];
    if (!brackets) throw new UnsupportedLatex(`The ${env} environment isn't supported`);
    this.matrixDepth++;
    const rows: MathNode[][][] = [[]];
    for (;;) {
      rows[rows.length - 1].push(this.list(null));
      const tok = this.peek();
      this.i++;
      if (tok === "&") continue;
      if (tok === "\\\\") rows.push([]);
      else if (tok === "\\end") break;
      else throw new UnsupportedLatex(`Unclosed ${env}`);
    }
    if (this.rawArgument() !== env) throw new UnsupportedLatex(`Unclosed ${env}`);
    this.matrixDepth--;
    // A trailing "\\" leaves an empty last row.
    const last = rows[rows.length - 1];
    if (rows.length > 1 && last.length === 1 && !last[0].length) rows.pop();
    return { t: "matrix", open: brackets[0], close: brackets[1], rows };
  }
}

/** Parses a LaTeX formula; throws UnsupportedLatex for constructs outside the supported subset. */
export function parseLatex(src: string): MathNode[] {
  return new Parser(tokenize(src)).parse();
}

/** A readable plain-text form of a parsed formula (for tests and fallbacks). */
export function mathToText(nodes: MathNode[]): string {
  const wrap = (n: MathNode[]) => {
    const s = mathToText(n);
    return s.length > 1 ? `(${s})` : s;
  };
  return nodes
    .map((n): string => {
      switch (n.t) {
        case "text": return n.v;
        case "fn": return `${n.name} ${mathToText(n.body)}`.trimEnd();
        case "group": return mathToText(n.body);
        case "frac": return `${wrap(n.num)}/${wrap(n.den)}`;
        case "sqrt": return `${n.degree ? wrap(n.degree) : ""}√${wrap(n.body)}`;
        case "scripts": return `${mathToText(n.base)}${n.sub ? `_${wrap(n.sub)}` : ""}${n.sup ? `^${wrap(n.sup)}` : ""}`;
        case "bigop": return `${{ sum: "∑", int: "∫", prod: "∏", lim: "lim" }[n.op]}${n.sub ? `_${wrap(n.sub)}` : ""}${n.sup ? `^${wrap(n.sup)}` : ""} ${mathToText(n.body)}`.trimEnd();
        case "fence": return `${n.open}${mathToText(n.body)}${n.close}`;
        case "matrix": return `${n.open}${n.rows.map((row) => row.map(mathToText).join(", ")).join("; ")}${n.close}`;
      }
    })
    .join("");
}
