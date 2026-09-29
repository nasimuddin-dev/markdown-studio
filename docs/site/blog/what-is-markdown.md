---
title: What Is Markdown? A Practical Introduction
description: A practical introduction to Markdown, covering what it is, why developers and writers use it, the syntax you need on day one, Markdown flavours, and tools for editing it.
date: 2026-09-25
---

# What is Markdown? A practical introduction

*2026-09-25*

Markdown is a way of writing formatted documents in plain text. Instead of clicking a **Bold** button, you type `**bold**`. Instead of choosing "Heading 1" from a menu, you start a line with `#`. The text stays readable as it is, and any Markdown tool can turn it into a formatted page.

John Gruber and Aaron Swartz created it in 2004 with one goal: a format that's easy to read and write as plain text. More than twenty years later it's everywhere: README files, documentation sites, note-taking apps, chat tools, and static blogs.

## Why people use it

- **It's just text.** A `.md` file opens in any editor on any system, today and in 30 years. No proprietary format, no lock-in.
- **It works with version control.** Git shows exactly which lines changed, and reviewing a change to a document looks like reviewing code.
- **You keep your hands on the keyboard.** Formatting is typed, not clicked.
- **One source, many outputs.** The same file can become a web page, a PDF, a Word document or a slide deck.

## The syntax you need on day one

```markdown
# A heading
## A smaller heading

A paragraph with **bold**, *italic* and `code`.

- A bulleted list
- with two items

1. A numbered list
2. with two items

[A link](https://example.com) and an image:

![A description of the image](picture.png)

> A quotation.
```

That's most of what everyday documents need. Leave a blank line between paragraphs and around lists and headings, and you'll avoid most surprises.

## Flavours of Markdown

The original Markdown left some details open, so several dialects appeared:

- **CommonMark** is a precise specification of the core syntax, so different tools give the same result.
- **GitHub Flavored Markdown (GFM)** is CommonMark plus tables, task lists (`- [ ]`), strikethrough (`~~text~~`), autolinks and footnotes. It's the most widely used dialect because GitHub uses it for READMEs, issues and wikis.
- Many tools add extensions on top, such as **Mermaid diagrams**, **math** with `$…$`, and **front matter** metadata. GitHub supports these too.

If you write GFM, your documents will look right on GitHub and in most editors.

## How to write and preview Markdown

You can write Markdown in any text editor, but a dedicated editor helps: it highlights the syntax, shows a live preview, and handles the fiddly parts such as aligning tables or inserting links.

[Markpion](/) is one such editor, a free desktop app for Windows, macOS and Linux. It shows your file and its preview side by side and works with the files in your folders. The [first document walkthrough](/getting-started/first-document) takes five minutes.

## Where to go next

- [Markdown basics](/markdown/): the full syntax with examples.
- [Markdown tables guide](/blog/markdown-tables-guide).
- [How to write a great README](/blog/how-to-write-a-great-readme).
