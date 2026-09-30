/**
 * Release facts for the website, derived at build time from the application
 * itself: the version from package.json, the installer names from the naming
 * convention used by scripts/release-installer.mjs and
 * .github/workflows/release.yml, and the release date from the git tag.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = "https://github.com/nasimuddin-dev/markpion";

export interface Installer {
  label: string;
  file: string;
  url: string;
  note: string;
}

export interface ReleaseData {
  version: string;
  date: string | null;
  releaseUrl: string;
  windows: Installer[];
  macos: Installer[];
  linux: Installer[];
}

declare const data: ReleaseData;
export { data };

export default {
  watch: ["../../../package.json"],
  load(): ReleaseData {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const version: string = JSON.parse(readFileSync(root + "package.json", "utf8")).version;
    let date: string | null = null;
    try {
      // The tagged commit's time, as a UTC date (GitHub shows release dates in UTC).
      const seconds = Number(execSync(`git log -1 --format=%ct v${version}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim());
      date = seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : null;
    } catch {
      date = null; // the tag isn't available (for example, before the release is tagged)
    }
    const asset = (file: string) => `${REPO}/releases/download/v${version}/${file}`;
    const make = (label: string, file: string, note: string): Installer => ({ label, file, url: asset(file), note });
    // ARM64 installers are built by release.yml from 0.23.0 on.
    const [major, minor] = version.split(".").map(Number);
    const arm64 = major > 0 || minor >= 23;
    return {
      version,
      date,
      releaseUrl: `${REPO}/releases/tag/v${version}`,
      windows: [
        make("Standard installer (x64)", `Markpion-${version}-windows-x64-setup.exe`, "Recommended. Adds WebView2 automatically if it's missing (needs internet only then)."),
        make("Offline installer (x64)", `Markpion-${version}-windows-x64-offline-setup.exe`, "Includes the WebView2 runtime; no internet needed. About 210 MB."),
        ...(arm64 ? [make("ARM64 installer", `Markpion-${version}-windows-arm64-setup.exe`, "For Windows on ARM (Snapdragon). New versions are offered as a download, not installed in place.")] : []),
      ],
      macos: [
        make("Apple Silicon (M1 and later)", `Markpion-${version}-macos-arm64.dmg`, "Disk image for Macs with Apple chips."),
        make("Intel", `Markpion-${version}-macos-x64.dmg`, "Disk image for Macs with Intel processors."),
      ],
      linux: [
        make("AppImage (x86_64)", `Markpion-${version}-linux-x86_64.AppImage`, "Runs on most distributions without installation."),
        make(".deb (amd64)", `Markpion-${version}-linux-amd64.deb`, "Ubuntu, Debian, Linux Mint, Pop!_OS."),
        make(".rpm (x86_64)", `Markpion-${version}-linux-x86_64.rpm`, "Fedora, RHEL, Rocky Linux, openSUSE."),
        ...(arm64
          ? [
              make("AppImage (ARM64)", `Markpion-${version}-linux-aarch64.AppImage`, "For 64-bit ARM computers, such as a Raspberry Pi 4 or 5 with a 64-bit system."),
              make(".deb (arm64)", `Markpion-${version}-linux-arm64.deb`, "Debian-based systems on 64-bit ARM."),
              make(".rpm (aarch64)", `Markpion-${version}-linux-aarch64.rpm`, "Fedora-based systems on 64-bit ARM."),
            ]
          : []),
      ],
    };
  },
};
