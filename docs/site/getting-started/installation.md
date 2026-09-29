---
title: Installation
description: Install Markpion on Windows, macOS or Linux. Which installer to choose, system requirements, and links to the step-by-step guide for each operating system.
---

# Installation

Markpion has a separate installer for each operating system. Each one is self-contained, so nothing else needs to be installed first. Get them from the [download page](/download).

| System | Requirements | Installers | Guide |
| --- | --- | --- | --- |
| Windows | Windows 10 (1803+) or 11, x64 | Standard `.exe`, offline `.exe` | [Windows](/installation/windows) |
| macOS | macOS 10.15+, Apple Silicon or Intel | `.dmg` | [macOS](/installation/macos) |
| Linux | x86_64, distributions from 2022 or later | AppImage, `.deb`, `.rpm` | [Linux](/installation/linux) |

## What gets installed

- The Markpion app itself. It uses the web engine built into your system to draw its window: WebView2 on Windows, WebKit on macOS, and WebKitGTK on Linux.
- A Start menu shortcut on Windows, the app in Applications on macOS, and a menu entry with the `.deb`/`.rpm` on Linux.
- File associations for `.md` and `.markdown` files.

Your settings, recent files and file history are stored in your user profile (see [Configuration](/reference/configuration)). Your documents stay where they are.

## Updating

- **Windows:** Markpion checks for a new version when it starts and offers **Update Now**, **Later** or **Skip This Version**. The update is downloaded, its signature is checked, and it's installed over the current version.
- **macOS and Linux:** the app tells you when a new version is available and opens the download page. Install it the same way as the first time; your settings are kept.

You can check at any time with **Help → Check for Updates…**, or turn off the startup check in **Settings → Startup**.
