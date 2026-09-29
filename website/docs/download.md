---
title: Download
description: Download Markpion for Windows (x64), macOS (Apple Silicon and Intel) or Linux (AppImage, .deb, .rpm). Free, self-contained installers from GitHub Releases.
---

<script setup>
import { data as release } from "./data/release.data";
</script>

# Download Markpion

The current version is **{{ release.version }}**<span v-if="release.date">, released {{ release.date }}</span>. Every installer is self-contained: you don't need to install anything else. The files are hosted on the project's <a :href="release.releaseUrl">GitHub release page</a>, which also lists their SHA-256 checksums.

<Downloads />

## Which file do I need?

- **Windows:** use the **standard installer** unless the PC has no internet access or is locked down; then use the **offline installer**, which includes Microsoft Edge WebView2.
- **macOS:** choose **Apple Silicon** for Macs with an M-series chip, or **Intel** for older Macs. Apple menu → **About This Mac** shows which one you have.
- **Linux:** the **AppImage** runs on most distributions without installation. Use the **.deb** on Ubuntu, Debian and their derivatives, or the **.rpm** on Fedora, RHEL and openSUSE, to get a menu entry and file associations.

## Before you install

- **Code signing.** The Windows installer isn't Authenticode-signed yet, so SmartScreen may warn you the first time. The macOS app is ad-hoc signed but not notarized by Apple, so macOS asks you to confirm the first launch. The installation guides show exactly what to click.
- **Updates.** On Windows, Markpion checks for new versions at startup and installs them in place after verifying their signature. On macOS and Linux it tells you when a new version is out and opens this download page.

## Verify a download (optional)

Each release includes `SHA256SUMS.txt` (Windows) and `SHA256SUMS-macos-linux.txt`. Compare the checksum of your file with the one listed:

::: code-group

```powershell [Windows]
Get-FileHash .\Markpion-*-setup.exe -Algorithm SHA256
```

```bash [macOS]
shasum -a 256 Markpion-*.dmg
```

```bash [Linux]
sha256sum Markpion-*
```

:::

## Installation guides

- [Install on Windows](/installation/windows)
- [Install on macOS](/installation/macos)
- [Install on Linux](/installation/linux)

Older versions are available on the [GitHub releases page](https://github.com/nasimuddin-dev/markpion/releases). To build from source, see the [repository README](https://github.com/nasimuddin-dev/markpion#development).
