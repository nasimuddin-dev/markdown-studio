import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { lintMarkdown } from "../src/features/lint";

/** Every Markdown file of the project's documentation (docs/, README, AGENTS). */
function markdownFiles(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) markdownFiles(path, out);
    else if (path.endsWith(".md")) out.push(path);
  }
  return out;
}

/**
 * The project's own documentation is a large, varied Markdown corpus: the
 * syntax-mistake rules must find nothing in it. This catches false positives
 * in the rules and real mistakes in the docs.
 */
describe("lint on the project's documentation", () => {
  it("finds no Markdown syntax mistakes", () => {
    const rules = ["list-space", "emphasis-space", "heading-space", "setext-heading", "table-columns", "footnote", "reference", "link-text", "destination-spaces"];
    const found: string[] = [];
    for (const file of [...markdownFiles("docs"), "README.md", "AGENTS.md"]) {
      const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      for (const p of lintMarkdown(text).filter((p) => rules.includes(p.rule))) {
        found.push(`${file}:${text.slice(0, p.from).split("\n").length} ${p.rule}: ${text.slice(p.from, p.to).slice(0, 70)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
