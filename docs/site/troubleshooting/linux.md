---
title: Linux Problems
description: Fix Markpion problems on Linux, including an AppImage that won't start, a missing libwebkit2gtk-4.1, apt "unable to locate package" errors and older distributions.
---

# Linux

## The AppImage doesn't start

**Problem:** double-clicking the AppImage does nothing, or the terminal says *"Permission denied"*.

**Possible cause:** downloaded files aren't executable.

**Solution:**

```bash
chmod +x Markpion-*-linux-x86_64.AppImage
./Markpion-*-linux-x86_64.AppImage
```

Running it from a terminal also shows any error messages.

## A missing libwebkit2gtk-4.1 library

**Problem:** starting the app reports that `libwebkit2gtk-4.1.so.0` (or a similar library) can't be found.

**Possible cause:** Markpion uses the system's WebKitGTK 4.1 to draw its window, and it isn't installed.

**Solution:** install the `.deb` or `.rpm` package, which pulls in the library automatically, or install it yourself:

::: code-group

```bash [Ubuntu, Debian]
sudo apt install libwebkit2gtk-4.1-0
```

```bash [Fedora]
sudo dnf install webkit2gtk4.1
```

:::

Distributions older than 2022 (for example, Ubuntu 20.04) don't have WebKitGTK 4.1 and aren't supported.

## apt says "Unable to locate package"

**Problem:** `sudo apt install Markpion-….deb` fails.

**Solution:** include the path, so apt installs the local file instead of searching its repositories: `sudo apt install ./Markpion-<version>-linux-amd64.deb`.

## ARM64 (Raspberry Pi and similar)

Linux builds are available for x86_64 only at the moment.

## Report an issue

The Linux builds are new. If something doesn't work, [report it on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) with your distribution, its version, and the package you used.
