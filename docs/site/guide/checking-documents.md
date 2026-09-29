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
- Images without alt text

The status bar shows the count of warnings and suggestions. Click it to open the **Problems** panel, then click a problem to jump to it. Turn the checks off with **Settings → Editor → Check Markdown for problems**.

## Link check

The **Links** tab in the sidebar (or **Edit → Check Links in Folder**) checks every link in every Markdown file of the open folder:

- links to files that don't exist;
- missing images;
- `#anchors` that don't exist, both within a file and across files (`guide.md#setup`);
- empty links.

Inline links and images (`[text](path)`), reference-style link definitions (`[id]: path`) and HTML `<a href>` and `<img src>` tags are checked; links inside code are not. Results are grouped by file. Click a problem to open the file at that line. Web links (`https://…`) are not checked, because that would need the internet, and neither are files outside the open folder.
