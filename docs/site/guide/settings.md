---
title: Settings
description: Every Markpion setting explained, covering theme, editor font and size, line numbers, wrapping, tab size, spell check, paste, lint, auto save, line endings, preview, math, diagrams and startup.
---

# Settings

Open settings with **Ctrl+,** (**Cmd+,** on macOS), the gear button at the top right, or **File → Settings…**. The list on the left jumps to a section (Appearance, Editor, Files, Preview, Export, AI Assistant, Startup), and **Search settings** above it shows only the settings that match what you type (for example "wrap" or "git"); **Esc** clears the search. Changes apply immediately and are saved automatically. Where they're stored is described in [Configuration](/reference/configuration).

## Appearance

| Setting | Options | Default |
| --- | --- | --- |
| Theme | Match system, Light, Dark | Match system |
| Editor font size | 10–28 px | 15 px |
| Editor font family | Any installed font, for example `JetBrains Mono` | The default monospace font |

The moon button at the top right switches between light and dark quickly. **Ctrl+=**, **Ctrl+-** and **Ctrl+0** increase, decrease and reset the editor font size.

## Editor

| Setting | Default |
| --- | --- |
| Line length (full width, or about 72, 80, 100 or 120 characters, centered) | Full width |
| Tab size (2, 4 or 8 spaces) | 2 |
| Dim other paragraphs | Off |
| Show line numbers | On |
| Wrap long lines | On |
| Convert pasted web/Word content to Markdown | On |
| Check spelling (uses the system dictionary) | On |
| Check Markdown for problems (broken links, headings, alt text) | On |

## Files

| Setting | Options | Default |
| --- | --- | --- |
| Auto save | Off, After a delay, When switching tabs or windows | Off |
| Auto save delay | 0.5, 1, 3, 10 or 30 seconds | 1 second |
| Line endings for new files | LF (Unix, macOS), CRLF (Windows), Match operating system | LF |
| Trim trailing whitespace on save | | Off |
| Keep the table of contents up to date on save | | On |
| Show Git branch, changed files and changed lines | | On |
| Insert a final newline on save | | Off |
| Folder for pasted images | One folder name | assets |

Existing files always keep their own line endings. Untitled documents are never auto-saved. See [Saving, history & recovery](/guide/saving-and-recovery).

## Preview

| Setting | Options | Default |
| --- | --- | --- |
| Update delay after typing | Instant, 150 ms, 300 ms, 600 ms, 1 second | 150 ms |
| Render LaTeX math (`$…$` and `$$…$$`) | | On |
| Render Mermaid diagrams | | On |
| Sync editor and preview scrolling | | On |
| Custom CSS for documents | Your own CSS | Empty |

**Custom CSS** styles your documents, for example with your organization's colours and fonts. It applies to the preview, printing, slides, **Export as HTML** and **Export Folder as HTML Site**, but not to PDF or Word export, which have their own layout. Rules only affect the document, never Markpion itself: `h1 { color: #0b4f8a; }` styles the document's headings, and `body` means the whole document. `@media`, `@font-face` and `@page` rules work; `@import` is ignored, so styles can't load other files. Managed settings can preset or lock it for everyone in an organization (see [Configuration](/reference/configuration)).

## Export

| Setting | Options | Default |
| --- | --- | --- |
| Page size for PDF and Word | Automatic, A4 (210 × 297 mm), Letter (8.5 × 11 in) | Automatic |

**Automatic** uses Letter when your system language names a region that uses Letter paper (for example English (United States), French (Canada) or Spanish (Mexico)), and A4 otherwise. Print → Save as PDF uses the paper size you choose in the print dialog.

## Startup

| Setting | Default |
| --- | --- |
| Reopen last folder and files | On |
| Check for updates when Markpion starts | On |

The update check asks GitHub for the latest version number; nothing else is sent. See [Privacy](/privacy).

## Reset to defaults

**Reset to Defaults** at the bottom of the Settings dialog restores every setting above to its default. Your open folder and files are kept.

## Export and import

**Export…** saves your settings and keyboard shortcuts to `markpion-settings.json`; **Import…** loads such a file, after asking, on this or another computer. Use it to move to a new PC or to share a setup with your team. Your open folder and files, and your answer to the AI assistant's consent question, aren't included. Settings your organization manages keep their managed values.

## Remembered automatically

Markpion also remembers the window size and position, the view (editor, split or preview), whether the explorer and outline are shown, and panel sizes.
