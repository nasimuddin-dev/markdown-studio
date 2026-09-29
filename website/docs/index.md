---
layout: home
title: Markpion
titleTemplate: Cross-Platform Markdown Editor
description: Markpion is a free, local-first desktop Markdown editor for Windows, macOS and Linux with live preview, tabs, a file explorer, Mermaid diagrams, math, and PDF and Word export.

hero:
  name: Markpion
  text: A desktop Markdown editor for Windows, macOS and Linux
  tagline: Write, edit, preview and organize Markdown documents in one fast, local-first workspace. Your files stay on your computer.
  image:
    src: /logo.svg
    alt: Markpion logo
  actions:
    - theme: brand
      text: Download Markpion
      link: /download
    - theme: alt
      text: View on GitHub
      link: https://github.com/nasimuddin-dev/markpion
    - theme: alt
      text: Read the docs
      link: /getting-started/

features:
  - title: Editor and live preview
    details: A CodeMirror 6 editor with Markdown highlighting side by side with a GitHub-style preview. Scrolling stays in sync, and you can switch to editor-only or preview-only.
    link: /guide/editor
    linkText: Editor guide
  - title: Folders, tabs and search
    details: Open a folder as a workspace, work in tabs, find in files across the folder, and jump around with the outline and command palette.
    link: /guide/file-explorer
    linkText: File explorer
  - title: GitHub Flavored Markdown and more
    details: Tables, task lists, strikethrough, autolinks and highlighted code, plus Mermaid diagrams, LaTeX math, footnotes, alerts and front matter.
    link: /markdown/gfm
    linkText: Supported Markdown
  - title: Import and export
    details: Import Word, PDF, HTML and CSV files as Markdown. Export to PDF, Word and standalone HTML, one document or a whole folder at a time.
    link: /guide/import-export
    linkText: Import & export
  - title: Safe with your work
    details: Atomic saves, conflict detection when files change on disk, local file history with restore, and crash recovery for unsaved documents.
    link: /guide/saving-and-recovery
    linkText: Saving & recovery
  - title: Local-first and private
    details: No account and no telemetry. The app's only own network request is an optional update check to GitHub, and updates are signature-verified.
    link: /privacy
    linkText: Privacy
---

<script setup>
import { data as release } from "./data/release.data";
</script>

## See it in action

<figure class="ms-screenshot">
  <img src="./images/markpion-editor.webp" alt="Markpion with the file explorer and outline on the left, a Markdown file in the editor in the middle, and its rendered preview with a table and task list on the right" width="1440" height="900">
  <figcaption>The editor, file explorer, outline and live preview in split view.</figcaption>
</figure>

## Runs on your operating system

Markpion is a native desktop app built with [Tauri](https://tauri.app). Every release has a separate installer for each system, and nothing else needs to be installed:

| System | Installers |
| --- | --- |
| **Windows** 10 (1803+) and 11, x64 | Standard installer, or an offline installer that includes WebView2 |
| **macOS** 10.15+ | `.dmg` for Apple Silicon and for Intel |
| **Linux** x86_64 | AppImage, `.deb` and `.rpm` |

[Download Markpion](/download) · [Installation guides](/getting-started/installation)

## Local-first by design

- **Your documents stay on your computer.** Markpion edits files in place on your disk. There's no account, no cloud sync and no telemetry.
- **No internet needed to write.** Everything works offline. The app's only own network request is the update check to GitHub at startup, which you can turn off in Settings. Images with web (`https://`) addresses in your documents are loaded from the web when you preview them, as in a browser.
- **Safe rendering.** HTML inside Markdown is sanitized with GitHub's allow-list: scripts, event handlers, iframes and forms are removed, and links open in your browser.
- **Limited access.** The app can only reach files and folders you open yourself.

Read the full [privacy notes](/privacy).

## Latest release

**Markpion {{ release.version }}**<span v-if="release.date">, released {{ release.date }}</span>. See [what's new](/changelog) or <a :href="release.releaseUrl">all release files on GitHub</a>.

## Developed in public on GitHub

Markpion's source code, issues and releases are public at [github.com/nasimuddin-dev/markpion](https://github.com/nasimuddin-dev/markpion). [Report a bug or request a feature](https://github.com/nasimuddin-dev/markpion/issues), browse [releases](https://github.com/nasimuddin-dev/markpion/releases), or read the source.
