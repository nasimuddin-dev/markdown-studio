#!/usr/bin/env node
// Creates (or updates) the GitHub Release v<version> and uploads the
// installers: the standard installer from downloads/ and the offline
// installer from release-assets/ (too large for the repository).
// Requires the GitHub CLI (`gh auth login`) and the release commit pushed.
//   npm run release:github
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const tag = `v${version}`;
const files = [
  join("downloads", `Markpion-${version}-windows-x64-setup.exe`),
  join("release-assets", `Markpion-${version}-windows-x64-offline-setup.exe`),
  join("downloads", "SHA256SUMS.txt"),
  // Update manifest read by the in-app updater (releases/latest/download/latest.json).
  join("release-assets", "latest.json"),
].filter(existsSync);
if (files.length < 2) {
  console.error("Installers not found. Run: npm run release:installer -- --offline");
  process.exit(1);
}

const gh = (...a) => execFileSync("gh", a, { stdio: ["ignore", "pipe", "inherit"] }).toString();
const notes = `## Markpion ${version}

A fast, local-first Markdown editor for Windows. Nothing else needs to be installed.

| File | Use it when |
| --- | --- |
| \`Markpion-${version}-windows-x64-setup.exe\` | **Recommended.** Small download. WebView2 is already part of Windows 11 and updated Windows 10; if it's missing, the installer adds it automatically (needs internet). |
| \`Markpion-${version}-windows-x64-offline-setup.exe\` | The PC has **no internet access** or is locked down. It includes the Microsoft Edge WebView2 runtime. |
| \`SHA256SUMS.txt\` | Verify a download: \`Get-FileHash <file> -Algorithm SHA256\` |

The installer isn't code-signed yet: if SmartScreen warns, choose **More info → Run anyway**.
See the [installation guide](https://github.com/${gh("repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner").trim()}/blob/main/docs/INSTALL.md).
`;
const notesFile = join(tmpdir(), `markpion-${tag}-notes.md`);
writeFileSync(notesFile, notes);

let exists = true;
try {
  gh("release", "view", tag);
} catch {
  exists = false;
}
// Small files first; large installers are uploaded one by one with retries,
// because a network hiccup mid-upload shouldn't lose the whole release.
const small = files.filter((f) => statSync(f).size < 50 * 1024 * 1024);
const large = files.filter((f) => !small.includes(f));
if (exists) {
  console.log(`Updating release ${tag}…`);
  gh("release", "edit", tag, "--notes-file", notesFile);
  gh("release", "upload", tag, ...small, "--clobber");
} else {
  console.log(`Creating release ${tag}…`);
  gh("release", "create", tag, ...small, "--title", `Markpion ${version}`, "--notes-file", notesFile, "--target", "main", "--latest");
}
for (const file of large) {
  for (let attempt = 1; ; attempt++) {
    try {
      console.log(`Uploading ${file} (attempt ${attempt})…`);
      gh("release", "upload", tag, file, "--clobber");
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      execFileSync(process.execPath, ["-e", "setTimeout(() => {}, 5000)"]);
    }
  }
}
console.log(gh("release", "view", tag, "--json", "url,assets", "-q", '.url + "\\n" + ([.assets[] | .name + " (" + (.size|tostring) + " bytes)"] | join("\\n"))'));
