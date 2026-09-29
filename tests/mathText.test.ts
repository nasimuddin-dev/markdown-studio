import { describe, expect, it } from "vitest";
import { EXTRA_GLYPHS, mathTextRuns } from "../src/services/convert/mathText";

const text = (latex: string) => mathTextRuns(latex)?.map((r) => r.text).join("") ?? null;

describe("inline formulas as PDF text", () => {
  it("sets variables in italics and scripts as superscripts and subscripts", () => {
    expect(mathTextRuns("E = mc^2")).toEqual([
      { text: "E", italics: true },
      { text: " = " },
      { text: "mc", italics: true },
      { text: "2", sup: true },
    ]);
    expect(mathTextRuns("x_i")).toEqual([{ text: "x", italics: true }, { text: "i", italics: true, sub: true }]);
  });

  it("spaces operators and keeps signs unary", () => {
    expect(text("a+b-c")).toBe("a + b − c");
    expect(text("-x")).toBe("−x");
    expect(text("f(-1)")).toBe("f(−1)");
    expect(text("a = -b")).toBe("a = −b");
    expect(text("x^{-1}")).toBe("x−1");
  });

  it("writes fractions, roots, functions and big operators on one line", () => {
    expect(text("\\frac{a+b}{2}")).toBe("(a + b)/2");
    expect(text("\\sqrt{2}")).toBe("√2");
    expect(text("\\sin x")).toBe("sin x");
    expect(text("\\sum_{i=1}^{n} i")).toBe("∑i=1n i");
    expect(text("\\alpha \\leq \\beta")).toBe("α ≤ β");
    expect(text("\\left( x \\right)")).toBe("(x)");
  });

  it("maps look-alike symbols to glyphs the font has", () => {
    expect(text("\\epsilon \\cdot \\phi")).toBe("ε·φ");
  });

  it("returns null for glyphs the font lacks, nested scripts and unsupported LaTeX", () => {
    expect(mathTextRuns("A \\subset B")).toBeNull();
    expect(mathTextRuns("x \\to \\infty")).toBeNull();
    expect(mathTextRuns("e^{x^2}")).toBeNull();
    expect(mathTextRuns("\\begin{matrix} a \\end{matrix}")).toBeNull();
    expect(mathTextRuns("\\unknown")).toBeNull();
  });

  it("only allows characters the bundled Roboto font can draw", async () => {
    // fontkit comes with pdfmake (through pdfkit) and has no type declarations.
    const fontkitName = "fontkit";
    const fontkit = await import(/* @vite-ignore */ fontkitName);
    const vfsMod = (await import("pdfmake/build/vfs_fonts")) as unknown as { default?: Record<string, string> } & Record<string, string>;
    const vfs = vfsMod.default ?? vfsMod;
    for (const name of ["Roboto-Regular.ttf", "Roboto-Italic.ttf"]) {
      const font = (fontkit as unknown as { create(b: Uint8Array): { hasGlyphForCodePoint(c: number): boolean } }).create(Uint8Array.from(atob(vfs[name]), (c) => c.charCodeAt(0)));
      const greek = Array.from({ length: 0x3c9 - 0x391 + 1 }, (_, i) => String.fromCodePoint(0x391 + i)).filter((c) => c !== "΢");
      const missing = [...EXTRA_GLYPHS, ...greek].filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!));
      expect(missing, name).toEqual([]);
    }
  });
});
