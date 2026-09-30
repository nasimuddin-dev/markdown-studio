---
title: Tabs
description: Work with several documents at once in Markpion tabs. Switch, reorder and close tabs, see unsaved changes, reopen closed tabs, and use tab context actions.
---

# Tabs

Every open document gets a tab above the editor. The active tab is marked with an accent bar and a bold name.

## Unsaved changes

A dot on a tab marks unsaved changes, its name is shown in italics, and the tab's accessible name says "(unsaved)". The status bar and the window title show it too. If you close a tab or quit with unsaved changes, Markpion asks whether to **Save**, **Don't Save** or **Cancel**.

## Switching and arranging

| Action | Shortcut |
| --- | --- |
| Next tab | Ctrl+Tab |
| Previous tab | Ctrl+Shift+Tab |
| Close tab | Ctrl+W (Cmd+W on macOS) |
| Reopen closed tab | Ctrl+Shift+T (Cmd+Shift+T on macOS) |

- Drag a tab left or right to reorder it.
- Long file names are shortened with "…"; hover a tab to see its full path.
- When more tabs are open than fit, scroll the tab strip with the mouse wheel. The active tab is always scrolled into view.
- When the tab list has focus, the arrow keys move between tabs.
- The **+** button after the last tab creates a new file.

## Reopen closed tabs

**File → Reopen Closed Tab** reopens the most recently closed file; use it again for the one before, up to 20 files. Files that are already open again, or have been deleted, are skipped. Untitled documents that were never saved aren't kept.

## Tab context menu

Right-click a tab for:

- **Close**, **Close Others**, **Close to the Right** and **Close Saved**
- **Rename…**: renames the file on disk, even when no folder is open (a document that was never saved offers **Save As…** instead). The new name stays in the same folder, an existing file is never replaced, and the Recent list follows the new name.
- **Open Containing Folder…** (for a file outside the open folder): opens the folder dialog in the file's folder, so you can open it in the Explorer
- **File History…** (see [Saving & recovery](/guide/saving-and-recovery#file-history))
- **Copy Path** and **Reveal in File Explorer** (**Reveal in Finder** on macOS)

## Undo history

Each tab keeps its own undo history and cursor position while it's open, so switching tabs doesn't lose them.
