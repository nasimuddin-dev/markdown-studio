---
title: Markdown Basics
description: The Markdown syntax supported by Markpion, with examples of headings, emphasis, lists, quotes, links, images, code, tables and horizontal rules.
---

# Markdown basics

Markdown is plain text with a few symbols that mark up structure: `#` for headings, `*` for emphasis, `-` for lists. Markpion follows [CommonMark](https://commonmark.org) and [GitHub Flavored Markdown](/markdown/gfm), the dialect used on GitHub, so your files look the same there.

Every example below renders in the Markpion preview as described.

## Headings

```markdown
# Heading 1
## Heading 2
### Heading 3
```

Up to six levels (`######`). Each heading gets an anchor, so you can link to it with `[see setup](#setup)`. **Ctrl+Alt+1** to **3** apply heading levels (see [Writing tools](/guide/writing-tools#headings)).

## Paragraphs and line breaks

Separate paragraphs with a blank line. To break a line without starting a new paragraph, end it with two spaces or a backslash `\`.

## Emphasis

```markdown
**Bold**, *italic*, ***both***, ~~strikethrough~~ and `inline code`.
```

## Lists

```markdown
- A bulleted item
- Another item
  - A nested item (indent by two spaces)

1. First
2. Second
3. Third

- [x] A completed task
- [ ] An open task
```

When you press **Enter** at the end of a list item, the next item is started for you. Tasks can be ticked in the preview or with **Ctrl+Enter**.

## Quotes

```markdown
> Markdown is intended to be as easy-to-read and easy-to-write as is feasible.
```

For highlighted notes and warnings, see [alerts](/markdown/extras#alerts).

## Links

```markdown
[Markpion on GitHub](https://github.com/nasimuddin-dev/markpion)
[Another document](docs/guide.md)
[A heading in this document](#links)
[A heading in another document](docs/guide.md#install)
<https://example.com>
```

Relative links to other Markdown files open them in Markpion when clicked in the preview. Web links open in your browser.

## Images

```markdown
![Screenshot of the settings](assets/settings.png)
```

The text in brackets is the alt text, read by screen readers. See [Images](/markdown/images) for local files and pasting.

## Code

Use backticks for `inline code`, and three backticks for a block, with the language for highlighting:

````markdown
```python
print("Hello")
```
````

See [Code blocks](/markdown/code-blocks).

## Tables

```markdown
| Column | Value |
| --- | --- |
| A | B |
```

See [Tables](/markdown/tables) for alignment and the table tools.

## Horizontal rule

A line with `---` (or `***`) on its own draws a horizontal rule. Leave a blank line above it, or the line above becomes a heading.

## Escaping

Put a backslash before a character to show it literally: `\*not italic\*`, `\#`, `\$`.

## HTML

Simple HTML such as `<kbd>`, `<sub>`, `<sup>`, `<details>` and `<br>` works. Anything unsafe (scripts, iframes, forms, event handlers, styles) is removed from the preview. See [Preview](/guide/preview#safe-html).
