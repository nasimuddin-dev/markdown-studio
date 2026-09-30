---
title: Privacy
description: How Markpion handles your documents and data. Everything is local, with no account and no telemetry, an optional update check to GitHub, and limited file access.
---

# Privacy

Markpion is a local-first app. This page describes what it actually does with your data.

## Your documents stay on your computer

- Markpion reads and writes the files you open, where they are on your disk. It doesn't upload, sync or copy them anywhere.
- There's **no account**, **no sign-in**, and **no cloud service**.
- The optional [AI assistant](/guide/ai-assistant) is off by default. When you turn it on, add your own Anthropic API key and run an AI command, that command's text is sent to Anthropic (see the table below). If you choose a local model (Ollama) instead, the text goes to Ollama on your own computer and nowhere else.
- Import and export (Word, PDF, HTML, CSV) run entirely on your computer.

## No telemetry

Markpion doesn't collect usage statistics, analytics or crash reports, and doesn't send any data about you or your documents.

## Network access

Markpion works fully offline. It connects to the internet in only these cases:

| When | What happens | Can you turn it off? |
| --- | --- | --- |
| At startup, and when you choose **Help → Check for Updates…** | It asks GitHub (`api.github.com`) for the latest version number. Like any web request, this reveals your IP address to GitHub. No document data is sent. | Yes: **Settings → Startup → Check for updates when Markpion starts** |
| When you choose **Update Now** (Windows) | It downloads the new installer from GitHub Releases. | Don't choose Update Now |
| When a document you preview contains an `https://` image | The image is loaded from its web server, as in a browser. | Use local images |
| When you click a web link in the preview | The link opens in your browser. | |
| When you save an Anthropic API key, or run an AI command (only if the [AI assistant](/guide/ai-assistant) is turned on) | Saving the key checks it with `api.anthropic.com`. An AI command sends the selected text (or the paragraph at the cursor, or up to 6,000 characters before it) and the instruction to Anthropic's Claude API, under your key. Markpion asks before the first one. | Yes: it's off by default; **Settings → AI Assistant** |

The app's Content Security Policy limits the interface's own network requests to `api.github.com`. AI requests are made by Markpion's native part, which alone can read the API key.

## What's stored on your computer

Markpion keeps these in your user profile (see [Configuration](/reference/configuration) for the exact folders):

- **Settings** and the list of **recent files and folders**.
- **Your Anthropic API key**, if you added one, in Windows Credential Manager or the macOS Keychain (on Linux, a file in the settings folder that only your account can read).
- **File history:** the previous version of a file each time you save it (30 per file), so you can restore it.
- **Crash recovery:** snapshots of unsaved documents, so they can be recovered after a crash.
- **Logs:** operations and error types, **never document content**, with your home folder shown as `~`.

Delete those folders to remove everything; uninstalling leaves them in place so a reinstall keeps your settings.

## Limited file access

The part of the app that displays the interface has no direct access to your files. Every file operation goes through native code that only allows the files and folders you've opened yourself (and their contents), rejects path tricks such as `..`, and resolves shortcuts and links before checking.

## Safe documents

Documents can contain HTML, so the preview removes anything that could run code (scripts, event handlers, iframes, forms) and opens links only in your browser. Opening a Markdown file from someone else can't run code in Markpion.

## This website

This documentation website is a static site hosted on GitHub Pages. It uses no cookies, analytics or tracking scripts of its own; your light or dark theme choice is remembered in your browser's local storage. GitHub may log visits as described in [GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

## Questions

Ask in [GitHub issues](https://github.com/nasimuddin-dev/markpion/issues).
