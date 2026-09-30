#!/usr/bin/env node
// Builds the Windows installers and publishes them (the macOS and Linux
// installers are built by .github/workflows/release.yml):
//   * the standard installer (small; downloads WebView2 only if it is missing)
//     goes into downloads/ so it can be downloaded straight from the repository;
//   * with --offline, an offline installer that bundles the WebView2 runtime
//     (~210 MB, too large for a git repository) goes into release-assets/ for
//     upload to a GitHub Release (npm run release:github).
// It then updates the README download section and docs/INSTALL.md links.
//
// In-app updates: the standard installer is signed with the updater key
// (minisign) and release-assets/latest.json is written for the updater. The
// private key is read from TAURI_SIGNING_PRIVATE_KEY or, by default, from
// ~/.tauri/markpion.key (or markdown-studio.key, its name before the app was
// renamed). It must never be committed; keep a backup,
// because updates can only be published with the same key.
//
//   npm run release:installer                   standard installer
//   npm run release:installer -- --offline      standard + offline installers
//   npm run release:installer -- --skip-build   republish existing builds
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const withOffline = args.includes("--offline");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(readFileSync("src-tauri/Cargo.toml", "utf8"))?.[1];
if (conf.version !== version || cargoVersion !== version) {
  console.error(`Version mismatch: package.json ${version}, tauri.conf.json ${conf.version}, Cargo.toml ${cargoVersion}.`);
  console.error("Run: npm run version:set <version>");
  process.exit(1);
}

const remote = execSync("git remote get-url origin").toString().trim();
const repo = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote)?.[1] ?? "OWNER/REPO";
const bundlePath = join("src-tauri", "target", "release", "bundle", "nsis", `${conf.productName}_${version}_x64-setup.exe`);
const sha256Of = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const mb = (file) => (statSync(file).size / 1024 / 1024).toFixed(1);

// ---------------------------------------------------------------- updater signing key
const keyFile = ["markpion.key", "markdown-studio.key"]
  .map((name) => join(homedir(), ".tauri", name))
  .find((file) => existsSync(file)) ?? join(homedir(), ".tauri", "markpion.key");
if (!skipBuild && !process.env.TAURI_SIGNING_PRIVATE_KEY) {
  if (!existsSync(keyFile)) {
    console.error(`Updater signing key not found: ${keyFile}`);
    console.error("Restore it from your backup, or set TAURI_SIGNING_PRIVATE_KEY.");
    process.exit(1);
  }
  process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyFile, "utf8").trim();
  process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= "";
}

// ---------------------------------------------------------------- standard installer
const outDir = "downloads";
const fileName = `Markpion-${version}-windows-x64-setup.exe`;
const target = join(outDir, fileName);
if (!skipBuild) {
  console.log(`Building Markpion ${version} installer…`);
  execSync("npx tauri build --bundles nsis", { stdio: "inherit" });
}
if (!skipBuild || !existsSync(target)) {
  if (!existsSync(bundlePath)) {
    console.error(`Installer not found: ${bundlePath}`);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  // Keep only the latest installer in the repository.
  for (const f of readdirSync(outDir)) if (f.endsWith(".exe")) rmSync(join(outDir, f));
  copyFileSync(bundlePath, target);
}

// ---------------------------------------------------------------- updater manifest
// Written before the offline build, which replaces the bundle and its signature.
const assetsDir = "release-assets";
const manifestPath = join(assetsDir, "latest.json");
if (!skipBuild || !existsSync(manifestPath)) {
  const sigPath = `${bundlePath}.sig`;
  if (!existsSync(sigPath)) {
    console.error(`Updater signature not found: ${sigPath} (is bundle.createUpdaterArtifacts enabled?)`);
    process.exit(1);
  }
  const platform = {
    signature: readFileSync(sigPath, "utf8").trim(),
    url: `https://github.com/${repo}/releases/download/v${version}/${fileName}`,
  };
  mkdirSync(assetsDir, { recursive: true });
  const manifest = {
    version,
    notes: `Markpion ${version}. See https://github.com/${repo}/releases/tag/v${version} for what's new.`,
    pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    platforms: { "windows-x86_64-nsis": platform, "windows-x86_64": platform },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

// ---------------------------------------------------------------- offline installer
const offlineName = `Markpion-${version}-windows-x64-offline-setup.exe`;
const offlineTarget = join(assetsDir, offlineName);
if (withOffline) {
  if (!skipBuild) {
    console.log(`Building Markpion ${version} offline installer (bundles WebView2)…`);
    execSync("npx tauri build --bundles nsis --config src-tauri/tauri.offline.conf.json", { stdio: "inherit" });
  }
  if (!skipBuild || !existsSync(offlineTarget)) {
    mkdirSync(assetsDir, { recursive: true });
    for (const f of readdirSync(assetsDir)) if (f.endsWith(".exe")) rmSync(join(assetsDir, f));
    copyFileSync(bundlePath, offlineTarget);
  }
}
const hasOffline = existsSync(offlineTarget);

// ---------------------------------------------------------------- checksums
const sha256 = sha256Of(target);
const sizeMb = mb(target);
let sums = `${sha256}  ${fileName}\n`;
let offlineSha = null;
if (hasOffline) {
  offlineSha = sha256Of(offlineTarget);
  sums += `${offlineSha}  ${offlineName}\n`;
}
writeFileSync(join(outDir, "SHA256SUMS.txt"), sums);
if (hasOffline) copyFileSync(join(outDir, "SHA256SUMS.txt"), join(assetsDir, "SHA256SUMS.txt"));

// ---------------------------------------------------------------- README + INSTALL.md
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const link = `${outDir}/${fileName}?raw=true`;
const releaseUrl = `https://github.com/${repo}/releases/tag/v${version}`;
const offlineUrl = `https://github.com/${repo}/releases/download/v${version}/${offlineName}`;
const offlineRow = hasOffline
  ? `\n| **Offline**: [${offlineName}](${offlineUrl}) | Includes WebView2; no internet needed | ${mb(offlineTarget)} MB | \`${offlineSha}\` |`
  : "";
const asset = (name) => `https://github.com/${repo}/releases/download/v${version}/${name}`;
const mac = (arch) => `Markpion-${version}-macos-${arch}.dmg`;
const linux = {
  appImage: `Markpion-${version}-linux-x86_64.AppImage`,
  deb: `Markpion-${version}-linux-amd64.deb`,
  rpm: `Markpion-${version}-linux-x86_64.rpm`,
};
// ARM64 installers are built by release.yml from 0.23.0 on.
const [major, minor] = version.split(".").map(Number);
const arm64 = major > 0 || minor >= 23;
const armWindows = arm64 ? ` · [ARM64 installer](${asset(`Markpion-${version}-windows-arm64-setup.exe`)})` : "";
const armLinuxRow = arm64
  ? `\n| **Linux** ARM64 | [AppImage](${asset(`Markpion-${version}-linux-aarch64.AppImage`)}) · [.deb](${asset(`Markpion-${version}-linux-arm64.deb`)}) · [.rpm](${asset(`Markpion-${version}-linux-aarch64.rpm`)}) |`
  : "";
// The macOS and Linux installers are built by .github/workflows/release.yml
// when the tag is pushed, and attached to the same release.
const section = `<!-- download:start -->
Markpion ${version} was released on ${date} and has a separate installer for each operating system. Each one is self-contained: nothing else needs to be installed. All files and checksums are on the [${version} release page](${releaseUrl}).

| Operating system | Download |
| --- | --- |
| **Windows** 10 (1803+) and 11, x64 | [Standard installer](${link}) (${sizeMb} MB)${hasOffline ? ` · [Offline installer](${offlineUrl}) (${mb(offlineTarget)} MB)` : ""}${armWindows} |
| **macOS** 10.15+ | [Apple Silicon (M1 and later)](${asset(mac("arm64"))}) · [Intel](${asset(mac("x64"))}) |
| **Linux** x86_64 | [AppImage](${asset(linux.appImage)}) (any distribution) · [.deb](${asset(linux.deb)}) (Ubuntu, Debian, Mint) · [.rpm](${asset(linux.rpm)}) (Fedora, RHEL, openSUSE) |${armLinuxRow}

### Windows

| Installer | When to use it | Size | SHA-256 |
| --- | --- | --- | --- |
| **Standard**: [${fileName}](${link}) | Recommended. WebView2 is already part of Windows 11 and updated Windows 10; if it's missing, the installer adds it automatically (needs internet) | ${sizeMb} MB | \`${sha256}\` |${offlineRow}

1. **Download** an installer above.
2. **Run** it and choose **Anyone who uses this computer**, which needs administrator approval, or **Only for me**, which doesn't. The installer isn't code-signed yet, so if Windows SmartScreen says *"Windows protected your PC"*, choose **More info → Run anyway**.
3. **Start** Markpion from the Start menu, or right-click any \`.md\` file and choose **Open with Markpion**.

The app appears in **Settings → Apps → Installed apps** and in **Control Panel → Programs and Features**, where it can be uninstalled. Newer versions install over older ones, keep your settings, and are offered automatically when the app starts.

### macOS

1. **Download** the \`.dmg\` for your Mac: **Apple Silicon** for M1 and later, **Intel** for older Macs (Apple menu → About This Mac shows which one you have).
2. **Open** the \`.dmg\` and drag **Markpion** to **Applications**.
3. **Start** it from Applications. The app isn't notarized by Apple yet, so the first time, macOS blocks it: open **System Settings → Privacy & Security** and choose **Open Anyway**. If macOS says the app *"is damaged"*, run \`xattr -dr com.apple.quarantine "/Applications/Markpion.app"\` in Terminal once.

### Linux

- **AppImage** (any distribution, no installation needed): download it, run \`chmod +x Markpion-*.AppImage\`, then start it.
- **Debian, Ubuntu, Mint**: \`sudo apt install ./${linux.deb}\` (apt installs the required system libraries automatically).
- **Fedora, RHEL, openSUSE**: \`sudo dnf install ./${linux.rpm}\` (or \`sudo zypper install\` on openSUSE).

On macOS and Linux, the app tells you when a new version is available and opens its download page.

For requirements, checksum verification, silent install, uninstalling and troubleshooting, see the **[installation guide](docs/INSTALL.md)**.
<!-- download:end -->`;

let readme = readFileSync("README.md", "utf8");
const block = /<!-- download:start -->[\s\S]*?<!-- download:end -->/;
if (block.test(readme)) readme = readme.replace(block, section);
else readme = readme.replace(/(\n## Features)/, `\n## Download\n\n${section}\n$1`);
writeFileSync("README.md", readme);

const installGuide = join("docs", "INSTALL.md");
if (existsSync(installGuide)) {
  let guide = readFileSync(installGuide, "utf8");
  guide = guide.replace(
    /<!-- installer-link -->[\s\S]*?<!-- \/installer-link -->/,
    `<!-- installer-link -->[**${fileName}**](../${link})<!-- /installer-link -->`,
  );
  guide = guide.replace(
    /<!-- offline-link -->[\s\S]*?<!-- \/offline-link -->/,
    `<!-- offline-link -->${hasOffline ? `[**${offlineName}**](${offlineUrl})` : "the offline installer from the latest GitHub release"}<!-- /offline-link -->`,
  );
  guide = guide.replace(/Markpion-[\d.]+(?:-[0-9A-Za-z.-]+)?-windows-x64-setup\.exe \/S/g, `${fileName} /S`);
  writeFileSync(installGuide, guide);
}

console.log(`\nStandard installer: ${target} (${sizeMb} MB)\n  SHA-256 ${sha256}`);
if (hasOffline) console.log(`Offline installer:  ${offlineTarget} (${mb(offlineTarget)} MB)\n  SHA-256 ${offlineSha}`);
console.log("README and docs/INSTALL.md updated.");
if (hasOffline) console.log(`Next: commit + push, then  npm run release:github  to publish ${releaseUrl}`);
