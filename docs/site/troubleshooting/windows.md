---
title: Windows Installation Problems
description: Fix Markpion installation problems on Windows, including SmartScreen warnings, blocked downloads, WebView2, "app is running" messages, missing Installed apps entries and the right-click menu.
---

# Windows installation

## "Windows protected your PC"

**Problem:** SmartScreen shows *"Windows protected your PC"* when you run the installer.

**Possible cause:** the installer isn't code-signed yet, and SmartScreen warns about unsigned files that few people have downloaded.

**Solution:** click **More info**, then **Run anyway**. You can check that the file is genuine by comparing its SHA-256 checksum with the one on the release page (see [Download](/download#verify-a-download-optional)).

## The browser blocks the download

**Solution:** choose **Keep** (in Edge: **… → Keep → Keep anyway**).

## WebView2 is missing, or the window is blank

**Solution:** use the **offline installer**, which includes WebView2, or install the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/). See [App doesn't start](/troubleshooting/app-does-not-start#blank-or-white-window-on-windows).

## "Markpion is running"

**Problem:** the installer says the app is running.

**Solution:** close Markpion (check the taskbar for other windows), then run the installer again.

## Not listed under Installed apps

**Possible cause:** it was installed **Only for me** under a different Windows account. Per-user installations are visible only to that account.

**Solution:** sign in to that account, or reinstall and choose **Anyone who uses this computer**.

## No desktop or Start menu shortcut after updating from Markdown Studio

**Cause:** updating Markdown Studio 0.13 to Markpion 0.14.0 removed the old shortcuts and didn't create new ones. A taskbar pin of Markdown Studio is removed too.

**Solution:** update to Markpion 0.15.0 or later (**Help → Check for Updates…**). It creates the Start menu and desktop shortcuts once. To pin Markpion to the taskbar, right-click it in the Start menu and choose **Pin to taskbar**.

## No "Open with Markpion" in the right-click menu

**Solution:** on Windows 11, choose **Show more options** first. If it's still missing, reinstall the latest version.

## Double-clicking a .md file opens another app

**Solution:** right-click a `.md` file → **Open with** → **Choose another app** → **Markpion**, and tick **Always use this app**. Or go to **Settings → Apps → Default apps → Markpion**.

## Report an issue

[Report installation problems on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) with your Windows version and the installer you used.
