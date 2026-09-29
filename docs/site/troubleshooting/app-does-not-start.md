---
title: App Doesn't Start
description: What to do when Markpion doesn't start, shows a blank window, or quits immediately on Windows, macOS or Linux.
---

# The app doesn't start

## Blank or white window on Windows

**Problem:** Markpion opens, but the window stays blank, or an error mentions WebView2.

**Symptoms:** an empty white or grey window, or a message about the Microsoft Edge WebView2 Runtime.

**Possible cause:** Markpion draws its window with Microsoft Edge WebView2. It's part of Windows 11 and up-to-date Windows 10, but it can be missing or broken on older or locked-down PCs.

**Solution:**

1. Install the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (the Evergreen Standalone Installer), then start Markpion again.
2. Or reinstall Markpion with the **offline installer** from the [download page](/download), which includes WebView2.

**Additional diagnostics:** check **Settings → Apps → Installed apps** for "Microsoft Edge WebView2 Runtime".

## macOS refuses to open the app

**Problem:** macOS says the app *"cannot be opened"* or *"is damaged"*.

**Possible cause:** the app isn't notarized by Apple yet, so Gatekeeper blocks its first launch.

**Solution:** see [macOS installation troubleshooting](/troubleshooting/macos).

## The AppImage does nothing on Linux

**Problem:** double-clicking the AppImage does nothing, or it exits at once.

**Possible cause:** the file isn't executable, or the WebKitGTK library is missing.

**Solution:** see [Linux troubleshooting](/troubleshooting/linux).

## The app starts, then something goes wrong

**Problem:** Markpion starts but shows an error, or quits during use.

**Possible cause:** varies. If it quit with unsaved documents, they were snapshotted every few seconds.

If a single area fails (for example the preview, the sidebar or the status bar), it shows "couldn't be shown because of an unexpected error" with a **Try Again** button, and the rest of the window keeps working. If the whole window fails, Markpion shows "Markpion hit an unexpected error" with a **Reload** button: it saves your unsaved changes for recovery first, then reloads and offers to restore them.

**Solution:**

1. Start Markpion again. It offers to **recover** unsaved documents from the last session (see [Crash recovery](/guide/saving-and-recovery#crash-recovery)).
2. If it happens again at the same point, turn off **Settings → Startup → Reopen last folder and files**, so a problem file isn't reopened automatically.

**Additional diagnostics:** choose **Help → Export Diagnostic Logs…** after restarting.

## Report an issue

If none of this helps, [report it on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) with your version, operating system, and the diagnostic log. See [Troubleshooting](/troubleshooting/#report-an-issue).
