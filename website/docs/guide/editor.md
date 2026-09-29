---
title: Editor
description: How to use the Markpion editor, including layout, syntax highlighting, line numbers, selection and multiple cursors, folding, undo and redo, paste, views, focus mode and go to line.
---

# Editor

The editor is where you write Markdown. It's built on [CodeMirror 6](https://codemirror.net), the editor component used in many developer tools. Shortcuts are shown for Windows and Linux; on macOS use **Cmd** instead of **Ctrl** and **Option** instead of **Alt** (see [Keyboard shortcuts](/reference/keyboard-shortcuts)).

## Layout

By default the window shows the sidebar (Explorer and Outline), the tabs, the editor and the [preview](/guide/preview) side by side. Change it from the **View** menu or the buttons at the top right:

| View | Shortcut |
| --- | --- |
| Editor only | Ctrl+1 |
| Split (editor and preview) | Ctrl+2 |
| Preview only | Ctrl+3 |
| Cycle through the views | Ctrl+\\ |
| Show or hide the file explorer | Ctrl+Shift+E |
| Show or hide the outline | Ctrl+Shift+L |

Drag the dividers between panels to resize them. The sizes are remembered.

- **Focus Mode** (**Ctrl+Shift+Enter**) hides everything except the editor and preview. Press **Esc** or the same shortcut to leave.
- **Full Screen** (**F11**) fills the screen.

## Syntax highlighting

Markdown syntax is highlighted as you type: headings, emphasis, links, lists, quotes and code. Fenced code blocks are highlighted in their own language, for example ` ```python `, ` ```ts ` or ` ```bash `.

## Line numbers, wrapping and folding

- Line numbers are shown in the gutter. Turn them off in [Settings](/guide/settings).
- Long lines wrap by default; turn off **Wrap long lines** to scroll horizontally.
- Click the arrow next to a heading, list or code block in the gutter to fold it. **Ctrl+Shift+[** folds and **Ctrl+Shift+]** unfolds at the cursor (on macOS, **Cmd+Option+[** and **Cmd+Option+]**).
- **View → Fold All** collapses every section to its heading, for an overview of a long document, and **View → Unfold All** opens them again. In the editor, **Ctrl+Alt+[** and **Ctrl+Alt+]** do the same.

## Moving around

- **Go to Line** (**Ctrl+G**) jumps to a line number.
- The **Outline** in the sidebar lists the document's headings; click one to jump to it. Right-click a heading to **Copy Link to Heading** (`#anchor`) or **Copy Markdown Link** (`[Heading](#anchor)`), using the same anchors as the preview and GitHub. Drag a heading in the outline, or focus it and press **Alt+↑** / **Alt+↓**, to move its whole section (see [Move a section](/guide/writing-tools#move-a-section)).
- The status bar shows the line and column (**Ln**, **Col**).
- The usual keys work: arrows, **Home**/**End**, **Ctrl+Home**/**Ctrl+End**, **Page Up**/**Page Down**, and **Ctrl+←/→** by word.

## Selection and multiple cursors

- **Ctrl+A** selects everything. Double-click selects a word, and triple-click selects a line.
- **Ctrl+D** selects the next occurrence of the current word or selection, adding a cursor there.
- **Ctrl+click** (Cmd+click on macOS) adds another cursor.
- **Alt+drag** selects a rectangular block, which is useful for editing table columns.
- Matching text elsewhere in the document is highlighted when you select a word.

## Editing lines

| Action | Shortcut |
| --- | --- |
| Move line up / down | Alt+↑ / Alt+↓ |
| Copy line up / down | Shift+Alt+↑ / Shift+Alt+↓ |
| Delete line | Ctrl+Shift+K |
| Indent / outdent | Tab / Shift+Tab, or Ctrl+] / Ctrl+[ |

When you press **Enter** inside a list or quote, the next line continues it.

## Undo and redo

**Ctrl+Z** undoes and **Ctrl+Y** redoes (**Cmd+Shift+Z** on macOS). Each tab keeps its own undo history while it's open, so switching tabs doesn't lose it. Formatting commands, table sorting and task toggles can all be undone.

## Copy, cut and paste

Copy, cut and paste use the system clipboard. Markpion adds some smart behaviour:

- **Rich text:** content copied from a web page or Word is converted to Markdown (headings, lists, links, tables). On Windows, **Ctrl+Shift+V** pastes plain text instead; on any system you can turn the conversion off in Settings.
- **Spreadsheet cells:** cells copied from Excel or Google Sheets are pasted as a Markdown table.
- **Links:** pasting a URL while text is selected turns the selection into `[text](url)`.
- **Images:** pasting an image saves it to an `assets/` folder next to the document and inserts a link (see [Images](/markdown/images)).

## Formatting

The **Format** menu has commands for bold, italic, links, headings, lists, tables and more. They're described in [Writing tools](/guide/writing-tools).

## Spelling and statistics

- Spelling is checked with your operating system's dictionary, and misspelled words are underlined. Turn it off in Settings.
- The status bar shows the word count. Click it to see words, characters, lines, paragraphs and reading time for the document, and for the selection if there is one.

## Saving

Save with **Ctrl+S**, Save As with **Ctrl+Shift+S**, and Save All with **Ctrl+Alt+S**. Auto save, recovery and file history are covered in [Saving, history & recovery](/guide/saving-and-recovery).
