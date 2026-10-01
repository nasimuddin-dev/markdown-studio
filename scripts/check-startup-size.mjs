#!/usr/bin/env node
/**
 * Startup budget: sums the JavaScript the built app loads before it can show
 * anything (the entry script and its modulepreloads in dist/index.html),
 * gzipped, and fails if it's over the budget. Run after `vite build`:
 *
 *   npm run check:startup              (budget below)
 *   npm run check:startup -- --list    (also lists the largest files)
 *
 * Raise the budget only on purpose: heavy, rarely used code belongs behind a
 * dynamic import() (see AGENTS.md).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_GZIP_KB = 370;

const dist = "dist";
const html = readFileSync(join(dist, "index.html"), "utf8");
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
if (!files.length) {
  console.error("No scripts found in dist/index.html. Run `npx vite build` first.");
  process.exit(1);
}
const sizes = files.map((f) => {
  const bytes = readFileSync(join(dist, f));
  return { file: f, raw: bytes.length, gzip: gzipSync(bytes).length };
});
const kb = (n) => Math.round(n / 1024);
const raw = sizes.reduce((n, s) => n + s.raw, 0);
const gzip = sizes.reduce((n, s) => n + s.gzip, 0);
if (process.argv.includes("--list")) {
  for (const s of [...sizes].sort((a, b) => b.gzip - a.gzip).slice(0, 15)) console.log(`${String(kb(s.gzip)).padStart(5)} KB gz ${String(kb(s.raw)).padStart(6)} KB  ${s.file}`);
}
console.log(`Startup JavaScript: ${files.length} files, ${kb(raw)} KB (${kb(gzip)} KB gzipped); budget ${BUDGET_GZIP_KB} KB gzipped.`);
if (kb(gzip) > BUDGET_GZIP_KB) {
  console.error(`Over budget by ${kb(gzip) - BUDGET_GZIP_KB} KB. Load the new code on demand with import(), or raise the budget on purpose.`);
  process.exit(1);
}
