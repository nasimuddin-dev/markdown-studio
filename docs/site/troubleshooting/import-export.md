---
title: Import & Export Problems
description: Fix Markpion import and export problems, including scanned PDFs, lost layout, PDF characters the built-in font can't show, and formulas or diagrams shown as code in PDF and Word.
---

# Import & export

## A PDF import is empty

**Problem:** importing a PDF gives an empty document and a message that the PDF has no selectable text.

**Possible cause:** the PDF is a scan, made of images of pages rather than text. Text recognition (OCR) isn't supported.

**Solution:** run the PDF through an OCR tool first, so it has selectable text (you can check by trying to select text in a PDF viewer), then import it again.

## Imported text has the wrong structure

**Problem:** headings, lists or tables from a PDF come out as plain paragraphs.

**Possible cause:** PDFs store positioned text, not structure. Markpion infers headings from font size and lists from bullets or numbers, which doesn't always match the original.

**Solution:** fix the structure in the editor, for example with **Ctrl+Alt+1**–**6** for headings and **Ctrl+Shift+8** for lists. If you have the original Word file, import that instead: `.docx` keeps headings, lists and tables reliably.

## "Some characters need a different PDF method"

**Problem:** exporting to PDF warns that the document contains characters the built-in PDF font can't display.

**Possible cause:** **Export as PDF** uses a built-in font covering Latin, Greek and Cyrillic scripts. Chinese, Japanese, Korean, Arabic, emoji and some symbols aren't in it.

**Solution:** choose **Use Print → Save as PDF**, which uses your system fonts, or export as Word or HTML.

## Formulas appear as LaTeX text in PDF or Word

**Problem:** a PDF export shows formulas as their LaTeX source, or a Word export shows some formulas as LaTeX.

**Possible causes:**

- **Export as PDF** draws display formulas (`$$…$$`) as vector drawings on every system; inline formulas (`$…$`) are set as text, including arrows and set symbols, except ones with nested scripts, matrices or overlaid symbols such as `\notin`, which stay LaTeX text.
- In **Export as Word**, formulas become Word equations, except those using something outside the supported subset, such as a matrix (`\begin{pmatrix}`), an `aligned` environment or a line break (`\\`). Those keep their LaTeX so nothing is converted wrongly. See [Math](/markdown/math#export).
- **Settings → Preview → Render LaTeX math** is off, so `$` signs are treated as text.

**Solution:** for a PDF, use **File → Print / Save as PDF…**, which renders formulas exactly as in the preview. For Word, simplify the formula, or use **Export as HTML**.

## A diagram appears as code in PDF or Word

**Possible causes:**

- The diagram has a syntax error. The preview shows **Diagram error:** too; fix the diagram (see [Mermaid](/markdown/mermaid#troubleshooting)).
- **Settings → Preview → Render Mermaid diagrams** is off, so all exports keep the code.
- The version is older than 0.12.0, which exported diagrams as code. Update Markpion.

## "Files larger than 100 MB can't be imported"

**Solution:** split the source document, or reduce its size (for example, by compressing images in Word), then import it again.

## Export Folder says the folder has one file or none

**Problem:** **Combine Folder** or **Export Folder** reports *"This folder has only one Markdown file"* or *"No Markdown files found in this folder"*.

**Solution:** these commands need at least two Markdown files in the open folder. For a single file, use **Export as PDF** or **Export as Word**.

## Report an issue

If a document converts badly and you can share it (or a similar one), [report it on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new). Samples help us improve the converters.
