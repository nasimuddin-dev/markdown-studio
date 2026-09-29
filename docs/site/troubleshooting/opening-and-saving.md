---
title: Opening & Saving Files
description: Fix problems opening or saving Markdown files in Markpion, including permission denied, disk full, files changed by another program, invalid UTF-8, very large files and missing files.
---

# Opening & saving files

Markpion's error messages say what happened and what you can do next. They're explained here.

## "You don't have permission to write here"

**Problem:** saving fails with *"you don't have permission to write here. Use Save As to save a copy somewhere else."*

**Symptoms:** the tab stays marked as unsaved; your text is still in the editor.

**Possible cause:** the file or folder is read-only, belongs to another user or administrator, or is in a protected location such as `C:\Program Files`. On Windows, a sync or antivirus program can also lock the file for a moment.

**Solution:**

1. Use **File → Save As…** (**Ctrl+Shift+S**) to save a copy in a folder you own, such as Documents.
2. Or remove the file's read-only flag, or ask its owner for write access.
3. If it happened once and then works, a program was briefly holding the file; Markpion already retries a few times on Windows.

## "The disk is full"

**Problem:** saving fails with *"the disk is full. Free up space and try again — your text is still in the editor."*

**Solution:** free up space (empty the Trash or Recycle Bin, delete large files), then save again. Nothing is lost while the app is open.

## "The file was changed by another program"

**Problem:** a banner says the file changed on disk, or saving fails because it changed.

**Possible cause:** another program (Git, a sync client, another editor) changed the file after you opened it.

**Solution:** choose **Reload (discard mine)** to take the version on disk, **Compare** to open it next to yours, or **Keep Mine** and save to overwrite it. See [Files changed on disk](/guide/saving-and-recovery#files-changed-on-disk).

## "The file is not valid UTF-8"

**Problem:** a file won't open: *"The file is not valid UTF-8 (invalid byte at position …). It was not opened to avoid corrupting it."*

**Possible cause:** the file uses another encoding, such as Windows-1252 or UTF-16, or isn't a text file.

**Solution:** convert it to UTF-8 in another editor (for example, in Notepad choose **Save As → Encoding: UTF-8**), then open it again. Markpion doesn't open it to avoid damaging it on save.

## "The maximum supported size is 50 MB"

**Problem:** a very large file won't open.

**Solution:** documents up to 50 MB can be opened. Split larger files into several documents. Above 1 MB, the live preview pauses to keep typing fast; use **Render Now** in the preview.

## "The file or folder no longer exists"

**Problem:** opening a recent file, or saving, fails because the file was moved or deleted.

**Solution:** open it from its new location with **File → Open File…**, or use **Save As** to save your text somewhere else.

## "Markpion hasn't been given access to this location"

**Problem:** a file can't be opened or saved: *"Open the file or its folder first."*

**Possible cause:** for privacy, Markpion only accesses files and folders you've opened yourself.

**Solution:** open the file with **File → Open File…**, or its folder with **File → Open Folder…**.

## Additional diagnostics

**Help → Export Diagnostic Logs…** saves a log of the failed operations (no document text).

## Report an issue

If a file won't open or save and none of this applies, [report it on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) with the exact message and the diagnostic log.
