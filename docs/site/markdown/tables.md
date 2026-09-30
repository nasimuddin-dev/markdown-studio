---
title: Tables
description: Create and edit Markdown tables in Markpion. Syntax, column alignment, Insert Table, Format Table, Sort Table by Column, pasting from spreadsheets, and CSV import and export.
---

# Tables

## Syntax

A table has a header row, a delimiter row of dashes, and body rows. Cells are separated by `|`:

```markdown
| Name  | Qty | Note  |
| ----- | --- | ----- |
| Apple | 10  | fresh |
| Kiwi  | 2   |       |
```

The outer pipes are optional, and the columns don't have to line up; **Format Table** lines them up for you.

## Alignment

Colons in the delimiter row align a column:

```markdown
| Left | Centre | Right |
| :--- | :----: | ----: |
| a    |   b    |     c |
```

## Table tools

| Command | Shortcut | What it does |
| --- | --- | --- |
| Insert Table | | Inserts a two-column table to fill in. The toolbar's Table button lets you choose the number of columns and rows (up to 20 each) |
| Fix Table | | Repairs a table typed with mistakes: adds or rebuilds the divider row (`\|---\|`, keeping alignment colons, also from `===` or long dashes), adds a header when the table starts with its divider, gives short rows empty cells and keeps extra cells (the header gains "Column N"), adds the missing outer pipes, escapes a pipe inside code, removes blank lines inside the table, and aligns the columns. Put the cursor in the table (or select it) and use **Format → Fix Table**, or the toolbar's **Table tools** menu. Selected comma- or tab-separated lines are converted instead |
| Convert Selection to Table | | Turns selected comma-, tab-, semicolon- or pipe-separated lines into a table; the first line becomes the header and numeric columns are right-aligned. Every line needs the same number of values (at least two) |
| Format Table | Ctrl+Alt+T | Pads every column to the same width and normalizes the delimiter row. Wide characters (Chinese, Japanese, Korean, emoji) count as two columns, so tables stay aligned |
| Next / previous cell | Tab / Shift+Tab | In a table, formats it and selects the next or previous cell's text, so you can type over it. Tab in the last cell adds a row. Outside tables, Tab indents as usual |
| Table: Insert Row Above / Below | | Adds an empty row next to the cursor's row (below the header when the cursor is in the header) and moves the cursor into it |
| Table: Insert Column Left / Right | | Adds an empty column next to the cursor's column; the other columns keep their alignment |
| Table: Delete Row / Delete Column | | Removes the cursor's body row or column. The header row, and a table's last column, can't be deleted |
| Sort Table by Column (A to Z / Z to A) | | Sorts the body rows by the column the cursor is in, then formats the table |
| Copy Table as CSV | | Copies the table at the cursor as CSV for a spreadsheet |

All of them are in the **Format** menu and the command palette, and can be undone.

### How sorting works

- If every filled cell in the column is a number (for example `1,200`, `3.5%` or `$9`), rows are sorted numerically, so 90 comes before 1,200.
- Otherwise they're sorted as text, ignoring case, with numbers inside text in natural order (`item9` before `item10`).
- Rows with an empty cell in that column always go last, and rows with equal values keep their order.

## Tables from spreadsheets and CSV

- **Paste** cells copied from Excel or Google Sheets into the editor; they become a Markdown table.
- **File → Import CSV as Table…** converts a `.csv` or `.tsv` file into a table.

## Editing tips

- Use **Alt+drag** to select a rectangular block, for example one column, and edit it with multiple cursors.
- To put a `|` inside a cell, escape it: `\|`.
- Cells hold inline content only: text, emphasis, code, links and images, but not lists or paragraphs. Use `<br>` for a line break inside a cell.

## Preview

Tables render with borders and a header row, and wide tables scroll horizontally in the preview. They're exported as real tables to PDF, Word and HTML.
