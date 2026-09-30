---
title: Images
description: Add images to Markdown in Markpion with local files, relative paths, pasting and drag and drop into an assets folder, plus alt text, preview and export behaviour.
---

# Images

## Syntax

```markdown
![Alt text describing the image](assets/diagram.png)
![Logo](https://example.com/logo.svg "Optional title")
```

The alt text is what screen readers read and what shows if the image can't load. The [Markdown lint](/guide/checking-documents) warns about images without it.

## Paste or drop images

The easiest way to add an image is to **paste** it (for example a screenshot) or **drag an image file** onto the editor:

1. Markpion saves the image in an `assets` folder next to the document, creating the folder if needed.
2. It inserts a link with a relative path at the cursor. A pasted screenshot gets a timestamped name, for example `![image 20260925 140512](assets/image-20260925-140512.png)`; a dropped file keeps its name. Replace the alt text with a short description.

The document must be saved first, so Markpion knows where to put the `assets` folder. To use another folder name, such as `images` or `media`, set **Settings → Files → Folder for pasted images** (one folder name, next to the document). Imported Word, PDF and HTML documents put their pictures there too. Supported formats are PNG, JPEG, GIF, WebP, SVG, BMP and AVIF, up to 20 MB per image.

## Insert Image…

**Format → Insert Image…** (also in the command palette) asks for an image file and inserts a link at the cursor:

- An image that is already in the document's folder, or a folder inside it, is linked where it is, for example `![logo](images/logo.png)`.
- An image from anywhere else is copied into the `assets` folder next to the document first, like a dropped file.

In the browser demo, the image is always copied into `assets`.

## Local images and paths

| Path | Example | Supported |
| --- | --- | --- |
| Relative to the document | `assets/photo.png`, `../images/logo.svg` | Yes (recommended), within the allowed locations below |
| Absolute file path | `C:/Users/me/Pictures/photo.png`, `/home/me/photo.png` | Within the allowed locations below |
| Web address | `https://example.com/image.png` | Yes, `https` only (loaded from the web when previewed; plain `http` is blocked) |
| Data URL | `data:image/png;base64,…` | Yes |

Relative paths are best: they keep working when you move the folder, share it, or push it to GitHub.

For privacy, local images load only from **the folder you opened as your workspace**, or, for a file opened on its own, **that file's folder and its subfolders** (see [Privacy](/privacy)). If an image lives elsewhere, for example `../images/` next to a single opened file, open the parent folder as your workspace.

## Preview

- Local images show in the preview once the document is saved.
- A missing image appears as a placeholder with its name and "(image not found)", and the [link check](/guide/checking-documents#link-check) lists it.
- Images larger than 20 MB aren't previewed.

## Export

- **HTML export** embeds the images in the file, so it works on its own.
- **PDF** and **Word** exports embed the images too.
- **Combine Folder** and **Export Folder** adjust image paths so they still work in the combined document.

## Autocompletion

Type `![](` to get a list of the images in your workspace.
