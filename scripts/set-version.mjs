#!/usr/bin/env node
// Sets the app version everywhere it is declared: package.json (and its lockfile),
// src-tauri/tauri.conf.json and src-tauri/Cargo.toml.
//   npm run version:set 0.3.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error("Usage: npm run version:set <major.minor.patch>");
  process.exit(1);
}

const update = (file, fn) => {
  const before = readFileSync(file, "utf8");
  const after = fn(before);
  if (after === before) throw new Error(`No version found in ${file}`);
  writeFileSync(file, after);
  console.log(`  ${file}`);
};

update("package.json", (s) => s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
// The lockfile repeats the project's version at the top and in its root package entry.
update("package-lock.json", (s) => s.replace(/^(\s{2}"version":\s*")[^"]+(")/m, `$1${version}$2`).replace(/(""\s*:\s*\{\s*"name":\s*"[^"]+",\s*"version":\s*")[^"]+(")/, `$1${version}$2`));
update("src-tauri/tauri.conf.json", (s) => s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
update("src-tauri/Cargo.toml", (s) => s.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`));
update("src/services/memoryBackend.ts", (s) => s.replace(/(version: ")[^"]+(", os: "browser")/, `$1${version}$2`));
console.log(`Version set to ${version}. Next: npm run release:installer`);
