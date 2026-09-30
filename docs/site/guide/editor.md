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

- **F6** moves the keyboard focus to the next pane (sidebar, editor, preview) and **Shift+F6** to the previous one, so you can reach the Explorer, the text and the preview without the mouse.
- **Focus Mode** (**Ctrl+Shift+Enter**) hides everything except the editor and preview. Press **Esc** or the same shortcut to leave.
- **Line length** (Settings → Editor): on a wide screen, long lines are hard to follow. Choose about 72, 80, 100 or 120 characters and the text (with its line numbers) stays that wide, centered in the editor; with **Wrap long lines** on, lines wrap there. A narrow editor, as in split view, still uses its full width.
- **Typewriter scrolling** (**View → Toggle Typewriter Scrolling**, or in Settings → Editor) keeps the line you're typing in the middle of the editor, so your eyes stay in one place. It pairs well with Focus Mode.
- **Dim other paragraphs** (**View → Toggle Dim Other Paragraphs**, or in Settings → Editor) fades every paragraph except the one the cursor is in, so the sentence you're writing stands out. A paragraph here is a run of lines without a blank line between them.
- **Full Screen** (**F11**) fills the screen.

## Syntax highlighting

Markdown syntax is highlighted as you type: headings, emphasis, links, lists, quotes and code. Fenced code blocks are highlighted in their own language, for example ` ```python `, ` ```ts ` or ` ```bash `.

## Line numbers, wrapping and folding

- Line numbers are shown in the gutter. Turn them off with **View → Toggle Line Numbers** or in [Settings](/guide/settings).
- Long lines wrap by default; **View → Toggle Word Wrap** (**Alt+Z**) or the **Wrap long lines** setting switches to horizontal scrolling.
- Click the arrow next to a heading, list or code block in the gutter to fold it. **Ctrl+Shift+[** folds and **Ctrl+Shift+]** unfolds at the cursor (on macOS, **Cmd+Option+[** and **Cmd+Option+]**).
- **View → Fold All** collapses every section to its heading, for an overview of a long document, and **View → Unfold All** opens them again. In the editor, **Ctrl+Alt+[** and **Ctrl+Alt+]** do the same. **View → Fold to Level 1**, **2** or **3** folds every section at that heading level and deeper, so the document reads like its table of contents down to that level (for example, Level 2 leaves the `#` and `##` headings showing, with each `##` section closed).

## Moving around

- **Go to Line** (**Ctrl+G**) jumps to a line number.
- The **Outline** in the sidebar lists the document's headings; click one to jump to it. Click the arrow before a heading that has subheadings, or press **Left** / **Right** on it, to hide or show them. Right-click a heading to **Rename Heading…** (links to it follow, see [Rename a heading](/guide/writing-tools#rename-a-heading)), **Copy Link to Heading** (`#anchor`) or **Copy Markdown Link** (`[Heading](#anchor)`), using the same anchors as the preview and GitHub. Drag a heading in the outline, or focus it and press **Alt+↑** / **Alt+↓**, to move its whole section (see [Move a section](/guide/writing-tools#move-a-section)).
- The status bar shows the line and column (**Ln**, **Col**); click it to go to a line.
- The usual keys work: arrows, **Home**/**End**, **Ctrl+Home**/**Ctrl+End**, **Page Up**/**Page Down**, and **Ctrl+←/→** by word.

## Selection and multiple cursors

- **Ctrl+A** selects everything. Double-click selects a word, and triple-click selects a line.
- **Ctrl+D** selects the next occurrence of the current word or selection, adding a cursor there.
- **Ctrl+click** (Cmd+click on macOS) adds another cursor.
- **Alt+drag** selects a rectangular block, which is useful for editing table columns.
- Matching text elsewhere in the document is highlighted when you select a word.
- With text selected, typing `*`, `_`, `` ` ``, `~`, `"`, `(` or `[` wraps the selection instead of replacing it, and keeps it selected: select a word and type `**` to make it bold.

## Editing lines

| Action | Shortcut |
| --- | --- |
| Move line up / down | Alt+↑ / Alt+↓ |
| Copy line up / down | Shift+Alt+↑ / Shift+Alt+↓ |
| Delete line | Ctrl+Shift+K |
| Indent / outdent | Tab / Shift+Tab, or Ctrl+] / Ctrl+[ |

The **Edit** menu (and the command palette) also has:

- **Sort Lines (A to Z)** and **(Z to A)**: numbers sort naturally, so 2 comes before 10.
- **Remove Duplicate Lines**: keeps the first of each repeated line; blank lines stay.
- **Join Lines**: joins the selected lines, or the current line and the next one, with single spaces.
- **Transform to Uppercase**, **Lowercase** and **Title Case**: for each selection, or the word at the cursor.

Sorting and removing duplicates work on the selected lines, or on the whole document when nothing is selected. Each is one edit that **Ctrl+Z** undoes.

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

The **Format** menu has commands for bold, italic, links, headings, lists and more; the **Table** menu has everything for tables. They're described in [Writing tools](/guide/writing-tools).

### Formatting toolbar

The toolbar above the editor puts the common commands one click away, like a word processor:

| Group | Buttons |
| --- | --- |
| History | Undo, Redo, and the **paragraph style** list (Normal text, Heading 1–6) |
| Text | Bold, Italic, Strikethrough, Inline code |
| Paragraphs | Bulleted list, Numbered list, Task list, Quote |
| Insert | Link, Image, Table (choose the size: hover over the grid and click, or type the columns and rows, header row included), Code block, Horizontal rule, Footnote, Table of contents. With the cursor in a table (even one with mistakes) or several lines selected, the Table button becomes **Table tools**: **Fix Table**, insert or delete rows and columns, align or move columns, format, sort, or copy the table as CSV |
| AI | A menu of the [AI assistant](/guide/ai-assistant)'s actions (only when the assistant is turned on) |

- Buttons light up for the formatting at the cursor: **Bold** inside `**bold**`, **Bulleted list** in a bulleted list, and so on. The paragraph style list shows the current heading level.
- Clicking a button keeps your selection and the cursor in the editor. Hover over a button to see its keyboard shortcut.
- From the keyboard, **Tab** into the toolbar and use **←** / **→**, **Home** and **End** to move between its controls.
- Hide or show it with **View → Toggle Formatting Toolbar**. It's hidden in Focus Mode.

## Spelling and statistics

- Spelling is checked with your operating system's dictionary, and misspelled words are underlined. Turn it off in Settings.
- The status bar shows the word count. Click it to see words, characters, lines, paragraphs and reading time for the document, and for the selection if there is one.
- In a document with task lists, the status bar also shows how many tasks are done (`2/5 tasks`). Click it to go to the next open task. In a narrow window, the line ending, encoding and "Markdown" labels are hidden to make room.

## Saving

Save with **Ctrl+S**, Save As with **Ctrl+Shift+S**, and Save All with **Ctrl+Alt+S**. Auto save, recovery and file history are covered in [Saving, history & recovery](/guide/saving-and-recovery).
