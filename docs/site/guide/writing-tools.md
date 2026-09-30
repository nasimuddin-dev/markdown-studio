---
title: Writing Tools
description: Markpion's formatting commands, heading tools, move section, task lists, footnotes, link completion, table of contents and document templates.
---

# Writing tools

Everything here is in the **Format** menu (the **Table** menu for tables, the **File** menu for templates) and the command palette (**Ctrl+Shift+P**). On macOS, use **Cmd** for **Ctrl** and **Option** for **Alt**.

## Text formatting

Select text and apply a format, or apply it with nothing selected to insert the markers and type inside them. Applying the same format again removes it.

| Format | Shortcut | Result |
| --- | --- | --- |
| Bold | Ctrl+B | `**text**` |
| Italic | Ctrl+I | `*text*` |
| Strikethrough | Ctrl+Shift+X | `~~text~~` |
| Inline code | Ctrl+E | `` `text` `` |
| Insert link | Ctrl+K | `[text](https://)` |

With the cursor inside an existing link, **Insert Link** (**Ctrl+K**) selects its address so you can change it. **Format → Remove Link** turns the link at the cursor, or every link in the selection, back into plain text (images stay).

## Headings

| Command | Shortcut |
| --- | --- |
| Heading 1 to 6 | Ctrl+Alt+1 to Ctrl+Alt+6 |
| Normal text (remove the heading) | Ctrl+Alt+0 |
| Promote heading (`###` → `##`) | Ctrl+Alt+= |
| Demote heading (`##` → `###`) | Ctrl+Alt+- |

Promote and demote work on every selected heading and stay within H1–H6.

### Rename a heading

Put the cursor on a heading and press **F2** (**Format → Rename Heading…**, or right-click it in the Outline). Type the new text and Markpion changes the heading and every `#anchor` link to it in the document, in the same edit (**Ctrl+Z** undoes it). If other Markdown files in the open folder link to the heading (`guide.md#set-up`), it lists how many and offers to update them too; files with unsaved changes are skipped, and each changed file keeps its previous version in File History. When two headings have the same text, their anchors are numbered (`#notes`, `#notes-1`), and links to both are kept pointing at the right one.

**F2** also renames labels: on a footnote such as `[^1]`, every reference to it and its definition get the new label; on a link reference such as `[text][guide]`, `[guide][]` or a `[guide]: …` definition, every link using that label and the definition change together (`[guide][]` becomes `[guide][manual]`, so its text stays).

### Number headings

**Format → Number Headings** numbers every heading, as in specifications and policies: `## 1. Introduction`, `### 1.1 Purpose`, `#### 1.1.1 Scope`. A single H1 title at the top of the document isn't numbered. After you add, remove or move sections, run it again to renumber. **Format → Remove Heading Numbers** takes the numbers off again. Both are one edit, so **Ctrl+Z** undoes them, and a [table of contents](#table-of-contents) in the document is updated too.

Only numbers with a dot count as existing numbers (`1.`, `2.3`), so a heading such as "2024 Roadmap" or "10 Tips" keeps its text. Numbering changes the headings' anchors (`#1-introduction` instead of `#introduction`); [Check Links](/guide/checking-documents) finds links elsewhere that need updating. To change one heading's text, use [Rename Heading](#rename-a-heading), which updates the links for you.

### Select a section

**Edit → Select Section** (or right-click a heading in the Outline → **Select Section**) selects the section at the cursor: its heading, its text and its subsections. Run it again to select the section it belongs to, and so on up to the top-level section. It's a quick way to copy, cut or replace a whole section.

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
- **Insert Table** inserts a two-column table to fill in; the toolbar's Table button asks for the size first. **Format Table** (**Ctrl+Alt+T**) aligns it, the **Table: Insert/Delete Row and Column** commands change its shape, and **Sort Table by Column** sorts it. See [Tables](/markdown/tables).
- **Insert Math Block** puts `$$` lines around the selection (or an empty formula), and **Inline Math** wraps the selection in `$…$`. See [Math](/markdown/math).
- **Insert Flowchart**, **Sequence Diagram**, **Gantt Chart** or **Pie Chart (Mermaid)** inserts a small working diagram to edit, with its first line selected. See [Mermaid diagrams](/markdown/mermaid).
- **Horizontal Rule** inserts `---`.
- **Toggle Comment** (**Ctrl+/**) wraps the selected lines, or the cursor's line, in an HTML comment (`<!-- … -->`): the text stays in the file but doesn't appear in the preview or in exports. Press it again to remove the comment.
- **Insert Footnote** (**Ctrl+Alt+R**) inserts the next numbered reference, such as `[^1]`, at the cursor and adds its definition at the end of the document, where the cursor moves so you can type the note. See [Footnotes](/markdown/extras#footnotes).

## Links

- **Autocompletion:** type `](` to get a list of the workspace's Markdown files, `![](` for images, and `](#` for the headings in the document; after a file name, as in `](guide.md#`, you get that document's headings. After `][`, as in `[text][`, you get the reference labels the document defines (`[label]: address` lines), with their addresses; after `[^` in text, the footnotes it defines. Picking one adds the closing `]` if it's missing. Type a colon and two letters, such as `:roc`, to pick an emoji shortcode (🚀 `:rocket:`); it isn't offered inside code or right after a letter or digit, so times like `10:30` are left alone.
- **Follow a link from the editor:** hold **Ctrl** (**Cmd** on macOS) and click it; links are underlined while the key is down. From the keyboard, put the cursor on a link and press **Alt+Enter** (**Format → Open Link at Cursor**). Web addresses open in your browser, `#heading` links move to the heading, links to Markdown files open them in a tab (at the heading after `#`), and a reference link such as `[text][id]` goes to its `[id]: …` definition. Links inside code are left alone. Ctrl+click elsewhere still adds a cursor.
- **Paste a URL over a selection** to turn the selected text into a link.
- **See a picture without the preview:** hover over an image link (`![alt](path)`, a `[id]: picture.png` definition or an `<img>` tag) in the editor and the picture appears above it. Local pictures need the document to be saved, so their path can be found.
- **Format → Convert Links to Reference Style** turns inline links and images such as `[text](address "title")` into `[text][1]`, with a numbered `[1]: address "title"` line at the end of the document, so paragraphs with long addresses stay readable. Links to the same address (and title) share one definition, and existing definitions are reused. **Convert Links to Inline Style** does the opposite for `[text][label]`, `[label][]` and `[label]` references, and removes the definitions nothing uses anymore. Both work on the selection, or the whole document when nothing is selected, and **Ctrl+Z** undoes them in one step. Links in code are left alone.
- **Link to a heading:** right-click it in the Outline and choose **Copy Link to Heading** or **Copy Markdown Link**, or run **Copy Link to Current Heading** from the command palette to copy the `#anchor` of the section the cursor is in.
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

## Date and time

**Format → Insert Date** inserts today's date (`2026-09-30`), and **Insert Date and Time** adds the time (`2026-09-30 14:05`), in your computer's time zone: the same formats templates use for `{{date}}` and `{{datetime}}`.

## Front matter

**Format → Insert Front Matter** adds a front matter block at the top of the document with a `title` (its first heading, else the file name), today's `date` and empty `tags`, with the title selected so you can change it. If the document already has front matter, the cursor moves to its end instead. See [Front matter](/markdown/extras#front-matter).

## Snippets

**Format → Insert Snippet…** inserts a piece of text at the cursor: a collapsible section (`<details>`), a keyboard key (`<kbd>`) or a task list, plus any Markdown file in a folder named `snippets` at the top of your open workspace. Snippets can use the same placeholders as templates (below), such as `{{date}}`, and `{{cursor}}` marks where the cursor goes. The selected text, if any, is replaced.

## Templates

**File → New from Template…** starts a new document from a template:

- Meeting notes
- Project README
- Blog post (with front matter)
- Decision record (ADR)
- Weekly status report
- Changelog
- Daily journal

Any Markdown file in a folder named `templates` at the top of your open workspace appears in the list too, so a team can share its own templates. **File → Save as Template…** saves the document you're editing there (the folder is created if needed).

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
