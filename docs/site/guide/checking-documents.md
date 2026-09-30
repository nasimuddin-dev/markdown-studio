---
title: Checking Documents
description: Find problems in Markdown documents with Markpion, using the Markdown lint and Problems panel for one file and the link check for a whole folder.
---

# Checking documents

## Markdown lint

While you type, Markpion checks the document for common problems and underlines them in the editor:

- Broken links to files that don't exist
- Missing images
- Links to `#anchors` that don't match any heading
- Duplicate headings
- Skipped heading levels (for example `#` followed by `###`)
- Headings without a space after the `#` (`#Title` is plain text, not a heading), and a `---` right under a line of text, which turns that line into a heading instead of drawing a horizontal rule
- List items without a space after the marker (`-item` or `2.item` next to other list items are plain text), and bold with spaces just inside the markers (`** bold**` isn't bold)
- Link and image paths with spaces (`![Logo](my logo.png)` isn't an image; wrap the path in `<…>`)
- Images without alt text, and links without text (screen readers would read out the address)
- Table rows with more or fewer cells than the header (extra cells aren't shown; a `|` inside a cell, even in code, needs a backslash: `\|`), a text line right after a table (it becomes a row; add a blank line), and a header whose divider row has a different number of cells (it isn't shown as a table)
- Footnote references such as `[^1]` without a definition (they're shown as plain text), and definitions nothing refers to

The status bar shows the count of warnings and suggestions. Click it to open the **Problems** panel, then click a problem to jump to it, or press **F8** / **Shift+F8** (**Edit → Go to Next / Previous Problem**) to move between problems in the editor. Some problems have a quick fix, as a button in the panel and in the problem's tooltip: **Add Blank Line** after a table, **Add Empty Cells** to a short table row, **Fix Table** for a table with other mistakes (see [Fix Table](/markdown/tables#table-tools)), **Add Definition** for a footnote (it goes at the end of the document, ready for its text), **Change to H2** (or the right level) for a skipped heading level, **Add Space** after `#` or a list marker, **Remove Spaces** inside `**`, **Wrap in <…>** for a path with spaces, **Make It a Rule** for a `---` under text, and **Change to #…** for a link to a misspelled heading anchor (the closest heading, when one is clearly meant). **Edit → Fix All Problems** applies every quick fix in the document at once, as one edit that **Ctrl+Z** undoes; suggested anchors are left for you to check. To stop one kind of check, choose **Don't Show This Check** on one of its problems; **Settings → Editor** lists the checks you turned off, with **Show Again**. Turn all checks off with **Settings → Editor → Check Markdown for problems**. An organization can preset or lock the list with managed settings (`lintDisabledRules`, see [Configuration](/reference/configuration)).

## Link check

The **Links** tab in the sidebar (or **Edit → Check Links in Folder**) checks every link in every Markdown file of the open folder:

- links to files that don't exist;
- missing images;
- `#anchors` that don't exist, both within a file and across files (`guide.md#setup`);
- empty links.

Inline links and images (`[text](path)`), reference-style link definitions (`[id]: path`) and HTML `<a href>` and `<img src>` tags are checked (entities such as `&amp;` in them are understood); links inside code are not. Results are grouped by file. Click a problem to open the file at that line. Web links (`https://…`) are not checked, because that would need the internet, and neither are files outside the open folder.
