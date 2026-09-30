import { describe, expect, it } from "vitest";
import { mathToSvg } from "../src/services/mathSvg";

describe("display math as SVG (PDF export)", () => {
  it("draws a formula as a standalone SVG sized in points", () => {
    const r = mathToSvg(String.raw`\sum_{i=1}^n \frac{a_i}{b} \rightarrow \{x \in A\}`);
    expect(r).not.toBeNull();
    expect(r!.svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    // Paths inline (no <use> references to a shared font cache), in the text colour.
    expect(r!.svg).not.toContain("<use");
    expect(r!.svg).not.toContain("currentColor");
    // Display style: the sum's limits make it taller than a line of text.
    expect(r!.height).toBeGreaterThan(20);
    expect(r!.width).toBeGreaterThan(r!.height);
  });

  it("returns null for TeX it can't typeset", () => {
    expect(mathToSvg(String.raw`\notacommand{x}`)).toBeNull();
    expect(mathToSvg(String.raw`\frac{a}`)).toBeNull();
  });
});
