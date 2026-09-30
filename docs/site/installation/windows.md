---
title: Install on Windows
description: Install Markpion on Windows 10 or 11. Requirements, standard vs offline installer, SmartScreen, per-user or all-users install, updates, silent install and uninstalling.
---

# Install Markpion on Windows

## Requirements

- Windows 10 (version 1803 or later) or Windows 11, 64-bit (x64). From version 0.23.0 there is also an ARM64 installer for Windows on ARM; it hasn't been tested on ARM hardware yet, and new versions are offered as a download instead of being installed in place.
- About 20 MB of free disk space.
- Administrator rights only if you install for everyone on the PC.
- Microsoft Edge **WebView2**, which draws the window. It's part of Windows 11 and is kept up to date on Windows 10 by Windows Update. If it's missing, the standard installer adds it (this needs internet), and the offline installer includes it.

## Download

<Downloads only="windows" />

Use the **standard installer** unless the PC has no internet access, is locked down, or you're deploying to many machines; then use the **offline installer**.

## Install

1. Double-click the downloaded `.exe`.
2. The installer isn't code-signed yet, so Windows SmartScreen may show **"Windows protected your PC"**. Click **More info**, then **Run anyway**. Your browser may also ask whether to keep the file; choose **Keep**.
3. Choose who to install for:
   - **Anyone who uses this computer (all users):** installs to `C:\Program Files\Markpion`. Windows asks for administrator approval. Recommended on shared and company PCs.
   - **Only for me:** installs to `%LOCALAPPDATA%\Markpion`, without administrator rights.
4. Click **Install**, then **Finish**.

After installation, Markpion:

- has a Start menu shortcut named **Markpion**;
- appears in **Settings → Apps → Installed apps** and **Control Panel → Programs and Features**;
- adds **Open with Markpion** to the right-click menu of `.md` and `.markdown` files (on Windows 11 it's under **Show more options**), and lists itself under **Open with**.

::: info "Only for me" installs
An "Only for me" installation is visible only to the Windows account that installed it. If you don't see it under Installed apps, sign in to that account, or reinstall and choose **Anyone who uses this computer**.
:::

## First launch

Open **Markpion** from the Start menu. Choose **New File**, **Open File** or **Open Folder** on the welcome screen, or double-click a `.md` file. If Windows asks which app to use, pick **Markpion** and tick **Always use this app**. Continue with [Your first document](/getting-started/first-document).

## Updates

Markpion updates itself (from version 0.8.0). At each start it asks GitHub whether a newer version exists and offers:

- **Update Now:** saves your open documents, downloads the new installer, checks its digital signature against the key built into the app (refusing any file that doesn't match), installs it in place and restarts. For an all-users installation, Windows asks for administrator approval.
- **Later:** asks again at the next start.
- **Skip This Version:** stops the automatic prompt for that version.

Use **Help → Check for Updates…** at any time, or turn the startup check off in **Settings → Startup**. If an update fails, the current version keeps running unchanged. Markpion was called Markdown Studio before 0.14.0; updating from it installs Markpion in its place and keeps your settings (see the [FAQ](/faq#is-markpion-the-same-app-as-markdown-studio)). Versions before 0.8.0 need the new installer run once by hand; it upgrades in place and keeps your settings.

## Silent install (IT administrators)

The installer supports unattended installation. Add `/AllUsers` (run elevated) or `/CurrentUser`:

```powershell
.\Markpion-<version>-windows-x64-setup.exe /S /AllUsers
```

To uninstall silently, run `uninstall.exe /S` from the installation folder.

To preset or lock settings for everyone on the computer (for example, to turn off the AI assistant or the update check), deploy a `policy.json`; see [Managed settings](/reference/managed-settings).

## Uninstall

Open **Settings → Apps → Installed apps** (or **Control Panel → Programs and Features**), find **Markpion**, and choose **Uninstall**. The uninstaller also removes the right-click menu entry and file-type registrations. Your documents are never removed. Settings and history are kept in `%APPDATA%\com.markpion.app` and `%LOCALAPPDATA%\com.markpion.app`; delete those folders to remove them too.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| "Windows protected your PC" | Click **More info → Run anyway**. The installer isn't code-signed yet. |
| The browser blocks the download | Choose **Keep** (Edge: **… → Keep → Keep anyway**). |
| A blank window or a "WebView2" error | Use the offline installer, or install the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/), then start the app again. |
| The installer says the app is running | Close Markpion, then run the installer again. |
| No "Open with Markpion" in the right-click menu | On Windows 11, choose **Show more options**. If it's still missing, reinstall the latest version. |

More help: [Windows installation troubleshooting](/troubleshooting/windows).
