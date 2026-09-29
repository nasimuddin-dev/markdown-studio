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
| `fontSize` | `15` | 10–28 |
| `fontFamily` | `""` | A font name; empty for the default monospace font |
| `lineNumbers` | `true` | |
| `lineWrapping` | `true` | |
| `tabSize` | `2` | `2`, `4`, `8` |
| `spellCheck` | `true` | |
| `lintMarkdown` | `true` | |
| `pasteRichTextAsMarkdown` | `true` | |
| `previewDebounceMs` | `150` | 0–1000 |
| `renderMath` | `true` | |
| `renderDiagrams` | `true` | |
| `syncScroll` | `true` | |
| `viewMode` | `"split"` | `"editor"`, `"split"`, `"preview"` |
| `showExplorer`, `showOutline` | `true` | |
| `autoSave` | `"off"` | `"off"`, `"afterDelay"`, `"onFocusChange"` |
| `autoSaveDelayMs` | `1000` | Milliseconds |
| `trimTrailingWhitespace` | `false` | |
| `insertFinalNewline` | `false` | |
| `updateTocOnSave` | `true` | |
| `newFileLineEnding` | `"lf"` | `"lf"`, `"crlf"`, `"auto"` |
| `exportPageSize` | `"auto"` | `"auto"`, `"a4"`, `"letter"` |
| `restoreSession` | `true` | |
| `checkForUpdates` | `true` | |

The file also records the last session (open folder and files) so it can be restored.

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
