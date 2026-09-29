#!/usr/bin/env node
/**
 * Content checks before the build (npm run check):
 *   - every page has front matter with a title and a description (SEO);
 *   - titles and descriptions are unique, and descriptions are 50–200 characters;
 *   - every page except the home page has exactly one H1;
 *   - every image has alt text;
 *   - no raw `{{ }}` outside code, which Vue would try to evaluate
 *     (pages that load data declare it in <script setup>).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("../../docs/site/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const errors = [];
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "public" || name === "images" || name === "data" || name.startsWith(".")) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".md")) files.push(p);
  }
})(ROOT);

const seen = { title: new Map(), description: new Map() };
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const text = readFileSync(file, "utf8");
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) {
    errors.push(`${rel}: missing front matter`);
    continue;
  }
  const field = (k) => new RegExp(`^${k}:[ \\t]*(.+)$`, "m").exec(fm[1])?.[1].replace(/^["']|["']$/g, "").trim();
  const title = field("title");
  const description = field("description");
  if (!title) errors.push(`${rel}: missing title`);
  if (!description) errors.push(`${rel}: missing description`);
  else if (description.length < 50 || description.length > 200) errors.push(`${rel}: description is ${description.length} characters (50–200 recommended)`);
  for (const [k, v] of [["title", title], ["description", description]]) {
    if (!v) continue;
    if (seen[k].has(v)) errors.push(`${rel}: same ${k} as ${seen[k].get(v)}`);
    seen[k].set(v, rel);
  }
  // Body without front matter and code (fenced and inline).
  const body = text.slice(fm[0].length).replace(/(`{3,}|~{3,})[\s\S]*?\1/g, "").replace(/`[^`\n]*`/g, "");
  const isHome = /^layout:\s*home/m.test(fm[1]);
  const h1s = body.match(/^# .+/gm) ?? [];
  if (!isHome && h1s.length !== 1) errors.push(`${rel}: expected exactly one H1, found ${h1s.length}`);
  for (const m of body.matchAll(/!\[([^\]]*)\]\(/g)) if (!m[1].trim()) errors.push(`${rel}: image without alt text`);
  for (const m of body.matchAll(/<img\b[^>]*>/g)) if (!/\balt="[^"]+"/.test(m[0])) errors.push(`${rel}: <img> without alt text`);
  const vPre = body.replace(/::: v-pre[\s\S]*?:::/g, "");
  const hasScript = /<script setup>/.test(body);
  for (const m of vPre.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    if (!hasScript || !/^release\./.test(m[1])) errors.push(`${rel}: unexpected interpolation {{ ${m[1]} }} (wrap it in ::: v-pre or code)`);
  }
}

if (errors.length) {
  console.error(`Content check failed (${errors.length}):\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log(`Content check passed: ${files.length} pages have titles, descriptions, one H1 and alt text.`);
