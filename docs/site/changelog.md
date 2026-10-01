---
title: Changelog
description: Release notes for every Markpion version, listing what was added, changed, fixed and secured in each release, with links to the downloads on GitHub.
---

# Changelog

Every release of Markpion, newest first. Dates are the GitHub release dates (UTC). Installers for each version are on the [GitHub releases page](https://github.com/nasimuddin-dev/markpion/releases).

## v0.24.0

Released: 2026-10-01 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.24.0)

### Added

- **Breadcrumbs** above the editor show where the cursor is in the document's headings, for example **notes.md › Guide › Install**. Click a part to list the headings at that level and jump to one. Turn them off with **View → Breadcrumbs**.

### Changed

- **Long documents appear much faster.** A document over 100 KB is prepared section by section: the part you're looking at shows right away and the rest as you scroll to it, and an edit only re-prepares the section it touches. In our measurement an 800 KB document appeared in 1.6 seconds instead of 12.6.
- Exporting to PDF, Word or a .zip uses less memory.
- A more even look: spacing inside buttons, menus, lists and dialogs now follows one scale, so some elements moved by a pixel or two.

### Fixed

- Lines starting with `#` inside an HTML comment (`<!-- … -->`), a `<pre>` block or a `$$` math block were treated as headings: they appeared in the Outline, the table of contents and heading suggestions, and could shift the anchors of real headings after them.

## v0.23.1

Released: 2026-10-01 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.23.1)

### Added

- **Settings → Preview → Show pictures from the web in the preview.** Turn it off and a document's `https://` pictures are shown as placeholders, so previewing a document sends no request anywhere. IT can preset or lock it.

### Changed

- Large documents (over 1 MB of text): the status bar's word and task counts settle a moment after you stop typing instead of recounting on every keystroke, and the Markdown checks don't run, so typing stays smooth.
- Importing large Word and PDF files uses much less memory.
- Saving and opening large files no longer makes the rest of the app wait.
- Linux: opening a folder with very many subfolders (for example one containing `node_modules`) no longer uses up the system's file-watch limit.

### Fixed

- Opening several files at once (or a second file right after the first) could drop the ones that arrived while Markpion was still starting.
- Pictures embedded in a document as `data:image/…` (for example an import opened without saving) didn't show in the preview.
- The preview kept every local picture it had shown in memory for the whole session; it now keeps the most recently used ones.

### Security

- A document opened on its own can show pictures from its folder and the folders inside it, but no longer from hidden folders, and only from beside it when it sits directly in your home folder or at the top of a drive.
- A vulnerable library pulled in by the math export was updated (it wasn't part of the shipped app). Dependencies are now audited automatically on every change.
- Log entries written by the interface are limited in size and kept to one line.

## v0.23.0

Released: 2026-09-30 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.23.0)

### Added

- **Local AI models:** Settings → AI Assistant can use a model running on your computer through Ollama instead of Claude, so your text never leaves the computer. No API key or consent prompt is needed for a local model.
- **Menus with submenus and check marks.** Long menus are grouped into short submenus: **File → Open Recent, Import, Export, Copy As**; **Edit → Go To, Git Changes, Lines, Change Case**; **Format → Link Style, Heading, Callout, Math, Diagram, Insert**; **View → Editor, Fold, Font Size, Slides**. Point at a submenu, click it or press **→** to open it. Settings that are on or off (Word Wrap, Line Numbers, the view mode, the sidebar panels) show a check mark.
- The command palette shows where each command is in the menus (for example *Format › Heading*).
- **macOS:** the menus are in the system menu bar, with the standard Markpion and Window menus.
- **ARM64 installers** for Windows and Linux.

### Changed

- The **formatting toolbar** stays on one row. When the editor is too narrow for every button, the ones that don't fit move into a **More** (**⋯**) menu at the end instead of wrapping onto a second row.
- **PDF export** draws display formulas as vector graphics on every system, including matrices, arrows and set symbols; **Word export** draws display formulas it can't make into Word equations as pictures (with the LaTeX as alt text).
- **Settings:** Import, Export and **Reset to Defaults…** are on the left and **Done** is on the right. Reset now asks first, because it also clears custom keyboard shortcuts and word count goals.
- In a narrow sidebar, the Explorer's header shows the folder name in full; its buttons appear when you point at the header or reach it with **Tab**.
- A consistent look: one set of type sizes, corner radii, shadows and layers across the app, and hover colours that ease in (not when the system asks for reduced motion). The outline's heading-level labels are slightly larger.

## v0.22.0

Released: 2026-09-30 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.22.0)

### Added

**Wiki links**

- `[[Page]]`, `[[Page|shown text]]` and `[[folder/Page#Heading]]` link to other documents in the folder. The preview, HTML, PDF and Word exports show them as links.
- Type `[[` to pick a document, and `#` after the page (or `[[#`) to pick one of its headings. **Ctrl+click** opens a wiki link.
- Wiki links are checked like other links (missing pages and headings), count in **Links to this document**, and are updated when a file is renamed or moved, or a heading is renamed.

**Tags**

- Write `#tag` in the text or list `tags` in the front matter. **Edit → Go to Tag…** lists the folder's tags, and the new **Tags** tab in the sidebar lists them with the files using each.
- Typing `#` (or a name in the front matter `tags`) suggests the tags already in use.
- The preview shows tags as labels; click one to see where else it's used. HTML export shows the labels too, and PDF and Word exports colour tags.
- **Rename Tag** (**F2** on a tag, or the Edit menu) renames it in the document and, after asking, across the folder, including nested tags and front matter.
- A new check flags a tag written in two capitalisations in one document, with a fix.

**Links and notes**

- Hovering a link to another document in the editor shows the start of it (or of the linked section).
- The Links tab lists **Mentions without a link**: places in other files that name the open document without linking to it.
- **File → Open Today's Note** opens `journal/YYYY-MM-DD.md`, created from the Daily journal template the first time each day.
- A **Filter files** box at the top of the Explorer lists the files whose name or path matches, from every folder.

**Writing**

- **Format → Insert Snippet…**: built-in snippets and your own from the folder's `snippets` folder.
- **Format → Insert Front Matter**: title, date and tags, or jumps to the existing front matter.
- The statistics popover (click the word count) adds sentences, speaking time and a Flesch readability score for English.
- Settings: **Close brackets automatically** (off by default) and **Ask for a name when pasting a screenshot**.
- A new check flags front matter without its closing `---`, with a fix.

### Changed

- A line of tags such as `#idea #work` is no longer reported as a heading without a space.
- Renaming or moving a file also updates absolute paths to it (`/home/me/notes/a.md`, `C:/notes/a.md`), which stay absolute.
- Sidebar tabs show only their icons below 320 px wide (was 250 px), to make room for the Tags tab.

### Fixed

- The command palette gives the focus back to where it was when it closes.

## v0.21.0

Released: 2026-09-30 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.21.0)

### Added

**Links and headings**

- **Ctrl+click** (**Cmd+click** on macOS) follows a link in the editor, or put the cursor on it and press **Alt+Enter**: web pages open in your browser, `#heading` links and reference links move to their target, and Markdown files open in a tab at the named heading.
- **Rename Heading** (**F2**, Format menu or the Outline): renames a heading and updates the `#anchor` links to it, in the document and, after asking, in the folder's other files. On a footnote or a link reference label, **F2** renames the label everywhere.
- **Links to this document** in the Links tab: the other files in the folder that link to the open document.
- **Format → Convert Links to Reference Style** and **to Inline Style**; **Remove Link**; **Insert Link** inside a link selects its address.
- Completion for the reference labels a document defines (after `][`), footnotes (after `[^`) and another document's headings (after `](guide.md#`).
- **Go to Heading in Folder** (**Ctrl+Shift+Alt+H**) and **Copy Link to Current Heading** (command palette). Hovering a heading in the preview shows a link icon that copies its anchor.
- Hovering an image link in the editor shows the picture; clicking a picture in the preview shows it at full size.

**Checking documents**

- New checks with quick fixes: reference links without a definition, unused or doubly defined labels, `#Title` without a space, `---` that turns a line into a heading, list items without a space, bold with spaces inside, and paths with spaces. A table with mistakes offers **Fix Table**.
- A link or image to a misspelled file name suggests the file that was meant (**Change to guide.md**); the Links tab names it too.
- **F8** / **Shift+F8** go to the next or previous problem; each kind of check can be turned off (**Don't Show This Check**) and back on in Settings.

**Writing and editing**

- **Table menu**, with column alignment and moving columns; **Align tables on save** (Settings → Files).
- **Format → Insert Callout** (Note, Tip, Important, Warning, Caution), **Insert Date / Date and Time**, **Inline Math**, **Insert Math Block**, Mermaid starters (flowchart, sequence diagram, Gantt chart, pie chart) and **Toggle Comment** (**Ctrl+/**).
- **Edit → Select Section** (again for the parent section), also from the Outline; the Outline's sections can be collapsed.
- **View → Fold to Level 1, 2 or 3**, **Toggle Typewriter Scrolling** and **Dim Other Paragraphs**; a **Line length** setting keeps the text a readable width.
- **Find in the preview** (**Ctrl+F** when the preview is shown alone or has focus).
- The editor and preview scroll together line by line, and double-clicking the preview puts the cursor on that block's source.
- **F6** / **Shift+F6** move the focus between the sidebar, the editor and the preview.

**Files**

- The Explorer lists pictures (preview them, link them, or drag them into the editor), has a **Collapse Folders** button, and dragging a file into the editor links it.
- **File → Move Selection to New File…**, **Save as Template…**, **Close All Tabs**, **Show in Explorer** and **Copy Relative Path** (tab menu).
- Without a folder, the Explorer lists recent files and folders (each can be removed from the list).
- Change a file's line endings (LF or CRLF) or byte order mark from the status bar.
- **Settings → Files → Folder for pasted images** (instead of `assets`), used by imports too.
- Tabs of files with the same name show their folder.
- The status bar shows the file's changes since the last Git commit, task progress (click for the next open task) and a word count goal (**Set Word Count Goal…**); click **Ln, Col** to go to a line.

**Export, print and review**

- Printing adds the document's title and page numbers to each page (also for printed HTML exports); PDF and Word exports put the title at the top of each page after the first.
- `#anchor` links jump to their heading in PDF exports and survive Word export and import.
- **Export as Markdown with Images (.zip)** and **Copy as Plain Text**.
- **Start each top-level heading on a new page** (Settings → Export) for PDF, Word and printing.
- File History and Compare mark the words that changed within a line; the AI review shows the changes for commands that replace text.
- Slides: speaker notes, and **View → Print Slides**.
- Settings has a search box; the command palette lists recently used commands first.

### Changed

- Diffs list removed lines before added ones, as Git does.
- In a narrow window, the status bar hides the line ending, encoding and language to make room.
- Checks skip code blocks with one pass over the document instead of one per check.

### Fixed

- HTML comments that contained `>` could leave part of their text in Word and PDF exports.
- Long menus ran off the bottom of short windows, and the Links tab was cut off in a narrow sidebar.

## v0.20.0

Released: 2026-09-30 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.20.0)

### Added

- **Fix Table** (Format menu, and the toolbar's Table tools): repairs a table typed with mistakes, such as a missing divider row, rows with too few or too many cells, missing pipes or a pipe inside code.
- **Compare with File…** (File menu, or **Compare with Active File** in the Explorer): a line diff between the document and another file in the folder.
- **Convert Selection to Table** (Format menu): comma-, tab-, semicolon- or pipe-separated lines become a Markdown table.
- **Wrap the selection** by typing `*`, `_`, `` ` ``, `~`, `"`, `(` or `[`: select a word and type `**` to make it bold.
- **File → Rename File…**; **View → Toggle Word Wrap** (**Alt+Z**) and **Toggle Line Numbers**.
- **Settings** has a list of sections to jump between.
- **Save As** suggests a name from the document's title (for example `Meeting Notes.md`) and starts next to your other open files.

### Changed

- The find and replace bar has proper labels (Next, Previous, Select All, Match case, Whole word, Regex, Replace All).
- The command palette lists whole-word matches first ("tab" finds Close Tab before Table commands).
- Search: the file filters now sit below the Replace field.
- The Recent list follows files and folders you rename or move in Markpion.

### Fixed

- The Explorer without a folder showed two buttons that did nearly the same thing; there's now one **Open Folder**.
- The formatting toolbar could start its second row with a stray divider, and the view buttons at the top right picked up the toolbar's background.

## v0.19.0

Released: 2026-09-30 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.19.0)

### Added

- **Rename a file from its tab** (right-click → **Rename…**), even when no folder is open. A document that was never saved offers **Save As…**.
- **Open files in the Explorer:** without an open folder, the Explorer lists your open files (click to switch, **F2** to rename, right-click for more) and can open the current file's folder.
- **Open Containing Folder…** in the tab menu for files outside the open folder.
- **Table size picker:** the toolbar's Table button lets you choose the number of columns and rows.
- **More quick fixes:** change a skipped heading level, and correct a link to a misspelled heading anchor. **Edit → Fix All Problems** applies every quick fix at once.

### Fixed

- The Recent list on the welcome screen was underlined and cramped, and its **Clear** button sat awkwardly against the heading.

## v0.18.0

Released: 2026-09-30 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.18.0)

### Added

- **Git change bars** in the editor: lines added, changed or deleted since the last commit. Click a bar to see the committed lines and **Revert Change**; **Alt+F5** / **Shift+Alt+F5** go to the next and previous change.
- **File History** also lists the **last Git commit**, and, while you have unsaved changes, the **saved file**, so you can review what saving would change.
- **Custom CSS for documents** (Settings → Preview): your own styles for the preview, printing, slides and HTML export. It only affects the document, never the app, and IT can preset or lock it.
- **Read-only files** open locked, with **Save As** or **Edit Anyway**; **View → Toggle Read-Only** protects any document from accidental edits.
- **Find in Files: files to include and exclude** (for example `docs`, `*.draft.md`); Replace All uses the same filters.
- **Format → Number Headings** (1., 1.1, 1.1.1) and **Remove Heading Numbers**; running it again renumbers.
- **Edit → Go to Heading** (**Ctrl+Alt+H**): jump to a heading by typing part of it.
- **Edit menu line tools:** Sort Lines, Remove Duplicate Lines, Join Lines, and Uppercase / Lowercase / Title Case.
- **Copy button** on code blocks in the preview.
- **Toolbar:** Heading 4 to 6 in the paragraph style list (also **Ctrl+Alt+4** to **6**), and **Table tools** (rows, columns, format, sort, copy as CSV) when the cursor is in a table.
- **Lint:** table rows that don't match the header, a text line right after a table, footnotes without a definition, and links without text, with **quick fixes** (Add Blank Line, Add Empty Cells, Add Definition).

### Fixed

- Link checks and link updates didn't understand HTML entities such as `&amp;` in `<a href>` and `<img src>`.
- Accessibility: better contrast for the selected row in the Problems panel, the line numbers, and the unsaved-changes label in the status bar (light theme); the File History version list had an invalid screen-reader structure.

## v0.17.0

Released: 2026-09-29 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.17.0)

### Added

- **Formatting toolbar** above the editor, like a word processor's: undo and redo, paragraph style (normal text, headings), bold, italic, strikethrough, code, lists, quote, link, image, table, code block, horizontal rule, footnote, table of contents, and an AI menu when the assistant is on. Buttons light up for the formatting at the cursor. Hide it with View → Toggle Formatting Toolbar.
- **Present as Slides** (View menu): the document as full-window slides, split at `---` lines or at headings, with keyboard navigation.
- **Git status:** the Explorer marks changed files (M, A, D, R, U, C) and the status bar shows the branch. Read-only; needs Git; can be turned off in Settings → Files.
- **Insert Image…** (Format menu) picks an image file and links it.
- **Close Folder** button in the Explorer: the folder leaves the Explorer, nothing is deleted.
- **Resizable Outline:** drag the line between the Explorer and the Outline.
- **Clear Recent:** remove single entries from the recent list on the welcome screen, or clear it all (also File → Clear Recent).
- **Link updates, checks and lint** now also cover reference-style links (`[id]: path`) and HTML `<a href>` / `<img src>`.

### Changed

- Long documents appear in the preview faster: only the part near what you're looking at is built at first (a pasted 800 KB document: about 5.2 → 3.5 seconds).

### Fixed

- Windows: the Save As, Open and Export dialogs could open behind the Markpion window (for example when exporting a PDF).
- PDF import: bullet points from Word documents became one run-on paragraph; they are now Markdown lists, including nested ones.
- Text typed straight after pasting rich text or spreadsheet cells could end up before the pasted content.

## v0.16.0

Released: 2026-09-29 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.16.0)

### Added

- **AI assistant (optional, off by default):** with your own Anthropic API key, Claude can improve, shorten, fix grammar, translate, summarize or continue the selected text, answer a question about the document (Ctrl/Cmd+J), or write new text from an instruction (Ctrl/Cmd+Shift+J). Answers stream in as Claude writes them, can be stopped, and change nothing until you apply them. The key is kept in your system's credential store.
- **Links follow renamed and moved files:** after you rename or move a file or folder in the Explorer, Markpion offers to update the relative links and images that would otherwise break.
- **Move files and folders** in the Explorer by drag and drop, or with **Move To…** from the keyboard.
- **Customizable keyboard shortcuts** in Help → Keyboard Shortcuts: change, remove or reset any command's shortcut.
- **Export and import settings** (including shortcuts) as `markpion-settings.json`.
- **Managed settings for IT administrators:** a `policy.json` file can set defaults and lock settings.
- **Export Folder as HTML Site:** every document becomes an HTML page, links between documents keep working, and an index page lists them all.
- **Tables:** insert and delete rows and columns, and move between cells with Tab and Shift+Tab.
- **GitHub emoji shortcodes** (`:tada:`) in the preview and exports, with completion in the editor.
- **Exports:** page size (A4 or Letter) for PDF and Word, document properties from front matter, and page numbers in Word footers.

### Changed

- Large documents appear in the preview about twice as fast.
- Windows High Contrast (forced colours) is supported throughout the app.
- The History, Keyboard Shortcuts and AI dialogs load after startup, making the first download of the web code smaller.

### Fixed

- Windows: the window no longer flashes white while the app starts in dark mode.
- A rendering error in one part of the window is contained and reported instead of blanking the whole window.

## v0.15.0

Released: 2026-09-29 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.15.0)

### Added

- **Inline formulas in PDF export** are set as text, with italic variables, real superscripts and subscripts, fractions and roots. A formula that needs a symbol the PDF font doesn't have (arrows, set symbols), a script inside a script, or a matrix still shows its LaTeX.

### Fixed

- **Windows: missing shortcuts after updating from Markdown Studio.** Updating to 0.14.0 removed the Markdown Studio shortcuts without creating Markpion ones. This update creates the Start menu and desktop shortcuts once. Pin Markpion to the taskbar again from the Start menu if you had pinned Markdown Studio.

## v0.14.0

Released: 2026-09-29 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.14.0)

### Added

- **Replace in Files:** replace a search term across every file in the open folder.
- **Go to File** (Ctrl/Cmd+Alt+O): open a file in the folder by typing part of its name.
- **Duplicate** a file from the Explorer's context menu.
- **Copy as Formatted Text** (File menu): copies the rendered document, with formatting, tables, links and images, for pasting into Word, an email or Google Docs.
- **Math in Word export:** LaTeX formulas become native Word equations (a common subset; matrices and environments stay as LaTeX).
- **Math in PDF export:** display formulas are drawn as pictures where the web engine allows it (Windows).

### Changed

- **Markdown Studio is now Markpion**, with a new logo. The installers, the app's folder and the GitHub repository (github.com/nasimuddin-dev/markpion) use the new name, and the website moved to nasimuddin-dev.github.io/markpion. Updating keeps your settings, recent files and version history, and on Windows the installer removes the old Markdown Studio installation.

### Fixed

- Tabs with long file names show their icon, name and close button on one row again, and saved tabs are no longer shown in italics.

## v0.13.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.13.0)

### Added

- **Drag headings in the Outline** to reorder sections. A line shows where the section will go, and Ctrl+Z undoes the move.

### Changed

- The project moved to the renamed GitHub account **nasimuddin-dev**. The update check, the release links and the website (then at nasimuddin-dev.github.io/markdown-studio) use the new address. Earlier versions still find updates through GitHub's redirect; updating to this version removes that dependency.

## v0.12.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.12.0)

### Added

- **Footnotes in PDF and Word exports.** PDF gets superscript numbers linked to a Footnotes section; Word gets real Word footnotes at the bottom of each page.
- **Mermaid diagrams in PDF and Word exports**, drawn as sharp pictures instead of code.
- **Outline actions:** right-click a heading to copy a link to it (`#anchor` or a Markdown link) or move its section; **Alt+↑ / Alt+↓** moves the focused heading's section.
- **View → Fold All / Unfold All.**
- **This website:** documentation, installation guides, troubleshooting, changelog and roadmap at nasimuddin-dev.github.io/markpion.

## v0.11.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.11.0)

### Added

- **macOS and Linux installers** on every release: `.dmg` for Apple Silicon and Intel, and AppImage, `.deb` and `.rpm` for Linux x86_64, alongside the Windows installers.
- **Check / Uncheck Task** (Ctrl/Cmd+Enter) toggles the tasks on the selected lines.
- **Insert Footnote** (Ctrl/Cmd+Alt+R) adds the next numbered footnote and its definition.
- **Export Folder as One PDF / One Word Document** combines a folder and exports it in one step.
- **Sort Table by Column** (A to Z, Z to A), numeric or natural text order.
- **Reopen Closed Tab** (Ctrl/Cmd+Shift+T).
- **Move Section Up / Down** moves a heading with its text and subsections.

### Changed

- On macOS and Linux, the update check offers the download page when a new version is available. In-place updates remain Windows-only.

## v0.10.0

Released: 2026-09-26 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.10.0)

### Added

- **Promote / Demote Heading** (Ctrl/Cmd+Alt+= and Ctrl/Cmd+Alt+-).
- **Clickable task checkboxes** in the preview: clicking one checks or unchecks the task in the source, and can be undone.

## v0.9.0

Released: 2026-09-25 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.9.0)

The first release delivered through the in-app updater.

### Added

- **YAML front matter** is shown as a metadata table in the preview, left out of exports, and its `title` names exported documents.
- **GitHub alerts** (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) render as callouts.
- **New from Template** with seven built-in templates, templates from the workspace's `templates/` folder, and date, week and cursor placeholders.
- **Paste a URL over selected text** to make a link.

## v0.8.0

Released: 2026-09-25 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.8.0)

### Added

- **Automatic updates on Windows.** At startup, Markpion offers new versions with **Update Now**, **Later** or **Skip This Version**. It saves open documents, downloads the update, installs it in place and restarts. The startup check can be turned off in Settings.

### Security

- Updates are signed, and the signature is verified against a public key built into the app before anything is installed. A tampered or unsigned update is refused, and the current version keeps running.

## v0.7.0

Released: 2026-09-25 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.7.0)

### Added

- **Combine Folder into One Document**: merges every Markdown file in a folder into one document with a table of contents, turning links between files into in-document links and adjusting image paths.

## v0.6.0

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.6.0)

### Added

- **Check for Updates** (Help menu) and an optional daily check against GitHub Releases, with Download, Later and Skip This Version.
- **Link check** for the whole folder (sidebar → Links): missing files and images, broken `#anchors` within and across files, and empty links.

### Security

- The Content Security Policy allows network requests only to `api.github.com`, for the update check.

## v0.5.0

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.5.0)

### Added

- **Insert / Update Table of Contents**, optionally kept up to date on save.
- **CSV/TSV tools:** import a CSV or TSV file as a table, paste spreadsheet cells as a table, and Copy Table as CSV.
- **Convert Folder to Markdown:** converts every Word, PDF, HTML and CSV/TSV file in a folder.

## v0.4.0

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.4.0)

### Added

- **Import** Word (`.docx`), PDF and web pages (`.html`) as Markdown, with images saved to `assets/`.
- **Paste rich text** from browsers and Word as Markdown.
- **Export** to Word (`.docx`) and PDF.

### Changed

- Imported lists use compact list markers, and image descriptions from Word are kept as alt text.

## v0.3.1

Released: 2026-09-24 · [Release files](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.3.1)

The first public release, with a Windows installer (standard, and offline with WebView2 included).

### Added

- A CodeMirror 6 editor with Markdown highlighting and a live GitHub Flavored Markdown preview, with editor-only, split and preview-only views.
- Workspaces with a file explorer, tabs, find and replace, Find in Files, a document outline, a command palette and recent files.
- The Format menu and formatting shortcuts, Format Table and link autocompletion.
- Mermaid diagrams and LaTeX math.
- Export to HTML, Copy as HTML, and Print / Save as PDF.
- Opening files from the operating system: file association, "Open with", single instance, and drag and drop.
- Pasting and dropping images into an `assets/` folder.
- Auto save, save options (trim whitespace, final newline, line endings) and a large-document mode.
- Markdown lint with a Problems panel.
- Local file history with diff and restore, crash recovery, and session restore.
- Live folder watching and detection of files changed on disk.
- Focus Mode, Full Screen, a Keyboard Shortcuts reference, document statistics and spell checking.
- Light, dark and system themes, and editor settings.

### Security

- The interface has no direct file system, dialog or shell access; every file operation goes through checked native commands limited to the files and folders you open.
- Preview HTML is sanitized with GitHub's allow-list, and a strict Content Security Policy blocks scripts.
- Links open in the system browser, and only `http`, `https` and `mailto` links are allowed.

### Accessibility

- Keyboard access to every function and visible focus, audited automatically against WCAG 2.1 AA in light and dark themes.
