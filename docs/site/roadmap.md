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
- **Productivity:** outline, command palette, Find in Files, formatting toolbar, tables, templates, table of contents, Markdown lint and link checking, presenting as slides.
- **Git (read-only):** changed files in the Explorer, the branch in the status bar, change bars in the editor with revert, and the last commit in File History.
- **Conversion:** import from Word, PDF, HTML and CSV; export to PDF, Word and HTML, including whole folders.
- **AI assistant (optional):** Claude improves, fixes, shortens, summarizes, translates or continues text, with your own API key and a review before any change.
- **Distribution:** separate installers for Windows, macOS and Linux on every release, and signed automatic updates on Windows.

See the [changelog](/changelog) for details per version.

## In progress

Nothing is actively under development right now. The next items are chosen from the Planned list.

## Planned

- **All math in PDF export:** every inline formula. Display formulas are drawn on every system; inline formulas with symbols the built-in font lacks still keep their LaTeX. HTML export and Print → Save as PDF render all formulas.
- **Performance:** a smaller startup bundle, and keeping very large documents (several MB) responsive while every section is open in the preview. (Long documents now appear section by section; see the [changelog](/changelog).)
- **End-to-end tests of the native app** on macOS and Linux (Windows has a first set, run with `npm run test:native`), and testing the macOS and Linux builds on real hardware.

## Considering

These depend on decisions or resources that aren't settled yet:

- **Code signing:** Windows Authenticode and Apple notarization, so the first launch doesn't show warnings. This needs signing certificates.
- **Automatic updates on macOS and Linux**, like on Windows.
- **Future enhancements from the specification:** Git integration, plugins, cloud sync, collaboration and publishing workflows.
