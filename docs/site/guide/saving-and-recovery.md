---
title: Saving, History & Recovery
description: How Markpion protects your work, including safe atomic saves, auto save, files changed on disk, local file history with restore, crash recovery, encodings, line endings and save options.
---

# Saving, history & recovery

## Saving

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Save | Ctrl+S | Cmd+S |
| Save As | Ctrl+Shift+S | Cmd+Shift+S |
| Save All | Ctrl+Alt+S | Cmd+Option+S |

A new document asks for a name and location the first time you save it. Saving is **atomic**: the text is written to a temporary file that then replaces the original, so an interruption (a crash or power loss) can't leave a half-written file.

If saving fails, the document stays marked as unsaved and your text stays in the editor. The message says what happened and what to do, for example:

- **No permission to write here:** use **Save As** to save a copy somewhere else.
- **The disk is full:** free up space and save again.
- **The file was changed by another program:** see below.

## Auto save

Auto save is off by default. In **Settings → Files → Auto save**, choose:

- **After a delay**: saves 0.5 to 30 seconds after you stop typing.
- **When switching tabs or windows**: saves when the editor loses focus.

Untitled documents are never auto-saved, and auto save never overwrites a file that was changed on disk.

## Files changed on disk

Markpion notices when a file you have open is changed by another program:

- If you have **no unsaved changes**, the tab reloads automatically.
- If you **have unsaved changes**, a banner offers:
  - **Reload (discard mine)**: load the version on disk.
  - **Compare**: open the version on disk so you can compare the two.
  - **Keep Mine**: keep your text; the next save overwrites the file on disk.

Saving over a file that changed since you opened it is refused until you choose, so no one's work is overwritten silently.

## File history

Every time you save a file, Markpion keeps the **previous version** in its app data folder, not next to your files. The last **30 versions** of each file are kept.

Open **File → File History…** (or right-click a tab → **File History…**) to see the versions with their dates and a line-by-line diff against the current text. **Restore** puts an old version into the editor as a normal edit, so you can undo it or save it.

When the file is committed to Git, the list also starts with **Last commit**: compare the whole file with its committed version, or restore it. (For single changes, use the [change bars](/guide/file-explorer#changed-lines-in-the-editor) in the editor.) This needs Git installed and **Settings → Files → Show Git branch, changed files and changed lines** on.

## Crash recovery

While you work, unsaved documents are snapshotted every few seconds to the app data folder. If Markpion or your computer stops unexpectedly, the next start offers to recover those documents. Saved files don't need recovery.

## Session restore

By default, Markpion reopens your last folder and files when it starts. Turn this off in **Settings → Startup → Reopen last folder and files**.

## Encodings and line endings

- Files are read and written as **UTF-8**. A byte-order mark (BOM) is kept if the file had one; the status bar shows **UTF-8** or **UTF-8 with BOM**.
- A file that isn't valid UTF-8 is **not opened**, so it can't be corrupted by saving it.
- **LF** and **CRLF** line endings are preserved per file (shown in the status bar). New files use the setting **Line endings for new files** (LF by default).

## Save options

In **Settings → Files**:

- **Trim trailing whitespace on save.** Markdown hard line breaks (two trailing spaces) and code blocks are left alone.
- **Insert a final newline on save.**
- **Keep the table of contents up to date on save** (on by default).
