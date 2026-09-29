---
title: Changelog
description: Release notes for every Markpion version, listing what was added, changed, fixed and secured in each release, with links to the downloads on GitHub.
---

# Changelog

Every release of Markpion, newest first. Dates are the GitHub release dates (UTC). Installers for each version are on the [GitHub releases page](https://github.com/nasimuddin-dev/markpion/releases).

## v0.14.0

Released: 2026-09-29 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.14.0)

### Added

- **Replace in Files:** replace a search term across every file in the open folder.
- **Go to File** (Ctrl/Cmd+Alt+O): open a file in the folder by typing part of its name.
- **Duplicate** a file from the Explorer's context menu.
- **Copy as Formatted Text** (File menu): copies the rendered document, with formatting, tables, links and images, for pasting into Word, an email or Google Docs.
- **Math in Word export:** LaTeX formulas become native Word equations (a common subset; matrices and environments stay as LaTeX).
- **Math in PDF export:** display formulas are drawn as pictures where the web engine allows it (Windows).

### Changed

- **Markdown Studio is now Markpion**, with a new logo. The installers, the app's folder and the GitHub repository (github.com/nasimuddin-dev/markpion) use the new name, and the website moved to nasimuddin-dev.github.io/markpion. Updating keeps your settings, recent files and version history, and on Windows the installer removes the old Markdown Studio installation.

### Fixed

- Tabs with long file names show their icon, name and close button on one row again, and saved tabs are no longer shown in italics.

## v0.13.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.13.0)

### Added

- **Drag headings in the Outline** to reorder sections. A line shows where the section will go, and Ctrl+Z undoes the move.

### Changed

- The project moved to the renamed GitHub account **nasimuddin-dev**. The update check, the release links and the website (then at nasimuddin-dev.github.io/markdown-studio) use the new address. Earlier versions still find updates through GitHub's redirect; updating to this version removes that dependency.

## v0.12.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.12.0)

### Added

- **Footnotes in PDF and Word exports.** PDF gets superscript numbers linked to a Footnotes section; Word gets real Word footnotes at the bottom of each page.
- **Mermaid diagrams in PDF and Word exports**, drawn as sharp pictures instead of code.
- **Outline actions:** right-click a heading to copy a link to it (`#anchor` or a Markdown link) or move its section; **Alt+↑ / Alt+↓** moves the focused heading's section.
- **View → Fold All / Unfold All.**
- **This website:** documentation, installation guides, troubleshooting, changelog and roadmap at nasimuddin-dev.github.io/markpion.

## v0.11.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.11.0)

### Added

- **macOS and Linux installers** on every release: `.dmg` for Apple Silicon and Intel, and AppImage, `.deb` and `.rpm` for Linux x86_64, alongside the Windows installers.
- **Check / Uncheck Task** (Ctrl/Cmd+Enter) toggles the tasks on the selected lines.
- **Insert Footnote** (Ctrl/Cmd+Alt+R) adds the next numbered footnote and its definition.
- **Export Folder as One PDF / One Word Document** combines a folder and exports it in one step.
- **Sort Table by Column** (A to Z, Z to A), numeric or natural text order.
- **Reopen Closed Tab** (Ctrl/Cmd+Shift+T).
- **Move Section Up / Down** moves a heading with its text and subsections.

### Changed

- On macOS and Linux, the update check offers the download page when a new version is available. In-place updates remain Windows-only.

## v0.10.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.10.0)

### Added

- **Promote / Demote Heading** (Ctrl/Cmd+Alt+= and Ctrl/Cmd+Alt+-).
- **Clickable task checkboxes** in the preview: clicking one checks or unchecks the task in the source, and can be undone.

## v0.9.0

Released: 2026-09-25 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.9.0)

The first release delivered through the in-app updater.

### Added

- **YAML front matter** is shown as a metadata table in the preview, left out of exports, and its `title` names exported documents.
- **GitHub alerts** (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) render as callouts.
- **New from Template** with seven built-in templates, templates from the workspace's `templates/` folder, and date, week and cursor placeholders.
- **Paste a URL over selected text** to make a link.

## v0.8.0

Released: 2026-09-25 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.8.0)

### Added

- **Automatic updates on Windows.** At startup, Markpion offers new versions with **Update Now**, **Later** or **Skip This Version**. It saves open documents, downloads the update, installs it in place and restarts. The startup check can be turned off in Settings.

### Security

- Updates are signed, and the signature is verified against a public key built into the app before anything is installed. A tampered or unsigned update is refused, and the current version keeps running.

## v0.7.0

Released: 2026-09-25 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.7.0)

### Added

- **Combine Folder into One Document**: merges every Markdown file in a folder into one document with a table of contents, turning links between files into in-document links and adjusting image paths.

## v0.6.0

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.6.0)

### Added

- **Check for Updates** (Help menu) and an optional daily check against GitHub Releases, with Download, Later and Skip This Version.
- **Link check** for the whole folder (sidebar → Links): missing files and images, broken `#anchors` within and across files, and empty links.

### Security

- The Content Security Policy allows network requests only to `api.github.com`, for the update check.

## v0.5.0

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.5.0)

### Added

- **Insert / Update Table of Contents**, optionally kept up to date on save.
- **CSV/TSV tools:** import a CSV or TSV file as a table, paste spreadsheet cells as a table, and Copy Table as CSV.
- **Convert Folder to Markdown:** converts every Word, PDF, HTML and CSV/TSV file in a folder.

## v0.4.0

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.4.0)

### Added

- **Import** Word (`.docx`), PDF and web pages (`.html`) as Markdown, with images saved to `assets/`.
- **Paste rich text** from browsers and Word as Markdown.
- **Export** to Word (`.docx`) and PDF.

### Changed

- Imported lists use compact list markers, and image descriptions from Word are kept as alt text.

## v0.3.1

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.3.1)

The first public release, with a Windows installer (standard, and offline with WebView2 included).

### Added

- A CodeMirror 6 editor with Markdown highlighting and a live GitHub Flavored Markdown preview, with editor-only, split and preview-only views.
- Workspaces with a file explorer, tabs, find and replace, Find in Files, a document outline, a command palette and recent files.
- The Format menu and formatting shortcuts, Format Table and link autocompletion.
- Mermaid diagrams and LaTeX math.
- Export to HTML, Copy as HTML, and Print / Save as PDF.
- Opening files from the operating system: file association, "Open with", single instance, and drag and drop.
- Pasting and dropping images into an `assets/` folder.
- Auto save, save options (trim whitespace, final newline, line endings) and a large-document mode.
- Markdown lint with a Problems panel.
- Local file history with diff and restore, crash recovery, and session restore.
- Live folder watching and detection of files changed on disk.
- Focus Mode, Full Screen, a Keyboard Shortcuts reference, document statistics and spell checking.
- Light, dark and system themes, and editor settings.

### Security

- The interface has no direct file system, dialog or shell access; every file operation goes through checked native commands limited to the files and folders you open.
- Preview HTML is sanitized with GitHub's allow-list, and a strict Content Security Policy blocks scripts.
- Links open in the system browser, and only `http`, `https` and `mailto` links are allowed.

### Accessibility

- Keyboard access to every function and visible focus, audited automatically against WCAG 2.1 AA in light and dark themes.
