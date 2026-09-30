import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Selectors defined more than once at the top level of app.css. A second rule
 * for the same selector silently overrides the first; twice that styled the
 * wrong component (the toolbar and the Recent list). These pairs are
 * intentional (a shared rule followed by a specific one).
 */
const INTENTIONAL = [
  "body", "select", ".sidebar-pane > .outline", ".context-menu", ".tree",
  ".search-results", ".search-file", ".search-match", ".diff-add-chip", ".diff-del-chip",
];

function duplicatedSelectors(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const seen = new Map<string, number>();
  let depth = 0;
  let prelude = "";
  for (const ch of text) {
    if (ch === "{") {
      if (depth === 0 && !prelude.trim().startsWith("@")) {
        for (const sel of prelude.split(",").map((s) => s.trim().replace(/\s+/g, " "))) {
          if (sel && !sel.startsWith(":root") && !sel.startsWith("[data-theme")) seen.set(sel, (seen.get(sel) ?? 0) + 1);
        }
      }
      depth++;
      prelude = "";
    } else if (ch === "}") {
      depth--;
      prelude = "";
    } else if (depth === 0) prelude += ch;
  }
  return [...seen].filter(([, n]) => n > 1).map(([sel]) => sel);
}

describe("app.css", () => {
  it("has no new duplicated top-level selectors", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(duplicatedSelectors(css).filter((s) => !INTENTIONAL.includes(s))).toEqual([]);
  });
});
