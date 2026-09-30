import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/**
 * Modules reachable from the entry point through static imports (dynamic
 * `import()` is how heavy code is loaded on demand, so it isn't followed).
 * Returns the source files and the packages they import.
 */
function staticGraph(entry: string) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [normalize(entry)];
  const IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s*)?["']([^"']+)["']/gm;
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const spec = m[1];
      if (!spec.startsWith(".")) {
        packages.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
        continue;
      }
      const base = join(dirname(file), spec);
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((p) => existsSync(p) && /\.tsx?$/.test(p));
      if (found) queue.push(normalize(found));
    }
  }
  return { files, packages };
}

describe("startup bundle", () => {
  it("doesn't statically import the renderer, exporters or diagram code", () => {
    const { files, packages } = staticGraph("src/main.tsx");
    const heavy = ["katex", "rehype-katex", "mermaid", "pdfmake", "docx", "mammoth", "pdfjs-dist", "react-markdown", "remark-gfm", "gemoji"];
    expect(heavy.filter((p) => packages.has(p))).toEqual([]);
    expect([...files].filter((f) => /services[\\/](markdown|exportHtml)\.ts$|components[\\/]Preview\.tsx$/.test(f))).toEqual([]);
  });
});
