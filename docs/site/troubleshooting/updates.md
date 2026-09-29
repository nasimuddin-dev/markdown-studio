---
title: Update Problems
description: Fix Markpion update problems, including a failed update check, a failed installation, update prompts, and turning off the startup check.
---

# Updates

## "Couldn't check for updates"

**Problem:** **Help → Check for Updates…** says it couldn't check.

**Possible cause:** no internet connection, or GitHub can't be reached (for example, behind a restrictive proxy or firewall).

**Solution:** check your connection and try again. The automatic check at startup fails silently, so it never gets in your way offline. You can always download new versions from the [download page](/download).

## An update doesn't install (Windows)

**Problem:** after **Update Now**, a message says the new version couldn't be installed.

**Symptoms:** *"Markpion x.y.z couldn't be installed; your current version is unchanged."* followed by the reason.

**Possible causes:**

- The download was interrupted.
- The downloaded file's signature didn't match the key built into the app. Markpion refuses such files, to protect you from tampered updates.
- For an all-users installation, administrator approval was declined.

**Solution:** try again later with **Help → Check for Updates…**, or download the installer from the [download page](/download) and run it. It upgrades in place and keeps your settings.

## "Update postponed"

**Problem:** **Update Now** says *"Update postponed. Save or close your unsaved documents, then try again."*

**Possible cause:** Markpion saves open documents before updating; one couldn't be saved (for example, an untitled document whose Save As you cancelled).

**Solution:** save or close your documents, then choose **Help → Check for Updates…** again.

## Updates on macOS and Linux

On macOS and Linux, Markpion tells you about new versions and opens the download page, but doesn't install them itself. Install the new version as you did the first time; see the [macOS](/installation/macos#updates) and [Linux](/installation/linux#updates) guides.

## Stop the update prompt

- **Skip This Version** stops the startup prompt for that version.
- **Settings → Startup → Check for updates when Markpion starts** turns off the automatic check entirely.

## Report an issue

If updates keep failing, [report it on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) with the message and the diagnostic log (**Help → Export Diagnostic Logs…**).
