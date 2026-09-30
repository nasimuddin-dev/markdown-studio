---
title: "Markdown Tables: The Complete Guide"
description: How to write tables in Markdown, covering syntax, column alignment, escaping pipes, line breaks in cells, what tables can't do, and how to keep them tidy and readable in plain text.
date: 2026-09-25
---

# Markdown tables: the complete guide

*2026-09-25*

Tables aren't part of the original Markdown, but GitHub Flavored Markdown added them, and nearly every tool supports that syntax today. This guide covers everything you can do with them, and what you can't.

## The basic syntax

A table needs a **header row**, a **delimiter row**, and zero or more **body rows**. Cells are separated by pipes (`|`):

```markdown
| Plan  | Price | Users |
| ----- | ----- | ----- |
| Free  | $0    | 1     |
| Team  | $8    | 10    |
```

Three rules to remember:

1. The delimiter row needs at least one dash per column (`-`), and one cell per column.
2. The leading and trailing pipes are optional, but using them makes tables easier to read.
3. The columns don't have to line up in the source. `|a|b|` works just as well; aligning is only for people reading the plain text.

## Aligning columns

Colons in the delimiter row set each column's alignment:

```markdown
| Left     | Centre   | Right |
| :------- | :------: | ----: |
| text     | text     | 42    |
```

Right-align numbers, so the digits line up.

## Special content in cells

| You want | Write |
| --- | --- |
| A pipe character in a cell | `\|` |
| A line break inside a cell | `<br>` |
| Code, links, emphasis | Works as normal: `` `code` ``, `[link](url)`, `**bold**` |
| An empty cell | Leave it blank: `\| a \|  \| c \|` |

## What tables can't do

Markdown tables are deliberately simple. They can't have:

- merged cells (colspan or rowspan);
- lists, paragraphs or code blocks inside a cell;
- a table without a header row;
- column widths.

If you need those, consider whether the content is really a table. A list of sections often reads better, or you can use an HTML `<table>` where your tool allows HTML.

## Keeping tables tidy

Hand-aligning columns is tedious, and editing one cell breaks the alignment. Let your editor do it:

- In Markpion, **Table → Format Table** (**Ctrl+Alt+T**) pads every column to the same width, even with Chinese, Japanese or Korean text, which takes two columns per character.
- **Sort Table by Column** sorts the rows by the column under the cursor, numerically for numbers.
- Pasting cells from Excel or Google Sheets creates the Markdown table for you, and **Copy Table as CSV** goes the other way.

See [Tables](/markdown/tables) in the documentation for all the table tools.

## Wide tables

Tables with many columns get hard to read in plain text and on narrow screens. Some ideas:

- Split one wide table into two narrower ones.
- Move long explanations out of the table into footnotes or text below it.
- Abbreviate headers, and explain the abbreviations underneath.
