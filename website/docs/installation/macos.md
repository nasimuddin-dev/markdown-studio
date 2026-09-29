---
title: Install on macOS
description: Install Markpion on macOS 10.15 or later, on Apple Silicon or Intel Macs. Choosing the right .dmg, getting past Gatekeeper on first launch, updating and uninstalling.
---

# Install Markpion on macOS

## Requirements

- macOS 10.15 (Catalina) or later.
- A Mac with **Apple Silicon** (M1 and later) or an **Intel** processor. To check, open the Apple menu → **About This Mac**: it shows *Chip: Apple M…* or *Processor: Intel*.
- Nothing else. Markpion uses the WebKit engine built into macOS.

## Download

<Downloads only="macos" />

## Install

1. Open the downloaded `.dmg`.
2. Drag **Markpion** onto the **Applications** folder.
3. Eject the disk image.

## First launch

Open Markpion from **Applications** or Launchpad.

The app is ad-hoc signed but **not notarized by Apple** yet, so macOS stops it the first time:

- If macOS says it *"cannot be opened because Apple cannot check it for malicious software"*, open **System Settings → Privacy & Security**, scroll down, and choose **Open Anyway**. You only need to do this once.
- If macOS says the app *"is damaged and can't be opened"*, the download was quarantined. Run this once in Terminal, then open the app again:

  ```bash
  xattr -dr com.apple.quarantine "/Applications/Markpion.app"
  ```

To open `.md` files with Markpion by default, select a Markdown file in Finder, choose **File → Get Info**, pick Markpion under **Open with**, and click **Change All…**.

Continue with [Your first document](/getting-started/first-document).

## Updates

When a new version is published, Markpion tells you at startup (or from **Help → Check for Updates…**) and opens its download page. Download the new `.dmg` and drag the app onto Applications again to replace the old version. Your settings are kept. In-place automatic updates are currently available on Windows only.

## Uninstall

Drag **Markpion** from Applications to the Trash. Settings and history are kept in `~/Library/Application Support/com.markpion.app`, and logs in `~/Library/Logs/com.markpion.app`; delete those folders to remove them too. Your documents are never touched.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| "Cannot be opened because Apple cannot check it" | **System Settings → Privacy & Security → Open Anyway** (once). |
| "Markpion is damaged and can't be opened" | Run the `xattr` command above, then open the app again. |

More help: [macOS installation troubleshooting](/troubleshooting/macos).
