---
title: macOS Installation Problems
description: Fix Markpion installation problems on macOS, including "cannot be opened because Apple cannot check it", "is damaged and can't be opened", and choosing the right build.
---

# macOS installation

## "Cannot be opened because Apple cannot check it for malicious software"

**Problem:** macOS refuses to open Markpion the first time.

**Possible cause:** the app is ad-hoc signed but not notarized by Apple yet, so Gatekeeper asks you to confirm.

**Solution:** open **System Settings → Privacy & Security**, scroll down to the message about Markpion, and choose **Open Anyway**. Confirm, and the app opens. You only need to do this once per version.

## "Markpion is damaged and can't be opened"

**Problem:** macOS says the app is damaged and offers to move it to the Trash.

**Possible cause:** macOS quarantined the downloaded app. The app isn't actually damaged.

**Solution:** run this once in Terminal, then open the app again:

```bash
xattr -dr com.apple.quarantine "/Applications/Markpion.app"
```

## The disk image won't open, or the app won't run on this Mac

**Possible cause:** the Mac runs a macOS version older than 10.15, or the download is incomplete.

**Solution:** check your macOS version (Apple menu → **About This Mac**); Markpion needs 10.15 or later. Download the `.dmg` again and compare its checksum (see [Download](/download#verify-a-download-optional)).

## Report an issue

The macOS builds are new. If something doesn't work, [report it on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) with your macOS version and chip (Apple Silicon or Intel).
