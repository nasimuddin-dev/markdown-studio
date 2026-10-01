---
title: FAQ
description: Answers to common questions about Markpion, covering supported systems, price, offline use, privacy, where documents are stored, Markdown features, bug reports and uninstalling.
---

# Frequently asked questions

## What is Markpion?

A desktop Markdown editor for Windows, macOS and Linux. You edit `.md` files on your computer with a live preview, organize them in folders and tabs, and export them to PDF, Word or HTML. See [Features](/features).

## Is Markpion the same app as Markdown Studio?

Yes. Markdown Studio was renamed to Markpion in version 0.14.0. Updating keeps your settings, recent files and version history: Markpion copies them from Markdown Studio the first time it starts. On Windows, the Markpion installer also removes the old Markdown Studio installation and, from 0.15.0, creates Markpion's Start menu and desktop shortcuts in place of the old ones (pin it to the taskbar again yourself). If Markdown Studio was installed for all users and Markpion is installed only for you, Windows may keep both; uninstall Markdown Studio from **Settings → Apps**.

## Which operating systems are supported?

- **Windows** 10 (version 1803 or later) and 11, 64-bit (x64).
- **macOS** 10.15 or later, on Apple Silicon and Intel Macs.
- **Linux** x86_64 distributions from 2022 or later, as an AppImage, `.deb` or `.rpm`.

ARM64 builds for Windows and Linux aren't available yet. See [Installation](/getting-started/installation).

## Is Markpion free?

Yes. Markpion is free to download and use, and there's no paid edition. The source code is public on [GitHub](https://github.com/nasimuddin-dev/markpion); a license for reusing the code hasn't been published yet.

Markpion is built with open-source software and fonts made by others. **Help → Third-Party Notices** lists them with their licenses; the same list ([THIRD_PARTY_NOTICES.md](https://github.com/nasimuddin-dev/markpion/blob/main/THIRD_PARTY_NOTICES.md)) is installed beside the app.

## Does it work offline?

Yes. Everything works without an internet connection. The only connections are the optional update check, downloading an update if you choose to, and web images or links in your documents. See [Privacy](/privacy#network-access).

## Where are my documents stored?

Wherever you save them. Markpion edits files in place in your folders; there's no internal library or database. Its own settings, file history and recovery data are kept in your user profile (see [Configuration](/reference/configuration)).

## Does Markpion upload my documents?

No. There's no cloud service, account or telemetry. Import and export run on your computer. The only exception is the optional [AI assistant](/guide/ai-assistant): when you turn it on and run an AI command, the selected text is sent to Anthropic's Claude API under your own key, unless you choose a local model with Ollama, which keeps it on your computer. See [Privacy](/privacy).

## Does it support GitHub Flavored Markdown?

Yes: tables, task lists, strikethrough, autolinks, fenced code with highlighting, footnotes and alerts, with GitHub-compatible heading anchors. See [GitHub Flavored Markdown](/markdown/gfm) for details and small differences.

## Does it support Mermaid?

Yes. Code blocks marked `mermaid` are drawn as diagrams in the preview and in every export (HTML, PDF, Word and Print). See [Mermaid](/markdown/mermaid).

## Does it support LaTeX?

Yes, LaTeX **math**: `$…$` inline and `$$…$$` for display, rendered with KaTeX. Word export turns formulas into native Word equations. Full LaTeX documents aren't supported. See [Math / LaTeX](/markdown/math).

## Can I export to PDF or Word?

Yes: **Export as PDF**, **Export as Word (.docx)**, **Export as HTML** and **Print / Save as PDF**, for one document or a whole folder. See [Import & export](/guide/import-export#export), including which features each format keeps.

## Does it update itself?

On Windows, yes: it offers new versions at startup and installs them after checking their signature. On macOS and Linux, it tells you about new versions and opens the download page. See [Updates](/getting-started/installation#updating).

## Why does Windows or macOS warn me when installing?

The installers aren't code-signed with a commercial certificate yet (Windows) or notarized by Apple (macOS). The installation guides show how to continue: [Windows](/installation/windows#install), [macOS](/installation/macos#first-launch).

## How do I report a bug?

Choose **Help → Report a Problem…**, or **Report…** on an error message. Markpion fills in your version, your system and the error, and opens the report as a new issue on GitHub in your browser (with a free GitHub account) or, with **Send by Email**, as an email to nasim.uddinbd02@gmail.com in your mail app. You review it there and send it; nothing is sent without you. You can also open an issue on [GitHub](https://github.com/nasimuddin-dev/markpion/issues/new) yourself. Include your version (**Help → About Markpion**), your operating system, the steps to reproduce, and if relevant the log from **Help → Export Diagnostic Logs…** (it never contains your text). See [Troubleshooting](/troubleshooting/#report-an-issue).

## How do I request a feature?

Choose **Help → Send Feedback…**: pick a suggestion, or an opinion on the design or workflow, describe what you'd like and why, and open it on GitHub or send it by email (or copy the text to send another way). Check the [roadmap](/roadmap) first; it may already be planned.

## How do I uninstall Markpion?

- **Windows:** Settings → Apps → Installed apps → Markpion → Uninstall.
- **macOS:** drag Markpion from Applications to the Trash.
- **Linux:** `sudo apt remove markpion` or `sudo dnf remove markpion`, or delete the AppImage.

Your documents are never removed. To remove settings and history too, see [Configuration](/reference/configuration#reset-markpion).
