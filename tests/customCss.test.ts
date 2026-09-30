import { describe, expect, it } from "vitest";
import { scopeCustomCss, scopeSelector } from "../src/services/customCss";

describe("custom CSS", () => {
  it("puts selectors inside the document", () => {
    expect(scopeSelector("h1")).toBe(".markdown-body h1");
    expect(scopeSelector("body")).toBe(".markdown-body");
    expect(scopeSelector("html body > p")).toBe(".markdown-body > p");
    expect(scopeSelector(":root")).toBe(".markdown-body");
    expect(scopeSelector(".markdown-body table")).toBe(".markdown-body table");
    expect(scopeSelector(".markdown-bodyx")).toBe(".markdown-body .markdown-bodyx");
    expect(scopeSelector("bodyguard")).toBe(".markdown-body bodyguard");
  });

  it("rebuilds the CSS scoped to the document", () => {
    const out = scopeCustomCss("h1, h2 { color: rebeccapurple }\n@media print { table { font-size: 10pt } }\n@import url(x.css);");
    expect(out).toContain(".markdown-body h1, .markdown-body h2 { color: rebeccapurple; }");
    expect(out).toMatch(/@media print \{\n\.markdown-body table \{ font-size: 10pt; \}\n\}/);
    expect(out).not.toContain("@import");
  });

  it("can't be broken out of", () => {
    const out = scopeCustomCss("p { color: red } } body, .app { display: none }");
    const selectors = out.split("\n").flatMap((rule) => rule.slice(0, rule.indexOf("{")).split(",").map((s) => s.trim()));
    expect(selectors).toContain(".markdown-body .app");
    for (const s of selectors) expect(s.startsWith(".markdown-body")).toBe(true);
    expect(scopeCustomCss("")).toBe("");
    expect(scopeCustomCss("   ")).toBe("");
  });
});

describe("custom CSS setting", () => {
  it("is kept as text up to a limit", async () => {
    const { sanitizeSettings, MAX_CUSTOM_CSS } = await import("../src/stores/settingsStore");
    expect(sanitizeSettings({ customCss: "h1 { color: red }" }).customCss).toBe("h1 { color: red }");
    expect(sanitizeSettings({ customCss: 42 }).customCss).toBe("");
    expect(sanitizeSettings({ customCss: "x".repeat(MAX_CUSTOM_CSS + 5) }).customCss).toHaveLength(MAX_CUSTOM_CSS);
  });
});
