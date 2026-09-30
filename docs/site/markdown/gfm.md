---
title: GitHub Flavored Markdown
description: Which GitHub Flavored Markdown (GFM) features Markpion supports, including tables, task lists, strikethrough, autolinks, fenced code, footnotes and alerts, and the extensions it adds.
---

# GitHub Flavored Markdown

Markpion renders **GitHub Flavored Markdown (GFM)**, the Markdown dialect used on GitHub, through the [remark-gfm](https://github.com/remarkjs/remark-gfm) parser plugin. Documents you write in Markpion display the same way in GitHub READMEs, issues and wikis, apart from the extensions noted below.

## Supported GFM features

| Feature | Syntax | Notes |
| --- | --- | --- |
| Tables | `\| a \| b \|` | With column alignment. See [Tables](/markdown/tables) |
| Task lists | `- [ ]` / `- [x]` | Clickable in the preview; **Ctrl+Enter** toggles them in the editor |
| Strikethrough | `~~text~~` | **Ctrl+Shift+X** |
| Autolinks | `https://example.com`, `www.example.com` | Bare URLs and email addresses become links |
| Fenced code blocks | ` ``` ` or `~~~`, with a language | Syntax highlighting. See [Code blocks](/markdown/code-blocks) |
| Footnotes | `text[^1]` and `[^1]: note` | See [Footnotes](/markdown/extras#footnotes) |
| Alerts | `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` | See [Alerts](/markdown/extras#alerts) |
| Heading anchors | `[link](#heading-text)` | The same anchor ids as GitHub |
| HTML | `<details>`, `<kbd>` and similar | Sanitized with GitHub's allow-list |
| Emoji shortcodes | `:tada:`, `:white_check_mark:` | GitHub's names. Shortcodes in code stay as typed. PDF export keeps the shortcode text, because its font has no emoji |

## Extensions beyond GFM

Markpion also supports, and GitHub renders too:

- [Mermaid diagrams](/markdown/mermaid) in ` ```mermaid ` blocks.
- [LaTeX math](/markdown/math) with `$…$` and `$$…$$`.
- [YAML front matter](/markdown/extras#front-matter) at the top of a file, shown as a table.

And, unlike GitHub, [wiki links](/markdown/extras#wiki-links) such as `[[Setup Guide]]` and [tags](/markdown/extras#tags) such as `#draft`.

## Differences from GitHub

- **Mentions and issue references** such as `@user` and `#123` stay plain text, because they only mean something inside a GitHub repository.
- **HTML** follows the same allow-list idea as GitHub, but the exact list of allowed attributes can differ slightly.
