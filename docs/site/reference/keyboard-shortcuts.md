---
title: Keyboard Shortcuts
description: The complete list of Markpion keyboard shortcuts for Windows, Linux and macOS, covering files, tabs, editing, formatting, views and the built-in editor keys.
---

# Keyboard shortcuts

The tables below are generated from Markpion's source code when this site is built, so they match the current version. Inside the app, **Help → Keyboard Shortcuts** shows the same list with a search box, and the command palette (**Ctrl+Shift+P** / **Cmd+Shift+P**, or **F1**) lists every command, including those without a shortcut.

## Change a shortcut

In **Help → Keyboard Shortcuts**, choose **Change** next to a command and press the new key combination (**Esc** cancels). Shortcuts need **Ctrl**, **Alt** or **Cmd**, or a function key. If another command already uses it, Markpion asks whether to move it. **Remove** leaves a command without a shortcut, **Reset** restores the original, and **Reset All** restores every shortcut. Any command can get a shortcut, including those without one here. Your shortcuts are saved in `keybindings` in [settings.json](/reference/configuration#settings-json); the tables below show the defaults.

## App commands

Files, tabs, editing, search and views.

<Shortcuts group="app" />

## Formatting

The **Format** menu. Commands without a shortcut, such as **Insert Table**, **Sort Table by Column** and **Move Section Up/Down**, are in the menu and the command palette.

<Shortcuts group="format" />

## Built-in editor keys

These come with the [CodeMirror](https://codemirror.net) editor.

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Command palette | <kbd>F1</kbd> | <kbd>F1</kbd> |
| Select next occurrence | <kbd>Ctrl+D</kbd> | <kbd>Cmd+D</kbd> |
| Add a cursor | <kbd>Ctrl+click</kbd> | <kbd>Cmd+click</kbd> |
| Rectangular selection | <kbd>Alt+drag</kbd> | <kbd>Option+drag</kbd> |
| Move line up / down | <kbd>Alt+↑</kbd> / <kbd>Alt+↓</kbd> | <kbd>Option+↑</kbd> / <kbd>Option+↓</kbd> |
| Copy line up / down | <kbd>Shift+Alt+↑</kbd> / <kbd>Shift+Alt+↓</kbd> | <kbd>Shift+Option+↑</kbd> / <kbd>Shift+Option+↓</kbd> |
| Delete line | <kbd>Ctrl+Shift+K</kbd> | <kbd>Cmd+Shift+K</kbd> |
| Indent / outdent | <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd>, <kbd>Ctrl+]</kbd> / <kbd>Ctrl+[</kbd> | <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd>, <kbd>Cmd+]</kbd> / <kbd>Cmd+[</kbd> |
| Next / previous table cell (in a table) | <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> | <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> |
| Fold / unfold | <kbd>Ctrl+Shift+[</kbd> / <kbd>Ctrl+Shift+]</kbd> | <kbd>Cmd+Option+[</kbd> / <kbd>Cmd+Option+]</kbd> |
| Fold all / unfold all (also in the View menu) | <kbd>Ctrl+Alt+[</kbd> / <kbd>Ctrl+Alt+]</kbd> | <kbd>Ctrl+Option+[</kbd> / <kbd>Ctrl+Option+]</kbd> |
| Next / previous match (in the search bar) | <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> | <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> |
| Paste as plain text (Windows) | <kbd>Ctrl+Shift+V</kbd> | Turn off rich paste in Settings |
| Leave Focus Mode, close the search bar | <kbd>Esc</kbd> | <kbd>Esc</kbd> |
| Move the focused outline heading's section up / down | <kbd>Alt+↑</kbd> / <kbd>Alt+↓</kbd> | <kbd>Option+↑</kbd> / <kbd>Option+↓</kbd> |
| Open the context menu (tabs, explorer, outline) | <kbd>Shift+F10</kbd> or the Menu key | <kbd>Shift+F10</kbd> |

## Notes

- On macOS, **Ctrl+Tab** and **Ctrl+Shift+Tab** (not Cmd) switch tabs.
- On Windows, **Ctrl+Alt** is the same as **AltGr** on many keyboard layouts. If a Ctrl+Alt shortcut types a character instead, use the menu or the command palette.
- Shortcuts that open a dialog (such as **Open File**) work anywhere in the window; formatting shortcuts work in the editor.
