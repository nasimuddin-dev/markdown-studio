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
- Images without alt text, and links without text (screen readers would read out the address)
- Table rows with more or fewer cells than the header (extra cells aren't shown; a `|` inside a cell, even in code, needs a backslash: `|`), a text line right after a table (it becomes a row; add a blank line), and a header whose divider row has a different number of cells (it isn't shown as a table)
- Footnote references such as `[^1]` without a definition (they're shown as plain text), and definitions nothing refers to

The status bar shows the count of warnings and suggestions. Click it to open the **Problems** panel, then click a problem to jump to it. Some problems have a quick fix, as a button in the panel and in the problem's tooltip: **Add Blank Line** after a table, **Add Empty Cells** to a short table row, and **Add Definition** for a footnote (it goes at the end of the document, ready for its text). Turn the checks off with **Settings → Editor → Check Markdown for problems**.

## Link check

The **Links** tab in the sidebar (or **Edit → Check Links in Folder**) checks every link in every Markdown file of the open folder:

- links to files that don't exist;
- missing images;
- `#anchors` that don't exist, both within a file and across files (`guide.md#setup`);
- empty links.

Inline links and images (`[text](path)`), reference-style link definitions (`[id]: path`) and HTML `<a href>` and `<img src>` tags are checked (entities such as `&amp;` in them are understood); links inside code are not. Results are grouped by file. Click a problem to open the file at that line. Web links (`https://…`) are not checked, because that would need the internet, and neither are files outside the open folder.
