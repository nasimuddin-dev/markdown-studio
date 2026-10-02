import {
  Math as WordMath, MathAngledBrackets, MathCurlyBrackets, MathFraction, MathFunction, MathIntegral, MathRadical, MathRoundBrackets,
  MathRun, MathSquareBrackets, MathSubScript, MathSubSuperScript, MathSum, MathSuperScript, XmlComponent, BuilderElement,
  type MathComponent,
} from "docx";
import { parseLatex, UnsupportedLatex, type MathNode } from "./latex";

/** Text for an `m:t` element. */
class MathText extends XmlComponent {
  constructor(text: string) {
    super("m:t");
    this.root.push(text);
  }
}

/**
 * A math run in plain (upright) style, `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>…</m:t></m:r>`,
 * for function names such as sin and lim, which Word would otherwise set in math italics.
 */
class PlainMathRun extends XmlComponent {
  constructor(text: string) {
    super("m:r");
    this.root.push(
      new BuilderElement({
        name: "m:rPr",
        children: [new BuilderElement<{ val: string }>({ name: "m:sty", attributes: { val: { key: "m:val", value: "p" } } })],
      }),
    );
    this.root.push(new MathText(text));
  }
}
const plain = (text: string) => new PlainMathRun(text) as unknown as MathRun;

/** Word equation parts (Office Math) for a parsed formula. */
function components(nodes: MathNode[]): MathComponent[] {
  const out: MathComponent[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push(new MathRun(text));
    text = "";
  };
  const scripts = (base: MathComponent[], sub?: MathNode[], sup?: MathNode[]): MathComponent => {
    const children = base.length ? base : [new MathRun("")];
    if (sub && sup) return new MathSubSuperScript({ children, subScript: components(sub), superScript: components(sup) });
    if (sup) return new MathSuperScript({ children, superScript: components(sup) });
    return new MathSubScript({ children, subScript: components(sub ?? []) });
  };
  for (const n of nodes) {
    if (n.t === "text") {
      text += n.v;
      continue;
    }
    if (n.t === "group") {
      flush();
      out.push(...components(n.body));
      continue;
    }
    flush();
    switch (n.t) {
      case "fn":
        // Word shows a function's name upright: sin x, log n.
        out.push(new MathFunction({ name: [plain(n.name)], children: n.body.length ? components(n.body) : [new MathRun("")] }));
        break;
      case "frac":
        out.push(new MathFraction({ numerator: components(n.num), denominator: components(n.den) }));
        break;
      case "sqrt":
        out.push(new MathRadical({ children: components(n.body), degree: n.degree ? components(n.degree) : undefined }));
        break;
      case "scripts":
        out.push(scripts(components(n.base), n.sub, n.sup));
        break;
      case "bigop": {
        const limits = { subScript: n.sub ? components(n.sub) : undefined, superScript: n.sup ? components(n.sup) : undefined };
        if (n.op === "sum") out.push(new MathSum({ children: components(n.body), ...limits }));
        else if (n.op === "int") out.push(new MathIntegral({ children: components(n.body), ...limits }));
        else if (n.op === "lim") {
          // An upright "lim" with its limit below.
          const name = n.sub ? [new MathSubScript({ children: [plain("lim")], subScript: components(n.sub) })] : [plain("lim")];
          out.push(new MathFunction({ name, children: n.body.length ? components(n.body) : [new MathRun("")] }));
        } else {
          out.push(n.sub || n.sup ? scripts([new MathRun("∏")], n.sub, n.sup) : new MathRun("∏"));
          out.push(...components(n.body));
        }
        break;
      }
      case "fence": {
        const children = components(n.body);
        const pair = `${n.open}${n.close}`;
        if (pair === "()") out.push(new MathRoundBrackets({ children }));
        else if (pair === "[]") out.push(new MathSquareBrackets({ children }));
        else if (pair === "{}") out.push(new MathCurlyBrackets({ children }));
        else if (pair === "⟨⟩") out.push(new MathAngledBrackets({ children }));
        else {
          if (n.open) out.push(new MathRun(n.open));
          out.push(...children);
          if (n.close) out.push(new MathRun(n.close));
        }
        break;
      }
      case "matrix":
        // The docx library has no matrix element: Word keeps the formula's LaTeX.
        throw new UnsupportedLatex("Matrices in Word equations");
    }
  }
  flush();
  return out;
}

/**
 * A native Word equation for a LaTeX formula, or null when the formula uses
 * something outside the supported subset (the caller keeps the LaTeX text).
 */
export function latexToWordMath(latex: string): WordMath | null {
  try {
    const children = components(parseLatex(latex));
    return children.length ? new WordMath({ children }) : null;
  } catch {
    return null;
  }
}
