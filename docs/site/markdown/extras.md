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

Alerts are GitHub's highlighted callouts. Start a quote with one of five markers:

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
