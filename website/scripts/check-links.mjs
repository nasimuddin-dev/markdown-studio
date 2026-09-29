#!/usr/bin/env node
/**
 * Link check after the build (npm run check): every internal link, image,
 * script and stylesheet in the generated HTML must point to a file in the
 * output. VitePress already fails the build on dead Markdown links; this also
 * covers raw HTML, components and assets. With --external it also checks
 * the release download links and GitHub links on the site (needs network).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST = new URL("../.vitepress/dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const BASE = "/markpion/";
const external = process.argv.includes("--external");

const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".html")) pages.push(p);
  }
})(DIST);

/** The output file for a site URL such as /markpion/guide/editor#tabs. */
function target(url) {
  let path = decodeURIComponent(url.replace(/[?#].*$/, "")).slice(BASE.length);
  if (path === "" || path.endsWith("/")) path += "index.html";
  const file = join(DIST, path);
  if (existsSync(file) && statSync(file).isFile()) return file;
  if (existsSync(file + ".html")) return file + ".html"; // clean URLs
  return null;
}

const errors = [];
const externalUrls = new Set();
for (const page of pages) {
  const rel = relative(DIST, page).split(sep).join("/");
  const html = readFileSync(page, "utf8");
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1].replace(/&amp;/g, "&");
    if (/^https?:\/\//.test(url)) {
      if (/github\.com\/nasimuddin-dev\/markpion/.test(url)) externalUrls.add(url);
      continue;
    }
    if (/^(mailto:|data:|#|javascript:)/.test(url)) continue;
    if (!url.startsWith(BASE)) {
      errors.push(`${rel}: link outside the site base: ${url}`);
      continue;
    }
    if (!target(url)) errors.push(`${rel}: broken link ${url}`);
  }
}
for (const required of ["sitemap.xml", "robots.txt", "404.html", "images/social-preview.webp"]) {
  if (!existsSync(join(DIST, required))) errors.push(`missing ${required}`);
}

if (external) {
  for (const url of externalUrls) {
    // Edit links point at files that exist on main once this change is pushed.
    if (/\/edit\/main\//.test(url)) continue;
    const res = await fetch(url, { method: "HEAD", redirect: "follow" }).catch((e) => ({ ok: false, status: e.message }));
    if (!res.ok) errors.push(`external link ${res.status}: ${url}`);
  }
}

if (errors.length) {
  console.error(`Link check failed (${errors.length}):\n  ` + [...new Set(errors)].join("\n  "));
  process.exit(1);
}
console.log(`Link check passed: ${pages.length} pages${external ? `, ${externalUrls.size} GitHub and release links` : ""}.`);
