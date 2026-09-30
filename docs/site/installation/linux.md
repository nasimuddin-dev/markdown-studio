---
title: Install on Linux
description: Install Markpion on Linux with the AppImage, the .deb package (Ubuntu, Debian, Mint) or the .rpm package (Fedora, RHEL, openSUSE). Requirements, updates and uninstalling.
---

# Install Markpion on Linux

## Requirements

- A 64-bit (x86_64) distribution from 2022 or later, such as Ubuntu 22.04+, Debian 12+, Fedora 36+ or openSUSE Leap 15.5+. From version 0.23.0 there are also ARM64 packages (`linux-aarch64.AppImage`, `linux-arm64.deb`, `linux-aarch64.rpm`); they haven't been tested on ARM hardware yet.
- The WebKitGTK library (`libwebkit2gtk-4.1`). The `.deb` and `.rpm` packages declare it, so your package manager installs it automatically. Current desktop distributions usually include it, which the AppImage needs.

ARM64 Linux builds aren't available yet.

## Download

<Downloads only="linux" />

## Install

::: code-group

```bash [Ubuntu, Debian, Mint (.deb)]
sudo apt install ./Markpion-<version>-linux-amd64.deb
```

```bash [Fedora, RHEL (.rpm)]
sudo dnf install ./Markpion-<version>-linux-x86_64.rpm
```

```bash [openSUSE (.rpm)]
sudo zypper install ./Markpion-<version>-linux-x86_64.rpm
```

```bash [AppImage (any distribution)]
chmod +x Markpion-<version>-linux-x86_64.AppImage
./Markpion-<version>-linux-x86_64.AppImage
```

:::

Run the command in the folder where you downloaded the file; the `./` in front of the file name matters. The `.deb` and `.rpm` packages add Markpion to your applications menu and register it for `.md` files. The AppImage needs no installation or root access.

## First launch

Start **Markpion** from your applications menu (for `.deb`/`.rpm`), or run the AppImage. Continue with [Your first document](/getting-started/first-document).

## Updates

When a new version is published, Markpion tells you at startup (or from **Help → Check for Updates…**) and opens its download page. Install the new package the same way; it replaces the old version and keeps your settings. For the AppImage, replace the file. In-place automatic updates are currently available on Windows only.

## Uninstall

::: code-group

```bash [.deb]
sudo apt remove markpion
```

```bash [.rpm]
sudo dnf remove markpion
```

:::

For the AppImage, delete the file. Settings and history are kept in `~/.config/com.markpion.app` and `~/.local/share/com.markpion.app`; delete those folders to remove them too.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The AppImage doesn't start | Make it executable (`chmod +x`). If it reports a missing `libwebkit2gtk-4.1`, install that package, or use the `.deb` or `.rpm`, which install it automatically. |
| `apt` says the package can't be found | Include the `./` path: `sudo apt install ./Markpion-<version>-linux-amd64.deb`. |

More help: [Linux troubleshooting](/troubleshooting/linux).
