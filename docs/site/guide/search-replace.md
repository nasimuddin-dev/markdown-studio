---
title: Search & Replace
description: Find and replace text in a Markdown document, with match case, whole word and regular expressions, and search every Markdown file in a folder with Find in Files.
---

# Search & replace

## Find in the document

Press **Ctrl+F** (**Cmd+F** on macOS) to open the search bar at the top of the editor. Matches are highlighted; **Enter** / **Shift+Enter** (or **Next** and **Previous**) move to the next or previous one, and **Select All** selects every match for editing them together.

The search bar has three options:

- **Match case**: `Readme` doesn't match `README`.
- **Whole word**: finds whole words only.
- **Regex**: treats the search as a regular expression, for example `^## ` for level-2 headings or `\bTODO\b`.

Press **Esc** to close it.

### Find in the preview

When the preview is shown alone (**View → Preview**), or you clicked into it in split view, **Ctrl+F** searches the rendered text instead: a small bar opens at the top right of the preview, every match is highlighted, and the count shows which one you're on ("2 of 7"). **Enter** / **Shift+Enter** (or the arrows) move between matches, and **Esc** closes the bar. The search ignores case and follows the preview as you type in the editor. It finds up to 1,000 matches. Where the system's web engine can't highlight matches (older macOS and Linux versions), the current match is selected instead when you use the arrows.

## Replace

Press **Ctrl+H** (**Cmd+Option+F** on macOS) to open the search bar with the replace field. **Replace** replaces the current match, and **Replace All** replaces every match. With **Regex** on, the replacement can use groups such as `$1`. A replacement can be undone with **Ctrl+Z**.

## Go to line

**Ctrl+G** jumps to a line number.

## Go to heading

**Edit → Go to Heading…** (**Ctrl+Alt+H**, **Cmd+Option+H** on macOS) lists the document's headings, indented by level. Type part of a heading to filter the list, then press **Enter** to jump to it in the editor and the preview. It's handy in long documents when the Outline is hidden.

**Edit → Go to Heading in Folder…** (**Ctrl+Shift+Alt+H**, **Cmd+Shift+Option+H** on macOS) does the same across every Markdown file of the open folder: each heading shows its file, and **Enter** opens that file at the heading. Open documents are searched as they are in their tab, including unsaved changes.

## Find in Files

**Find in Files** (**Ctrl+Shift+F**, or the **Search** tab in the sidebar) searches every Markdown file in the open folder.

- Options: **Match case**, **Match whole word** and **Use regular expression**.
- Results are grouped by file, with the matching lines.
- Click a result to open the file with the match selected.
- Unsaved changes in open tabs are not searched; the search reads the files on disk.
- Hidden files and folders (starting with `.`) and `node_modules`, `target`, `dist` and `build` folders are skipped.

Find in Files needs an open folder.

### Files to include and exclude

Click **…** (**File filters**) next to the search options to limit the search to some files; the two fields appear below **Replace with**. Both fields take patterns separated by commas:

| Pattern | Matches |
| --- | --- |
| `docs` | a file or folder named `docs` anywhere, and everything in it |
| `*.draft.md` | files ending in `.draft.md` in any folder |
| `docs/api` | the `api` folder inside the top-level `docs` folder (a pattern with `/` starts at the open folder) |
| `guide/**/*.md` | Markdown files anywhere under `guide` (`**` crosses folders, `*` and `?` don't) |

**Files to include** searches only files that match one of its patterns (all files when it's empty); **Files to exclude** skips files that match any of its patterns. Matching ignores upper and lower case. The **…** button stays highlighted while a filter is set. Replace All uses the same filters.

## Replace in Files

To replace text in every Markdown file of the folder:

1. Search for the text in **Find in Files**, with the options and file filters you need.
2. Type the new text in **Replace with**. With **Use regular expression** on, `$1`, `$2`… insert the matching groups, `$<name>` a named group, `$&` the whole match and `$$` a dollar sign.
3. Click **Replace All** (or press **Ctrl+Enter** in the field). Markpion counts the matches in every file and asks you to confirm, for example "Replace 12 matches in 4 files".

What happens:

- Replacing works line by line, exactly like the search, so it changes what the results showed.
- **Files open with unsaved changes are skipped** and listed, so your edits are never overwritten. Save them and replace again if you want them included.
- A file changed by another program since it was read isn't overwritten, and the message says which files couldn't be written.
- Open tabs of changed files reload with the new text.
- **Each changed file's previous version is kept in [File History](/guide/saving-and-recovery#file-history)**, so a replacement can be undone file by file with **Restore**.

## Command palette

To find a **command** rather than text, open the command palette with **Ctrl+Shift+P** or **F1** and type part of its name, for example "table" or "export". Before you type, the commands you used most recently are at the top. To open a **file** by name, use **Go to File** (**Ctrl+Alt+O**); see [File explorer](/guide/file-explorer#go-to-file).
