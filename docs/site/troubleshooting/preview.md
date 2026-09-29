---
title: Preview, Mermaid & Math Problems
description: Fix Markpion preview problems, including a paused preview, images that don't show, Mermaid diagram errors, math that doesn't render, and dollar signs read as math.
---

# Preview, Mermaid & math

## The preview says "Live preview is paused"

**Problem:** the preview shows *"Live preview is paused for large documents"* with a **Render Now** button.

**Possible cause:** the document is larger than 1 MB of text. Re-rendering on every keystroke would slow down typing.

**Solution:** click **Render Now** to render it, and **Refresh Preview** after editing. Splitting very large documents also helps.

## An image doesn't show

**Symptoms:** the preview shows a placeholder: *"(image not found)"* or *"(save the document to show local images)"*.

**Possible causes and solutions:**

- **The document hasn't been saved yet.** Relative image paths need a location. Save the document.
- **The path is wrong.** Paths are relative to the document, and letter case matters on macOS and Linux. The [link check](/guide/checking-documents#link-check) lists missing images.
- **The image is outside the allowed locations.** Local images load only from the open workspace folder or, for a single file, its folder and subfolders. Open the parent folder as your workspace. See [Images](/markdown/images).
- **The image uses `http://`.** Only `https://` web images are loaded.
- **The image is larger than 20 MB.**

## A Mermaid diagram shows "Diagram error"

**Problem:** instead of a diagram, the preview shows **Diagram error:** and a message from Mermaid.

**Possible cause:** a syntax error in the diagram code.

**Solution:** check the first line (diagram type), quote labels that contain special characters (`A["Save (Ctrl+S)"]`), and check the arrow syntax. The [Mermaid page](/markdown/mermaid#troubleshooting) has examples, and the [Mermaid Live Editor](https://mermaid.live) shows detailed errors.

## A diagram or formula appears as code

**Possible cause:** rendering is turned off, or the code block isn't marked correctly.

**Solution:**

- Check **Settings → Preview → Render Mermaid diagrams** and **Render LaTeX math**.
- The code block must start with exactly ` ```mermaid `.
- In **PDF** exports, common inline formulas are set as text (ones with arrows, set symbols or nested scripts stay LaTeX), and display formulas are pictures only on Windows (Word exports turn formulas into Word equations). Use **Print / Save as PDF** for a PDF with every formula rendered.

## Text with dollar signs turns into math

**Problem:** "costs $5 or $10" shows part of the sentence as a formula.

**Solution:** escape the dollar signs: `\$5 or \$10`.

## A formula is shown in red

**Possible cause:** KaTeX couldn't parse the formula, so it shows the source in red instead of breaking the preview.

**Solution:** check the LaTeX syntax against [KaTeX's supported functions](https://katex.org/docs/supported). Text-mode commands and packages aren't available.

## A link in the preview doesn't open

**Possible cause:** for safety, the preview opens only `http`, `https` and `mailto` links (in your browser), `#heading` links, and links to Markdown files. Other link types are blocked, and a message says so.

## "The preview couldn't be shown because of an unexpected error"

**Cause:** something in the document triggered a bug while drawing the preview. Only the preview stops; the editor, tabs and saving keep working, and nothing in your document is lost.

**Solution:** keep editing. The preview tries again as soon as the text changes, or choose **Try Again**. If it keeps happening with the same text, please [report an issue](https://github.com/nasimuddin-dev/markpion/issues) with the part of the document that causes it and the diagnostic log (**Help → Export Diagnostic Logs…**), which records the error.

## Report an issue

If a document renders differently from GitHub, [report it on GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) with a small Markdown sample.
