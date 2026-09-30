---
title: Front Matter, Alerts & Footnotes
description: Use YAML front matter, GitHub-style alerts (NOTE, TIP, IMPORTANT, WARNING, CAUTION) and footnotes in Markpion, and how each looks in the preview and in exports.
---

# Front matter, alerts & footnotes

## Front matter

YAML front matter is a block of metadata at the very top of a file, between two `---` lines. Static site generators such as Jekyll and Hugo, and apps such as Obsidian, use it:

```markdown
---
title: Release checklist
author: Docs team
tags: [release, process]
date: 2026-09-25
---

# Release checklist
```

- In the **preview**, the front matter is shown as a small table of keys and values, like on GitHub.
- It's **left out of exports** (HTML, PDF and Word).
- If it has a `title`, that becomes the title of the exported document.
- `author` (or `authors`), `description` (or `summary`, `subject`) and `keywords` (or `tags`) become the exported file's document properties: the Author, Subject and Keywords of a PDF, the Author, Subject, Comments and Tags of a Word document, and `<meta>` tags in HTML. Lists are joined with commas.

## Alerts

Alerts are GitHub's highlighted callouts. **Format → Insert Callout: Note** (or Tip, Important, Warning, Caution) inserts one, quoting the selected text under it. Or start a quote with one of five markers:

```markdown
> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!IMPORTANT]
> Key information users need to know.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!CAUTION]
> Advises about risks or negative outcomes.
```

The **preview** and **HTML export** show them as coloured callouts with an icon and a title. **PDF** and **Word** exports show them as callouts labelled Note, Tip, Important, Warning or Caution. On GitHub, the same Markdown shows GitHub's alert style.

## Footnotes

Footnotes put a reference number in the text and the note at the end of the document:

```markdown
Markpion stores files locally.[^1]

[^1]: Nothing is uploaded unless you share the file yourself.
```

**Format → Insert Footnote** (**Ctrl+Alt+R**, **Cmd+Option+R** on macOS) inserts the next free number at the cursor, adds the definition at the end of the document, and moves the cursor there so you can type the note.

Notes are numbered in the order they're first referenced, whatever their labels, and definitions that are never referenced are left out. In the exports:

| Where | Footnotes |
| --- | --- |
| Preview, HTML export, Print / Save as PDF | Superscript links to a **Footnotes** section at the end, with links back |
| Export as PDF | Superscript numbers that link to a **Footnotes** section at the end of the document |
| Export as Word | Real Word footnotes: Word numbers them and places each note at the bottom of its page |

## Wiki links

Markpion understands the double-bracket links of wikis and note-taking apps:

| You write | It links to |
| --- | --- |
| `[[Setup Guide]]` | `Setup Guide.md` in the same folder, shown as "Setup Guide" |
| `[[docs/api\|the API]]` | `docs/api.md`, shown as "the API" |
| `[[docs/api#Error Codes]]` | the "Error Codes" heading in `docs/api.md` |

The page is a path relative to the document, and `.md` is added when it has no extension. Type `[[` to pick a document of the open folder from a list (and `#` after the page, or `[[#`, to pick one of its headings), and **Ctrl+click** (**Cmd+click**) a wiki link in the editor to open it. The preview, HTML, PDF and Word exports show wiki links as ordinary links.

Wiki links aren't part of GitHub Flavored Markdown, so GitHub and other Markdown apps show them as plain text. Missing pages and headings are reported like other broken links, and wiki links count in **Links to this document**. Renaming or moving a file in Markpion updates the wiki links to it, as it does for Markdown links, keeping their style (`[[docs/guide]]` stays without `.md`), heading and text.

## Tags

Write `#` and a word anywhere in the text to tag a document: `#draft`, `#project/alpha`. You can also list tags in the front matter (`tags: [draft, work]`). A tag needs at least one letter (`#1` isn't a tag), and `#` at the start of a heading, in code or in a link isn't one either.

The preview and HTML exports show inline tags as small highlighted labels (click one in the preview to list where else it's used); PDF and Word exports show them as plain text. **Edit → Go to Tag…** lists the tags of the open folder; see [Tags](/guide/search-replace#tags). Other Markdown apps show tags as plain text.
