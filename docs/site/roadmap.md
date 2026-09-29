---
title: Roadmap
description: What's done, what's planned and what's being considered for Markpion, based on the project's requirements specification and development log. No delivery dates are promised.
---

# Roadmap

This roadmap comes from the project's [requirements specification](https://github.com/nasimuddin-dev/markpion/blob/main/docs/SRS.md) and [development log](https://github.com/nasimuddin-dev/markpion/blob/main/docs/DEV_LOG.md). It shows direction, not commitments: there are no dates, and plans can change. Suggestions are welcome in [GitHub issues](https://github.com/nasimuddin-dev/markpion/issues).

## Completed

- **Core editor (MVP):** create, open, edit, preview and save Markdown; workspaces and file explorer; tabs; find and replace; themes; settings; keyboard shortcuts; native dialogs.
- **Reliability:** safe atomic saves, external-change detection, crash recovery, recent files and local file history.
- **Rich Markdown:** GitHub Flavored Markdown, Mermaid diagrams, LaTeX math, front matter, alerts and footnotes.
- **Productivity:** outline, command palette, Find in Files, formatting tools, tables, templates, table of contents, Markdown lint and link checking.
- **Conversion:** import from Word, PDF, HTML and CSV; export to PDF, Word and HTML, including whole folders.
- **AI assistant (optional):** Claude improves, fixes, shortens, summarizes, translates or continues text, with your own API key and a review before any change.
- **Distribution:** separate installers for Windows, macOS and Linux on every release, and signed automatic updates on Windows.

See the [changelog](/changelog) for details per version.

## In progress

Nothing is actively under development right now. The next items are chosen from the Planned list.

## Planned

- **All math in PDF export:** every inline formula, and display formulas on macOS and Linux. Today PDF export draws display formulas on Windows and sets common inline formulas as text; HTML export, Print → Save as PDF and Word export render all formulas.
- **Performance:** faster first display of very large documents (a pasted 800 KB document takes about 3.5 seconds to appear today, most of it parsing the Markdown) and a smaller startup bundle.
- **End-to-end tests of the native app** on Windows, macOS and Linux, and testing the macOS and Linux builds on real hardware.

## Considering

These depend on decisions or resources that aren't settled yet:

- **Code signing:** Windows Authenticode and Apple notarization, so the first launch doesn't show warnings. This needs signing certificates.
- **Automatic updates on macOS and Linux**, like on Windows.
- **ARM64 builds** for Windows and Linux.
- **Localization** of the interface into other languages.
- **A native macOS menu bar.**
- **Future enhancements from the specification:** Git integration, plugins, cloud sync, collaboration and publishing workflows.
