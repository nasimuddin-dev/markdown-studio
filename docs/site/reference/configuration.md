---
title: Configuration
description: Where Markpion stores its settings, recent files, file history, crash recovery data and logs on Windows, macOS and Linux, the settings.json keys and defaults, and how to reset everything.
---

# Configuration

Markpion has no configuration files in your projects. Everything it stores lives in your user profile, under the app identifier `com.markpion.app`. Change settings through the [Settings dialog](/guide/settings); this page is for backups, troubleshooting and IT administrators.

## Where data is stored

| What | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Settings (`settings.json`), recent files (`recent.json`) | `%APPDATA%\com.markpion.app` | `~/Library/Application Support/com.markpion.app` | `~/.config/com.markpion.app` |
| File history (`history/`), crash recovery (`recovery/`) | `%APPDATA%\com.markpion.app` | `~/Library/Application Support/com.markpion.app` | `~/.local/share/com.markpion.app` |
| Logs | `%LOCALAPPDATA%\com.markpion.app\logs` | `~/Library/Logs/com.markpion.app` | `~/.local/share/com.markpion.app/logs` |

Your documents are never stored here, except for the previous versions kept by [file history](/guide/saving-and-recovery#file-history) and unsaved text kept for [crash recovery](/guide/saving-and-recovery#crash-recovery).

## settings.json

Settings are saved as JSON. Unknown keys are ignored and invalid values fall back to their defaults, so a damaged file can't stop the app from starting.

| Key | Default | Values |
| --- | --- | --- |
| `theme` | `"system"` | `"system"`, `"light"`, `"dark"` |
| `fontSize` | `15` | 8–40 (the Settings slider offers 10–28) |
| `fontFamily` | `""` | A font name; empty for the default monospace font |
| `lineNumbers` | `true` | |
| `lineWrapping` | `true` | |
| `editorLineLength` | `0` | `0` (full width), `72`, `80`, `100`, `120`: the editor text's width in characters, centered |
| `tabSize` | `2` | `2`, `4`, `8` |
| `spellCheck` | `true` | |
| `lintMarkdown` | `true` | |
| `typewriterScrolling` | `false` | Keep the line being typed in the middle of the editor |
| `closeBrackets` | `false` | Type the closing `)`, `]`, `}` or `` ` `` along with the opening one |
| `dimOtherParagraphs` | `false` | Dim every paragraph except the one with the cursor |
| `formatTablesOnSave` | `false` | Align every table when saving, as Format Table does |
| `explorerShowImages` | `true` | List pictures in the Explorer besides Markdown files |
| `wordGoals` | `{}` | Word count goals by file path, set with **Set Word Count Goal…** (whole numbers from 1 to 1,000,000) |
| `pageBreakBeforeH1` | `false` | PDF, Word and printing: each top-level heading after the first starts a new page |
| `askImageName` | `false` | Ask for a file name when pasting a screenshot, instead of a timestamped name |
| `imageFolder` | `"assets"` | Folder next to the document for pasted, dropped and inserted images: one name, without `/`, `\` or other characters not allowed in file names |
| `lintDisabledRules` | `[]` | Lint checks that are turned off, by id: `broken-link`, `missing-image`, `broken-anchor`, `empty-link`, `duplicate-heading`, `multiple-h1`, `heading-increment`, `image-alt`, `link-text`, `table-columns`, `footnote`, `reference`, `front-matter`, `heading-space`, `setext-heading`, `list-space`, `emphasis-space`, `destination-spaces` |
| `pasteRichTextAsMarkdown` | `true` | |
| `previewDebounceMs` | `150` | 0–1000 |
| `renderMath` | `true` | |
| `renderDiagrams` | `true` | |
| `previewRemoteImages` | `true` | Off: pictures from the web are placeholders in the preview, so no request leaves the computer |
| `syncScroll` | `true` | |
| `viewMode` | `"split"` | `"editor"`, `"split"`, `"preview"` |
| `showExplorer`, `showOutline` | `true` | |
| `showToolbar` | `true` | The formatting toolbar above the editor |
| `showBreadcrumbs` | `true` | The heading path of the cursor above the editor |
| `showGitStatus` | `true` | Git branch and changed files in the Explorer, and change bars in the editor gutter (runs `git status` and `git show`) |
| `autoSave` | `"off"` | `"off"`, `"afterDelay"`, `"onFocusChange"` |
| `autoSaveDelayMs` | `1000` | Milliseconds |
| `trimTrailingWhitespace` | `false` | |
| `insertFinalNewline` | `false` | |
| `updateTocOnSave` | `true` | |
| `newFileLineEnding` | `"lf"` | `"lf"`, `"crlf"`, `"auto"` |
| `exportPageSize` | `"auto"` | `"auto"`, `"a4"`, `"letter"` |
| `customCss` | `""` | CSS for rendered documents (preview, print, slides, HTML export), up to 100,000 characters; scoped to the document |
| `restoreSession` | `true` | |
| `checkForUpdates` | `true` | |
| `aiEnabled` | `false` | Turns on the [AI assistant](/guide/ai-assistant) |
| `aiModel` | `"claude-opus-5-5"` | `"claude-opus-5-5"`, `"claude-sonnet-5-5"`, `"claude-haiku-4-5"` |
| `aiConsent` | `false` | `true` once the user has agreed to send text for AI commands |
| `keybindings` | `{}` | Changed shortcuts: command id → shortcut such as `"Mod+Shift+K"` (`Mod` is Ctrl, or Cmd on macOS), or `null` for none. See [Keyboard shortcuts](/reference/keyboard-shortcuts#change-a-shortcut) |

The file also records the last session (open folder and files) so it can be restored.

Administrators can preset and lock these settings for everyone on a computer; see [Managed settings](/reference/managed-settings).

## Limits

| Limit | Value |
| --- | --- |
| Largest document that can be opened | 50 MB |
| Live preview pauses above | 1 MB of text |
| Largest image that can be added or previewed | 20 MB |
| Largest file that can be imported | 100 MB |
| File history | 30 versions per file |
| Recent files and folders | 15 |
| Reopen Closed Tab | 20 files |

## Reset Markpion

To start fresh, quit Markpion and delete the folders above. Settings return to their defaults; your documents aren't affected.
