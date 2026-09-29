---
title: Import & Export
description: Import Word, PDF, HTML and CSV/TSV files as Markdown, and export Markdown to PDF, Word (.docx) and standalone HTML in Markpion, one document or a whole folder at a time.
---

# Import & export

All conversion happens on your computer; nothing is uploaded. Files to import can be up to 100 MB.

## Import

Import commands are in the **File** menu. Each one converts a file into a new Markdown document that opens in a tab, ready to review and save.

### Word (.docx)

**File → Import Word Document (.docx)…**

- **Supported:** headings, paragraphs, bold and italic, bulleted and numbered lists, tables, links and images. Images are saved to an `assets/` folder and linked, with the image descriptions from Word as alt text.
- **Limitations:** page layout, fonts and colours are not carried over; the result is plain Markdown structure. Only the `.docx` format is supported, not the older `.doc`.

### PDF

**File → Import PDF (.pdf)…**

PDFs store positioned text rather than structure, so Markpion reconstructs the document:

- **Supported:** paragraphs (lines are joined, and hyphenated line breaks are mended), headings (text larger than the body text), and bulleted or numbered items. Repeated headers, footers and page numbers are dropped.
- **Limitations:** tables and multi-column layouts may come out as plain paragraphs, and images aren't extracted. **Scanned PDFs** contain only images of text; they can't be imported, because text recognition (OCR) isn't supported, and Markpion tells you so.

### Web page (.html)

**File → Import Web Page (.html)…** converts a saved HTML page to GitHub Flavored Markdown. Headings, lists, links, images, code and tables are kept. Scripts, styles and other non-content elements are dropped.

### CSV and TSV

**File → Import CSV as Table…** turns a `.csv` or `.tsv` file into an aligned Markdown table. The reverse, **Copy Table as CSV**, copies the table at the cursor for pasting into a spreadsheet. Cells copied from Excel or Google Sheets can be pasted straight into the editor as a table.

### Paste as Markdown

Content copied from a web page or Word is converted to Markdown when you paste it. On Windows, **Ctrl+Shift+V** pastes plain text instead. On any system you can turn the conversion off in [Settings](/guide/settings).

### A whole folder

**File → Convert Folder to Markdown…** converts every Word, PDF, HTML and CSV/TSV file in the open folder (including subfolders) to a `.md` file beside it. Files that already have a Markdown version are skipped, and the originals are not changed.

## Export

Export commands are in the **File** menu. You choose where to save the file.

| Format | Command | What you get |
| --- | --- | --- |
| PDF | Export as PDF… | Selectable text, clickable links, heading bookmarks, tables, task checkboxes, images, and footnotes in a section at the end |
| Word | Export as Word (.docx)… | Real Word headings (so Word's navigation pane and table of contents work), numbered, bulleted and task lists, tables, code, links, embedded images and real Word footnotes |
| HTML | Export as HTML… | One standalone, styled `.html` file with images embedded, sanitized like the preview |
| Clipboard | Copy as Formatted Text | The rendered document as formatted text (headings, lists, tables, links, images), for pasting into Word, Outlook, Gmail or Google Docs. Plain-text editors receive the Markdown |
| Clipboard | Copy as HTML | The HTML source, for pasting into a CMS or an HTML file |
| Printer or PDF | Print / Save as PDF… (Ctrl+P) | The preview, printed with your system's print dialog |

The document's front matter isn't exported; its `title`, if any, becomes the exported document's title.

### Mermaid, math, footnotes and special characters

| | HTML export | Print / Save as PDF | PDF export | Word export |
| --- | --- | --- | --- | --- |
| Mermaid diagrams | Rendered | Rendered | Drawn as a picture | Drawn as a picture |
| LaTeX math | Rendered | Rendered | Display formulas as pictures on Windows; inline as LaTeX text | Word equations (see [Math](/markdown/math#export)) |
| Footnotes | Linked section at the end | Linked section at the end | Section at the end | Word footnotes |
| Chinese, Japanese, Korean, Arabic, emoji | Yes | Yes | Not in the built-in font | Yes |

**Export as PDF** uses a built-in font. If the document contains characters it can't display, Markpion warns you and offers **Print → Save as PDF**, which uses your system fonts, instead. For documents with formulas, use **Print / Save as PDF** or **Export as HTML**. A diagram with a syntax error is exported as its code.

### A whole folder as one document

- **File → Export Folder as One PDF…** and **Export Folder as One Word Document…** combine every Markdown file in the open folder into one document and export it in one step.
- **File → Combine Folder into One Document…** writes the combined Markdown to `<Folder> (combined).md` and opens it, so you can review or edit it before exporting.

Either way, files are combined in folder order (a `README` or `index` first, then natural order, folder by folder), with a table of contents. Headings move down a level under the folder's title, links between the files become links within the document, and image paths are adjusted. Unsaved changes in open tabs are included.
