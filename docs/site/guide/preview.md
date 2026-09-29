---
title: Preview
description: How Markpion's live preview works, including views, update delay, synced scrolling, links, images, clickable task checkboxes, safe HTML, and large-document mode.
---

# Preview

The preview renders your Markdown as you type, in a style close to GitHub's. It supports [GitHub Flavored Markdown](/markdown/gfm), [Mermaid diagrams](/markdown/mermaid), [math](/markdown/math), and [front matter, alerts and footnotes](/markdown/extras).

<figure>
  <img class="screenshot" src="../images/markpion-editor.webp" alt="Split view with Markdown source on the left and the rendered preview with a table, task list and code block on the right" width="1440" height="900" loading="lazy">
  <figcaption>Split view: the editor on the left, the preview on the right.</figcaption>
</figure>

## Views

Choose **Editor Only** (**Ctrl+1**), **Split View** (**Ctrl+2**) or **Preview Only** (**Ctrl+3**) from the **View** menu or the buttons at the top right. **Ctrl+\\** cycles through them. On macOS, use **Cmd**.

## Updates and scrolling

- The preview updates shortly after you stop typing. The delay is set by **Settings → Preview → Update delay after typing** (instant to 1 second; 150 ms by default).
- In split view, the editor and preview scroll together. Turn this off with **Sync editor and preview scrolling**.

## Interacting with the preview

- **Links:** web links (`http`, `https`, `mailto`) open in your browser. `#heading` links scroll to the heading. Links to other Markdown files open them in a new tab. Other link types are blocked for safety.
- **Task checkboxes:** click a checkbox (or focus it and press **Space**) to check or uncheck the task in the source. It's a normal edit, so **Ctrl+Z** undoes it.
- **Images:** local images are loaded relative to the document. They only show once the document is saved, because a relative path needs a location. See [Images](/markdown/images).

## Safe HTML

Raw HTML in Markdown is rendered, then **sanitized with GitHub's allow-list**. Scripts, event handlers, iframes, forms, styles and `javascript:` links are removed, and a strict Content Security Policy blocks inline scripts. So a document you download can't run code in Markpion.

## Large documents

Above **1 MB** of text, the live preview pauses so typing stays fast. A bar at the top of the preview offers **Render Now** (and then **Refresh Preview**) to render on demand. The editor handles large files normally, and files up to 50 MB can be opened.

## Printing and exporting

What you see in the preview is what **Export as HTML**, **Export as PDF**, **Export as Word** and **Print / Save as PDF** produce, without the front matter table. See [Import & export](/guide/import-export#export).
