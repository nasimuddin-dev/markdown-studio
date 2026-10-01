---
title: Import & Export
description: Import Word, PDF, HTML, EPUB and CSV/TSV files as Markdown, and export Markdown to PDF, Word (.docx), EPUB e-books, LaTeX and standalone HTML in Markpion, one document or a whole folder at a time.
---

# Import & export

All conversion happens on your computer; nothing is uploaded. Files to import can be up to 100 MB.

## Import

Import commands are in the **File** menu. Each one converts a file into a new Markdown document that opens in a tab, ready to review and save.

### Word (.docx)

**File → Import → Word Document (.docx)…**

- **Supported:** headings, paragraphs, bold and italic, bulleted and numbered lists, tables, links and images. Images are saved to an `assets/` folder and linked, with the image descriptions from Word as alt text. Links within the document, such as Word's table of contents, become links to the Markdown headings (`#installation`), so they keep working. The same happens for links to headings when importing a web page.
- **Limitations:** page layout, fonts and colours are not carried over; the result is plain Markdown structure. Only the `.docx` format is supported, not the older `.doc`.

### PDF

**File → Import → PDF (.pdf)…**

PDFs store positioned text rather than structure, so Markpion reconstructs the document:

- **Supported:** paragraphs (lines are joined, and hyphenated line breaks are mended), headings (text larger than the body text), and bulleted or numbered lists, including the Symbol and Wingdings bullets Word uses, bullets without a space after them, and nested lists (from how far each item is indented). Repeated headers, footers and page numbers are dropped.
- **Limitations:** tables and multi-column layouts may come out as plain paragraphs, and images aren't extracted. **Scanned PDFs** contain only images of text; they can't be imported, because text recognition (OCR) isn't supported, and Markpion tells you so.

### Web page (.html)

**File → Import → Web Page (.html)…** converts a saved HTML page to GitHub Flavored Markdown. Headings, lists, links, images, code and tables are kept. Scripts, styles and other non-content elements are dropped.

### E-book (.epub)

**File → Import → E-book (.epub)…** turns an EPUB e-book into one Markdown document: the chapters in reading order, separated by horizontal rules, with the book's title, author and language as front matter. Pictures, including a cover page's, are saved to an `assets/` folder and linked, and links between chapters become links within the document. Books protected with DRM can't be read; Markpion says so instead of importing them. Fonts, page styles and the book's own table of contents page aren't carried over.

### CSV and TSV

**File → Import → CSV as Table…** turns a `.csv` or `.tsv` file into an aligned Markdown table. The reverse, **Copy Table as CSV**, copies the table at the cursor for pasting into a spreadsheet. Cells copied from Excel or Google Sheets can be pasted straight into the editor as a table.

### Paste as Markdown

Content copied from a web page or Word is converted to Markdown when you paste it. On Windows, **Ctrl+Shift+V** pastes plain text instead. On any system you can turn the conversion off in [Settings](/guide/settings).

### A whole folder

**File → Import → Convert Folder to Markdown…** converts every Word, PDF, HTML, EPUB and CSV/TSV file in the open folder (including subfolders) to a `.md` file beside it. Files that already have a Markdown version are skipped, and the originals are not changed.

## Export

Export commands are in the **File** menu. You choose where to save the file.

| Format | Command | What you get |
| --- | --- | --- |
| PDF | Export as PDF… | Selectable text, clickable links, heading bookmarks, tables, task checkboxes, images, footnotes in a section at the end, page numbers, and the document's title at the top of each page after the first |
| Word | Export as Word (.docx)… | Real Word headings (so Word's navigation pane and table of contents work), numbered, bulleted and task lists, tables, code, links (links to headings in the document, like a table of contents, jump to the heading in Word), embedded images, real Word footnotes, page numbers in the footer, and the title in the header of each page after the first |
| HTML | Export as HTML… | One standalone, styled `.html` file with images embedded, sanitized like the preview; printed from Chrome or Edge, its pages get the title and page numbers too |
| LaTeX | Export as LaTeX (.tex)… | A complete LaTeX document for pdfLaTeX, XeLaTeX or LuaLaTeX: headings as sections (links to headings become cross-references), math exactly as you wrote it, tables with `booktabs`, code as verbatim blocks, footnotes as `\footnote`, task lists with boxes, and pictures as `\includegraphics` with their paths as written, so compile it in the document's folder. The title and author come from the front matter, or a lone top-level heading becomes the title. Mermaid diagrams stay as code. For text beyond Western European languages, compile with XeLaTeX or LuaLaTeX |
| E-book | Export as EPUB (E-book)… | An EPUB 3 e-book for e-readers and apps such as Apple Books, Kobo, Calibre or Thorium: the document as one chapter, a table of contents from its headings (levels 1 to 3), its local pictures inside the book, math as MathML and Mermaid diagrams as drawings. The title, `author`, `description` and `lang` (or `language`) come from the front matter (English when there's no language), and a `cover` picture named there becomes the book's cover. Web pictures become links, since e-readers don't load them |
| Markdown and pictures | Export as Markdown with Images (.zip)… | A `.zip` with the document and the local pictures it shows, in an `images` folder, with the links changed to point there. Unzipped anywhere, the document still shows its pictures. Web images stay links, and a picture that can't be read is left out (Markpion says which) |
| Clipboard | Copy as Formatted Text | The rendered document as formatted text (headings, lists, tables, links, images), for pasting into Word, Outlook, Gmail or Google Docs. Plain-text editors receive the Markdown |
| Clipboard | Copy as Plain Text | The selection, or the whole document, as text without Markdown syntax: no `#`, `**` or link addresses, while list bullets and numbers, checkboxes (☐ ☑), line breaks and tab-separated table cells stay. For forms, chat and other places that show text as it is |
| Clipboard | Copy as HTML | The HTML source, for pasting into a CMS or an HTML file |
| Clipboard | Copy as LaTeX | The selection, or the whole document, as LaTeX text without a preamble, for pasting into a paper or an Overleaf project (the same conversion as Export as LaTeX) |
| Printer or PDF | Print / Save as PDF… (Ctrl+P) | The preview, printed with your system's print dialog. On Windows each page gets the document's title at the top and "page / pages" at the bottom (macOS and Linux print without them) |

PDF and Word exports use A4 or Letter paper: automatically from your system's region, or the size you choose in [Settings → Export](/guide/settings#export). There you can also have each top-level heading (`#`) after the first start a new page, in PDF and Word exports and when printing, which suits reports and manuals.

The document's front matter isn't exported; its `title` becomes the exported document's title, and `author`, `description` and `keywords` its document properties (see [Front matter](/markdown/extras#front-matter)).

### Mermaid, math, footnotes and special characters

| | HTML export | Print / Save as PDF | PDF export | Word export |
| --- | --- | --- | --- | --- |
| Mermaid diagrams | Rendered | Rendered | Drawn as a picture | Drawn as a picture |
| Links to headings (a table of contents) | Jump to the heading | Jump to the heading | Jump to the heading | Jump to the heading |
| LaTeX math | Rendered | Rendered | Display formulas as vector drawings; inline formulas as text | Word equations, or pictures for matrices and environments (see [Math](/markdown/math#export)) |
| Footnotes | Linked section at the end | Linked section at the end | Section at the end | Word footnotes |
| Chinese, Japanese, Korean, Arabic, emoji | Yes | Yes | Not in the built-in font | Yes |

**Export as PDF** uses a built-in font. If the document contains characters it can't display, Markpion warns you and offers **Print → Save as PDF**, which uses your system fonts, instead. Inline formulas are set as text, and display formulas are drawn as vector drawings (see [Math](/markdown/math)). For documents where every formula must be typeset, use **Print / Save as PDF** or **Export as HTML**. A diagram with a syntax error is exported as its code.

### A whole folder as one document

- **File → Export → Export Folder as One PDF…**, **Export Folder as One Word Document…**, **Export Folder as One E-book (EPUB)…** and **Export Folder as One LaTeX Document…** combine every Markdown file in the open folder into one document and export it in one step. For an e-book, each document becomes a section of the table of contents under the folder's name.
- **File → Export → Combine Folder into One Document…** writes the combined Markdown to `<Folder> (combined).md` and opens it, so you can review or edit it before exporting.

Either way, files are combined in folder order (a `README` or `index` first, then natural order, folder by folder), with a table of contents. Headings move down a level under the folder's title, links between the files become links within the document, and image paths are adjusted. Unsaved changes in open tabs are included.

### A whole folder as an HTML site

**File → Export → Export Folder as HTML Site…** turns every Markdown file in the open folder into its own HTML page, for a shared drive, an intranet or a static web server:

- Choose an empty folder, or a new one, to export into. The folder structure is mirrored (`guide/setup.md` becomes `guide/setup.html`).
- Links between your documents point to their HTML pages, headings keep their anchors, and images are embedded in the pages, so the site needs no other files.
- Every page has a **← Contents** link to `index.html`, which lists all pages by folder with their titles. If the folder has its own `index.md`, that page is the start page instead.
- If some of the HTML files already exist, Markpion asks before replacing them. Unsaved changes in open tabs are included.

Open `index.html` in any browser to read the site.
