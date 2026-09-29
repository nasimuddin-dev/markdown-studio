---
title: Writing Tools
description: Markpion's formatting commands, heading tools, move section, task lists, footnotes, link completion, table of contents and document templates.
---

# Writing tools

Everything here is in the **Format** menu (or **File** menu for templates) and the command palette (**Ctrl+Shift+P**). On macOS, use **Cmd** for **Ctrl** and **Option** for **Alt**.

## Text formatting

Select text and apply a format, or apply it with nothing selected to insert the markers and type inside them. Applying the same format again removes it.

| Format | Shortcut | Result |
| --- | --- | --- |
| Bold | Ctrl+B | `**text**` |
| Italic | Ctrl+I | `*text*` |
| Strikethrough | Ctrl+Shift+X | `~~text~~` |
| Inline code | Ctrl+E | `` `text` `` |
| Insert link | Ctrl+K | `[text](https://)` |

## Headings

| Command | Shortcut |
| --- | --- |
| Heading 1, 2, 3 | Ctrl+Alt+1, Ctrl+Alt+2, Ctrl+Alt+3 |
| Normal text (remove the heading) | Ctrl+Alt+0 |
| Promote heading (`###` → `##`) | Ctrl+Alt+= |
| Demote heading (`##` → `###`) | Ctrl+Alt+- |

Promote and demote work on every selected heading and stay within H1–H6.

### Move a section

**Format → Move Section Up** and **Move Section Down** move the section at the cursor (its heading, its text and all its subsections) above the previous section or below the next one at the same level. Sections don't leave their parent: a `###` under one `##` never jumps into another. Lines inside code blocks that start with `#` are not treated as headings.

You can also move sections from the **Outline**:

- **Drag** a heading onto another one: a line shows where it will go, and the section (with its subsections) is placed just before that heading. Drop it below the last heading to move it to the end. Dragging can also move a subsection into another part of the document.
- Right-click a heading and choose **Move Section Up** or **Move Section Down**.
- Focus a heading and press **Alt+↑** / **Alt+↓**. Focus stays on the moved heading, so you can press the keys repeatedly.

Every move can be undone with **Ctrl+Z**. Moving works on `#` headings; underlined (setext) headings can't be dragged.

## Lists, quotes and tasks

| Command | Shortcut |
| --- | --- |
| Bulleted list | Ctrl+Shift+8 |
| Numbered list | Ctrl+Shift+7 |
| Task list (`- [ ]`) | Ctrl+Shift+9 |
| Check / uncheck task | Ctrl+Enter |
| Quote | Ctrl+Shift+. |

The list commands work on all selected lines, and applying one again removes it. **Check / Uncheck Task** works on the tasks on the selected lines: if any is open, all are checked; otherwise all are unchecked. On a line that isn't a task, **Ctrl+Enter** keeps its usual behaviour. You can also tick tasks by clicking their checkboxes in the [preview](/guide/preview).

## Blocks

- **Code Block** (**Ctrl+Alt+C**) inserts a fenced code block. Type the language after the backticks.
- **Insert Table** inserts a two-column table to fill in. **Format Table** (**Ctrl+Alt+T**) aligns it, and **Sort Table by Column** sorts it. See [Tables](/markdown/tables).
- **Horizontal Rule** inserts `---`.
- **Insert Footnote** (**Ctrl+Alt+R**) inserts the next numbered reference, such as `[^1]`, at the cursor and adds its definition at the end of the document, where the cursor moves so you can type the note. See [Footnotes](/markdown/extras#footnotes).

## Links

- **Autocompletion:** type `](` to get a list of the workspace's Markdown files, `![](` for images, and `](#` for the headings in the document.
- **Paste a URL over a selection** to turn the selected text into a link.
- **Link to a heading:** right-click it in the Outline and choose **Copy Link to Heading** or **Copy Markdown Link**.
- The [link check](/guide/checking-documents) finds links that point nowhere.

## Table of contents

**Format → Insert / Update Table of Contents** inserts a linked, nested list of the document's headings at the cursor, between two markers:

```markdown
<!-- toc -->
- [Installation](#installation)
  - [Windows](#windows)
<!-- tocstop -->
```

It lists the top two heading levels below the title (a single H1 at the top is left out). Run the command again to update it, or leave **Keep the table of contents up to date on save** on in Settings and it updates each time you save. The links use the same anchors as the preview and GitHub.

## Templates

**File → New from Template…** starts a new document from a template:

- Meeting notes
- Project README
- Blog post (with front matter)
- Decision record (ADR)
- Weekly status report
- Changelog
- Daily journal

Any Markdown file in a folder named `templates` at the top of your open workspace appears in the list too, so a team can share its own templates.

::: v-pre
Templates can contain placeholders, which are filled in when the document is created:

| Placeholder | Replaced with |
| --- | --- |
| `{{date}}` | Today's date, for example 2026-09-25 |
| `{{time}}` | The time, for example 14:05 |
| `{{datetime}}` | Date and time |
| `{{year}}` | The year |
| `{{week}}` | The ISO week number |
| `{{title}}` | The template's name |
| `{{cursor}}` | Where the cursor is placed |
:::
