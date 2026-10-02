import { describe, expect, it } from "vitest";
import { mathToText, parseLatex, UnsupportedLatex } from "../src/services/convert/latex";

const text = (src: string) => mathToText(parseLatex(src));

describe("LaTeX math parser", () => {
  it("parses symbols, scripts and fractions", () => {
    expect(text("e^{i\\pi} + 1 = 0")).toBe("e^(iπ)+1=0");
    expect(text("x_i^2")).toBe("x_i^2");
    expect(text("\\frac{a+b}{2}")).toBe("(a+b)/2");
    expect(text("\\sqrt{x^2 + y^2}")).toBe("√(x^2+y^2)");
    expect(text("\\sqrt[3]{8}")).toBe("3√8");
    expect(text("a \\leq b \\neq c \\times d")).toBe("a≤b≠c×d");
    expect(text("-x")).toBe("−x");
  });

  it("gives sums and integrals their body up to a relation", () => {
    expect(text("\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}")).toBe("∑_(k=1)^n k=(n(n+1))/2");
    expect(text("\\int_0^1 x^2\\,dx = \\frac{1}{3}")).toBe("∫_0^1 x^2\u2009dx=1/3");
    expect(text("\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1")).toBe("lim_(x→0) (sin x)/x=1");
  });

  it("handles brackets, text, blackboard letters and functions", () => {
    expect(text("\\left( \\frac{1}{2} \\right)")).toBe("(1/2)");
    expect(text("\\left\\{ x \\right.")).toBe("{x");
    expect(text("x \\in \\mathbb{R}")).toBe("x∈ℝ");
    expect(text("f(x) = x \\text{ if } x > 0")).toBe("f(x)=x if x>0");
    expect(parseLatex("\\sin x")).toEqual([{ t: "fn", name: "sin", body: [{ t: "text", v: "x" }] }]);
    expect(text("\\log(n) + \\max x")).toBe("log (n)+max x");
  });

  it("rejects constructs it can't convert faithfully", () => {
    for (const src of [
      "\\begin{align} a \\end{align}", "\\begin{pmatrix} a & b \\end{bmatrix}", "\\begin{pmatrix} a & b", "a \\\\ b", "\\unknowncommand x", "x^", "\\frac{1}", "a & b", "\\not x", "\\end{matrix}",
    ]) {
      expect(() => parseLatex(src), src).toThrow(UnsupportedLatex);
    }
  });

  it("reads matrices row by row, with their brackets", () => {
    expect(mathToText(parseLatex("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"))).toBe("(a, b; c, d)");
    expect(mathToText(parseLatex("\\begin{bmatrix} x^2 & \\frac{1}{2} \\\\ \\end{bmatrix}"))).toBe("[x^2, 1/2]");
    expect(parseLatex("\\begin{vmatrix} 1 \\end{vmatrix}")).toEqual([{ t: "matrix", open: "|", close: "|", rows: [[[{ t: "text", v: "1" }]]] }]);
  });

  it("negates relations with \\not and knows the AMS negated symbols", () => {
    expect(mathToText(parseLatex("x \\not\\in A \\not= B \\not\\subset C"))).toBe("x∉A≠B⊄C");
    expect(mathToText(parseLatex("A \\nsubseteq B \\nRightarrow \\nexists"))).toBe("A⊈B⇏∄");
  });
});
