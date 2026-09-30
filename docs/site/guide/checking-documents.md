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
- Headings without a space after the `#` (`#Title` is plain text, not a heading; a line of [tags](/markdown/extras#tags) such as `#idea #work`, or a single lower-case `#idea`, isn't flagged), and a `---` right under a line of text, which turns that line into a heading instead of drawing a horizontal rule
- List items without a space after the marker (`-item` or `2.item` next to other list items are plain text), and bold with spaces just inside the markers (`** bold**` isn't bold)
- Link and image paths with spaces (`![Logo](my logo.png)` isn't an image; wrap the path in `<…>`)
- Images without alt text, and links without text (screen readers would read out the address)
- Table rows with more or fewer cells than the header (extra cells aren't shown; a `|` inside a cell, even in code, needs a backslash: `\|`), a text line right after a table (it becomes a row; add a blank line), and a header whose divider row has a different number of cells (it isn't shown as a table)
- Footnote references such as `[^1]` without a definition (they're shown as plain text), and definitions nothing refers to
- Front matter without its closing `---` (it would show as a line and text); **Close Front Matter** adds it after the last property
- A `#tag` written in a less common capitalisation than elsewhere in the document (`#Idea` next to `#idea`); the fix changes it to the common one
- Reference-style links such as `[text][id]` or `[id][]` whose `[id]: address` definition is missing (they're shown as plain text), and definitions nothing uses, or a label defined twice (links use the first definition). Labels match without regard to case or extra spaces

The status bar shows the count of warnings and suggestions. Click it to open the **Problems** panel, then click a problem to jump to it, or press **F8** / **Shift+F8** (**Edit → Go to Next / Previous Problem**) to move between problems in the editor. Some problems have a quick fix, as a button in the panel and in the problem's tooltip: **Add Blank Line** after a table, **Add Empty Cells** to a short table row, **Fix Table** for a table with other mistakes (see [Fix Table](/markdown/tables#table-tools)), **Add Definition** for a footnote or a reference link (it goes at the end of the document, after any other definitions there, ready for its text or address), **Change to H2** (or the right level) for a skipped heading level, **Add Space** after `#` or a list marker, **Remove Spaces** inside `**`, **Wrap in <…>** for a path with spaces, **Make It a Rule** for a `---` under text, **Change to #…** for a link to a misspelled heading anchor (the closest heading, when one is clearly meant), and **Change to guide.md** (or whichever file is clearly meant) for a link or image whose file name is misspelled, looking in the folder it points to. **Edit → Fix All Problems** applies every quick fix in the document at once, as one edit that **Ctrl+Z** undoes; suggested anchors are left for you to check. To stop one kind of check, choose **Don't Show This Check** on one of its problems; **Settings → Editor** lists the checks you turned off, with **Show Again**. Turn all checks off with **Settings → Editor → Check Markdown for problems**. An organization can preset or lock the list with managed settings (`lintDisabledRules`, see [Configuration](/reference/configuration)).

## Link check

The **Links** tab in the sidebar (or **Edit → Check Links in Folder**) checks every link in every Markdown file of the open folder:

- links to files that don't exist;
- missing images;
- `#anchors` that don't exist, both within a file and across files (`guide.md#setup`);
- empty links.

Inline links and images (`[text](path)`), reference-style link definitions (`[id]: path`) and HTML `<a href>` and `<img src>` tags are checked (entities such as `&amp;` in them are understood); links inside code are not. Results are grouped by file; for a misspelled file name, the message says which file in that folder was probably meant. Click a problem to open the file at that line. Web links (`https://…`) are not checked, because that would need the internet, and neither are files outside the open folder.

At the top, **Links to** *the open document* lists the other Markdown files in the folder that link to it (inline links, reference definitions and HTML links, not images), with the link text and line. Click one to open that file at the link. The list comes from the last check, so after adding links elsewhere, save and press **Check again**.

Below it, **Mentions without a link** lists places in the other files that name the open document (its file name, or its title from the front matter or first heading) as whole words but don't link to it: candidates for a link. Code, existing links and lines that already link to the document are skipped; up to 200 are shown.
