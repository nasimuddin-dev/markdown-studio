# Markpion

Formerly **Markdown Studio**. A fast, local-first, privacy-conscious Markdown editor for Windows, macOS and Linux, built with **Tauri 2**, **React + TypeScript**, **CodeMirror 6** and the **remark/rehype** ecosystem.

**Website and user documentation: [nasimuddin-dev.github.io/markpion](https://nasimuddin-dev.github.io/markpion/)** (download, installation guides, user guide, Markdown reference, FAQ, troubleshooting, changelog).

The requirements are in [docs/SRS.md](docs/SRS.md), and implementation status per requirement is in [docs/TRACEABILITY.md](docs/TRACEABILITY.md).

## Download

<!-- download:start -->
Markpion 0.20.0 was released on 2026-09-29 and has a separate installer for each operating system. Each one is self-contained: nothing else needs to be installed. All files and checksums are on the [0.20.0 release page](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.20.0).

| Operating system | Download |
| --- | --- |
| **Windows** 10 (1803+) and 11, x64 | [Standard installer](downloads/Markpion-0.20.0-windows-x64-setup.exe?raw=true) (7.1 MB) · [Offline installer](https://github.com/nasimuddin-dev/markpion/releases/download/v0.20.0/Markpion-0.20.0-windows-x64-offline-setup.exe) (212.2 MB) |
| **macOS** 10.15+ | [Apple Silicon (M1 and later)](https://github.com/nasimuddin-dev/markpion/releases/download/v0.20.0/Markpion-0.20.0-macos-arm64.dmg) · [Intel](https://github.com/nasimuddin-dev/markpion/releases/download/v0.20.0/Markpion-0.20.0-macos-x64.dmg) |
| **Linux** x86_64 | [AppImage](https://github.com/nasimuddin-dev/markpion/releases/download/v0.20.0/Markpion-0.20.0-linux-x86_64.AppImage) (any distribution) · [.deb](https://github.com/nasimuddin-dev/markpion/releases/download/v0.20.0/Markpion-0.20.0-linux-amd64.deb) (Ubuntu, Debian, Mint) · [.rpm](https://github.com/nasimuddin-dev/markpion/releases/download/v0.20.0/Markpion-0.20.0-linux-x86_64.rpm) (Fedora, RHEL, openSUSE) |

### Windows

| Installer | When to use it | Size | SHA-256 |
| --- | --- | --- | --- |
| **Standard**: [Markpion-0.20.0-windows-x64-setup.exe](downloads/Markpion-0.20.0-windows-x64-setup.exe?raw=true) | Recommended. WebView2 is already part of Windows 11 and updated Windows 10; if it's missing, the installer adds it automatically (needs internet) | 7.1 MB | `8472aa864c358c461e488ef3524504a2c1201e40b44bf3cf509f6cdf29be443e` |
| **Offline**: [Markpion-0.20.0-windows-x64-offline-setup.exe](https://github.com/nasimuddin-dev/markpion/releases/download/v0.20.0/Markpion-0.20.0-windows-x64-offline-setup.exe) | Includes WebView2; no internet needed | 212.2 MB | `27b50ff7fa43d92363d98552ecf46a449354409ffddd59df7769d4066e7339f7` |

1. **Download** an installer above.
2. **Run** it and choose **Anyone who uses this computer**, which needs administrator approval, or **Only for me**, which doesn't. The installer isn't code-signed yet, so if Windows SmartScreen says *"Windows protected your PC"*, choose **More info → Run anyway**.
3. **Start** Markpion from the Start menu, or right-click any `.md` file and choose **Open with Markpion**.

The app appears in **Settings → Apps → Installed apps** and in **Control Panel → Programs and Features**, where it can be uninstalled. Newer versions install over older ones, keep your settings, and are offered automatically when the app starts.

### macOS

1. **Download** the `.dmg` for your Mac: **Apple Silicon** for M1 and later, **Intel** for older Macs (Apple menu → About This Mac shows which one you have).
2. **Open** the `.dmg` and drag **Markpion** to **Applications**.
3. **Start** it from Applications. The app isn't notarized by Apple yet, so the first time, macOS blocks it: open **System Settings → Privacy & Security** and choose **Open Anyway**. If macOS says the app *"is damaged"*, run `xattr -dr com.apple.quarantine "/Applications/Markpion.app"` in Terminal once.

### Linux

- **AppImage** (any distribution, no installation needed): download it, run `chmod +x Markpion-*.AppImage`, then start it.
- **Debian, Ubuntu, Mint**: `sudo apt install ./Markpion-0.20.0-linux-amd64.deb` (apt installs the required system libraries automatically).
- **Fedora, RHEL, openSUSE**: `sudo dnf install ./Markpion-0.20.0-linux-x86_64.rpm` (or `sudo zypper install` on openSUSE).

On macOS and Linux, the app tells you when a new version is available and opens its download page.

For requirements, checksum verification, silent install, uninstalling and troubleshooting, see the **[installation guide](docs/INSTALL.md)**.
<!-- download:end -->

## Features

- Optional AI assistant (Claude, by Anthropic; off by default): the AI menu improves, fixes, shortens, summarizes, translates or continues the selected text, follows your own instruction (Ctrl/Cmd+J), or writes new text at the cursor from an instruction alone (Ctrl/Cmd+Shift+J), with a review (editable, undoable; replacements show the changed words) before anything changes. Uses your own API key, stored in Windows Credential Manager / macOS Keychain and only read by the native process, which calls api.anthropic.com directly; asks for consent before the first request
- Create, open, edit, save and Save As Markdown files (`.md`, `.markdown`) with native dialogs
- Windows shell integration: "Open with Markpion" in the right-click menu, listed under Open with and Default apps, Installed apps / Programs and Features entry, install for "Only me" or "Everyone"
- Opens files from the OS: double-click / "Open with" (file association), drag and drop onto the window, and single-instance hand-off
- Paste or drop images into a document: they are saved to an `assets/` folder next to it (or the folder named in Settings → Files) and linked automatically; Format → Insert Image… picks an image file (linked in place when it is already in the document's folder, otherwise copied into `assets/`)
- Git status (read-only): the branch in the status bar and changed files marked M/A/D/R/U/C in the explorer and change bars in the editor gutter for lines added, changed or deleted since the last commit: click one to see the committed lines and revert them, Alt+F5 for the next change (needs Git; Settings → Files)
- Workspace folders with a file explorer (Close Folder button; a resizable Outline below it): new file/folder, duplicate, rename (F2), move (drag and drop onto a folder, or Move To…), link (drag a file into the editor to insert a relative link to it), split (File → Move Selection to New File… moves the selected text into a new file next to the document and links to it), delete to the Trash/Recycle Bin, Reveal in File Explorer, Copy (Relative) Path; renaming or moving offers to update the relative links that pointed to (or from) the file
- Tab context menu: Close Others, Close to the Right, Close Saved, Copy Path, Reveal
- Recent files and folders on the welcome screen and File menu, with per-entry remove and Clear Recent
- Tabs with dirty indicators, a folder hint when two open files share a name (`README.md` · `docs`), and Save / Don't Save / Cancel prompts on close and on quit; Save All; Reopen Closed Tab (Ctrl/Cmd+Shift+T); recent files and folders (File menu and welcome screen)
- Link autocompletion (workspace files after `](`, images after `![](`, headings after `](#`, another document's headings after `](file.md#`, the document's reference labels after `][` and footnotes after `[^`), emoji shortcode completion (`:roc` → 🚀 `:rocket:`) Tab/Shift+Tab to move between table cells (Tab in the last cell adds a row), Table: Insert Row Above/Below, Insert Column Left/Right, Delete Row/Column (the table is reformatted), and Format Table (Ctrl/Cmd+Alt+T) that aligns GFM tables, CJK-aware; Sort Table by Column (A to Z / Z to A) sorts rows by the column under the cursor (numbers numerically, text in natural order, empty cells last)
- Formatting toolbar above the editor (View → Toggle Formatting Toolbar): undo/redo, paragraph style, bold, italic, strikethrough, code, lists, quote, link, image, table (a size picker; inside a table, a Table tools menu for rows, columns, format, sort and CSV), code block, rule, footnote, TOC and an AI menu; paragraph styles Normal text to Heading 6; buttons show the formatting at the cursor
- Format menu and shortcuts: bold (Ctrl/Cmd+B), italic (I), link (K; inside a link it selects the address), Remove Link, inline code (E), strikethrough, headings (Ctrl/Cmd+Alt+1–6), promote/demote heading (Ctrl/Cmd+Alt+= / Ctrl/Cmd+Alt+-), Rename Heading (F2; updates `#anchor` links to it in the document and, after asking, `file.md#anchor` links in the folder's other files; on a footnote or link reference label, F2 renames the label and its uses), Number Headings (1., 1.1, 1.1.1; run again to renumber) and Remove Heading Numbers, Move Section Up/Down (moves a heading with its text and subsections past its neighbour), lists, task lists, check/uncheck task (Ctrl/Cmd+Enter), quotes, code blocks, math (Insert Math Block, Inline Math), Mermaid diagram starters (flowchart, sequence, Gantt, pie), Toggle Comment (Ctrl/Cmd+/: `<!-- … -->`, hidden from the preview and exports), tables and footnotes (Insert Footnote, Ctrl/Cmd+Alt+R: numbered `[^n]` reference with its definition added at the end)
- Ctrl/Cmd+click a link in the editor (or Alt+Enter, Open Link at Cursor) to follow it: web pages open in the browser, `#heading` links and reference links (to their definition) move the cursor, and Markdown files open in a tab at the heading after `#` (the preview's links do that too)
- Hover an image link in the editor to see the picture
- Paste a URL while text is selected to turn the selection into a link: `[selected text](url)`
- Format → Convert Links to Reference Style (`[text][1]` with numbered definitions at the end, shared for equal addresses and titles, existing definitions reused) and Convert Links to Inline Style (removes definitions left unused), for the selection or the whole document
- CodeMirror 6 editor with Markdown syntax highlighting, code-block languages, undo/redo, multi-cursor, code folding (View → Fold All / Unfold All, Fold to Level 1/2/3), find & replace (case-sensitive, regex, whole word) and go to line
- Import Word (.docx), PDF and web pages (.html) as Markdown (headings, lists, tables, links, images saved to assets/ or the folder set for pasted images), and paste rich text from browsers or Word as Markdown
- CSV/TSV tools: import a .csv or .tsv file as an aligned Markdown table, paste cells copied from Excel or Google Sheets as a table, and Copy Table as CSV for spreadsheets
- Convert Folder to Markdown (File menu): converts every Word, PDF, HTML and CSV/TSV file in the open folder to a .md file beside it in one step; files that already have a Markdown version are skipped
- Combine Folder into One Document (File menu): merges every Markdown file in the folder (README/index first, natural order) into `<Folder> (combined).md` with a table of contents; links between the files become in-document links and image paths are re-based. Export it as PDF or Word to share the folder as a single file, or use File → Export Folder as One PDF / One Word Document to do both in one step without writing a combined file. File → Export Folder as HTML Site writes one standalone page per document into a chosen folder (mirrored structure, links rewritten to the pages, images embedded, an index.html contents page)
- Link check (sidebar → Links, or Edit → Check Links in Folder): finds broken links to files, missing images and `file.md#heading` anchors across every Markdown file in the folder. Click a problem to jump to it. The tab also lists the files that link to the open document ("Links to …"), from the same scan
- Automatic updates: at startup, the app checks GitHub for a newer version and offers **Update Now**. It downloads the update, verifies its signature, installs it over the current version and restarts. You can also use Help → Check for Updates, or turn the startup check off in Settings. Nothing else is sent
- Table of contents: Format → Insert / Update Table of Contents builds a linked, nested TOC that stays up to date on save (Settings → Files)
- Change a file's line endings or byte order mark (click LF/CRLF or UTF-8 in the status bar, or the Change Line Endings / Change Encoding commands)
- Copy as Plain Text (File menu): the selection or document without Markdown syntax
- Export as Markdown with Images (.zip): the document plus its local pictures in `images/`, links rewritten
- Export to PDF (selectable text, clickable links, heading bookmarks, tables, task checkboxes, images, Mermaid diagrams, display formulas as pictures on Windows, inline formulas as text with real superscripts and subscripts, footnotes) and to Word (.docx) with real Word headings, numbered/bulleted/task lists, tables, code, links, embedded images, Mermaid diagrams as pictures, LaTeX formulas as native Word equations, native Word footnotes and page numbers; PDF and Word pages are A4 or Letter (automatic from the system region, or chosen in Settings)
- Export to standalone HTML (styled, images inlined, sanitized), Copy as Formatted Text (paste into Word, email or Google Docs), Copy as HTML, and Print / Save as PDF (Ctrl/Cmd+P)
- Custom CSS for documents (Settings → Preview): your own styles for the preview, printing, slides and HTML export, scoped to the document so they never change the app; IT can preset or lock it with managed settings
- Markdown lint in the editor: broken links, missing images, broken anchors, duplicate headings, skipped heading levels, missing alt text and link text, `#Title` without a space, `---` that turns a line into a heading, `-item` without a space in a list, `** bold**` with inner spaces, link or image paths with spaces, table rows that don't match the header, and footnotes or reference links (`[text][id]`) without a definition (or definitions nothing uses), with a Problems panel, F8 / Shift+F8 to move between problems, Don't Show This Check per rule (re-enable in Settings), and quick fixes (Add Blank Line, Add Empty Cells, Add Definition, fix a skipped heading level, correct a misspelled #anchor) and Edit → Fix All Problems
- Dim Other Paragraphs (View menu or Settings): fades all but the paragraph being written
- Line length setting: keep the editor text about 72, 80, 100 or 120 characters wide, centered (Settings → Editor)
- Focus Mode (Ctrl/Cmd+Shift+Enter), Full Screen (F11) and a searchable Keyboard Shortcuts reference (Help menu)
- Preview headings show a link icon on hover that copies their `#anchor`
- Find in the preview (Ctrl/Cmd+F while the preview is shown alone or focused): highlights every match (CSS Custom Highlight API) with a count and next/previous
- Command palette (Ctrl/Cmd+Shift+P), Go to File (Ctrl/Cmd+Alt+O: open any Markdown file in the folder by typing part of its name or path), Go to Heading (Ctrl/Cmd+Alt+H: jump to a heading by typing part of it) and Go to Heading in Folder (Ctrl/Cmd+Shift+Alt+H: headings of every Markdown file in the folder), document outline (drag headings to reorder sections; right-click a heading to copy a link to it or move its section; Alt+Up/Down moves the focused section), and Find in Files across the workspace (Ctrl/Cmd+Shift+F; match case, whole word, regex; files to include/exclude such as `docs, *.draft.md`) with Replace All in Files (confirmation with counts, unsaved files skipped, previous versions kept in File History)
- Mermaid diagrams (lazy-loaded, strict security mode) and LaTeX math (`$…$`, `$$…$$`, rendered as MathML) in the preview and exports
- Live GitHub Flavored Markdown preview (tables, task lists, strikethrough, autolinks, emoji shortcodes such as `:tada:`, fenced code with highlighting) with a configurable debounce. Click a task checkbox in the preview to check or uncheck it in the source (undoable)
- YAML front matter (`---` metadata at the top, as used by Jekyll, Hugo and Obsidian) is shown as a tidy metadata table in the preview, left out of HTML, PDF and Word exports, and its `title` names exported documents
- GitHub alerts (Format → Insert Callout): `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]` render as coloured callouts with icons in the preview and HTML export, and as labelled callouts in PDF and Word
- New from Template (File menu): meeting notes, README, blog post, decision record (ADR), weekly status report, changelog and daily journal, with `{{date}}`, `{{time}}`, `{{week}}` and `{{cursor}}` placeholders. Markdown files in a `templates/` folder of the open workspace appear as templates too
- Editor-only, split and preview-only views, resizable panels and scrolling synced by source line (the preview's blocks carry their line); double-click in the preview to put the cursor on that block's source
- Present as Slides (View menu): the document as full-window slides, split at `---` lines (or at `#`/`##` headings), with keyboard navigation and speaker notes (text after a `Note:` line, shown with N); View → Print Slides prints a slide per landscape page
- Light, dark and system themes; configurable font, font size, line numbers, wrapping and tab size
- Optional auto save (after a delay, or on tab/window focus change) that never overwrites external changes
- Save options: trim trailing whitespace (keeps Markdown hard breaks and code blocks), final newline, default line ending for new files
- Typing `*`, `_`, `` ` ``, `~`, `"`, `(` or `[` with text selected wraps the selection (type `**` for bold)
- Table menu: Fix Table repairs tables typed with mistakes (missing or wrong divider row, missing header, short or long rows, missing outer pipes, a pipe inside code), also from the toolbar's Table tools
- Table → Convert Selection to Table (comma, tab, semicolon or pipe separated text); align and move columns
- Edit menu line tools: Sort Lines (natural order), Remove Duplicate Lines, Join Lines, and Uppercase / Lowercase / Title Case
- Copy button on code blocks in the preview (on hover or keyboard focus)
- Large documents: long previews are built in parts as you scroll to them; live preview pauses above 1 MB of text, with render-on-demand
- Rename a file from its tab (Rename…) or, with no folder open, from the Explorer's Open Files list (F2), with recent files one click away; Open Folder starts in the file's folder
- Compare with File… (File menu, or Compare with Active File in the Explorer): a line diff between the document and another file in the folder, with the changed words within a line marked
- Read-only files open locked (a bar offers Save As or Edit Anyway; formatting commands can't change them either), and View → Toggle Read-Only protects any document from accidental edits
- Local file history: the previous version is kept on every save (30 per file, in app data); browse with a line diff (changed words marked) and restore (undoable); the saved file is listed while there are unsaved changes (review before saving), and the last commit for files in Git
- Safe saves: atomic temp-file writes, conflict detection when a file changed on disk, and actionable errors (permission denied → Save As, disk full, and so on)
- Live folder watching: the explorer and open files update immediately when other programs change files on disk
- External change detection: clean tabs reload automatically; dirty tabs get Reload / Compare / Keep Mine
- Export and import settings and keyboard shortcuts (Settings → Export… / Import…) as `markpion-settings.json`
- Managed settings for IT: a machine-wide `policy.json` (`%ProgramData%\Markpion` on Windows) presets defaults and locks settings such as the AI assistant or the update check
- Crash recovery for unsaved documents, and session restore for the last folder and open files
- Rendering errors are contained: if the preview or another area fails, it shows the error with Try Again while the rest of the window, including saving, keeps working
- UTF-8 (with or without BOM), with LF/CRLF line endings preserved per file
- Word count in the status bar, with a statistics popover (words, characters, lines, paragraphs, reading time) for the document and the selection; task progress (`2/5 tasks`, click for the next open task)
- Spell checking with the system dictionary (Settings)
- Keyboard-first: every core action has a shortcut and an accessible menu, with visible focus states; shortcuts can be changed, removed or reset for any command in Help → Keyboard Shortcuts (conflicts are detected); works with Windows High Contrast (forced colours): selections, active tab, focus and unsaved markers are drawn with outlines in system colours
- Help → Export Diagnostic Logs for support requests (logs never contain document text)
- Runs on Windows, macOS and Linux, with a separate native installer for each (see [Download](#download))

## Security model

- The frontend has **no direct filesystem, dialog or shell permissions** ([capabilities/default.json](src-tauri/capabilities/default.json)). Every native operation goes through validated Rust commands ([src-tauri/src/commands/](src-tauri/src/commands/), one module per domain).
- A path is accessible only after the user selects it in a native dialog, or re-opens it from the backend-owned recent list. Relative paths and `..` traversal are rejected, and symlinks are resolved before the scope check ([scope.rs](src-tauri/src/scope.rs)).
- The preview parses raw HTML and then sanitizes it with GitHub's allow-list. Scripts, event handlers, iframes, forms, styles and `javascript:` URLs are removed. A strict CSP forbids inline scripts.
- Links open in the system browser, and only `http`, `https` and `mailto` links are allowed.
- The app's only own network request is the update check to GitHub (it can be turned off in Settings). Images with `https://` addresses in a document are loaded from the web when it is previewed, like in a browser; plain `http` images are blocked. The CSP allows `connect-src` to `api.github.com` only, and downloaded updates are installed only if their minisign signature matches the public key built into the app.
- Logs record the operation and error category, never document content; the home directory is redacted.

## Development

Prerequisites: **Node.js 22 LTS** (20.19+ works), **Rust (stable)** and the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS: Microsoft C++ Build Tools and WebView2 on Windows, Xcode Command Line Tools on macOS, and `libwebkit2gtk-4.1-dev` and friends on Linux.

```bash
npm install
```

```bash
npm run tauri:dev
```

That runs the desktop app with hot reload. Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | UI only, in a browser, using an in-memory demo workspace (no Rust needed) |
| `npm test` | Frontend unit/component tests (Vitest + Testing Library) |
| `npm run test:e2e` | End-to-end tests (Playwright) against the browser demo; uses the installed Microsoft Edge on Windows |
| `npm run typecheck` | TypeScript type check |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust tests (scope, safe save, encoding, settings, history, search, watcher) |
| `npm run build` | Type check and production build of the frontend (`dist/`) |
| `npm run check:unused` | Finds unused files, exports and dependencies ([knip](https://knip.dev), configured in `knip.json`) |
| `npm run test:fixtures` | Regenerates the sample files the import tests use |
| `npm run tauri:build` | Builds installers for the current OS |
| `npm run version:set <x.y.z>` / `release:installer` / `release:github` | Release pipeline (see [Releasing a new version](#releasing-a-new-version)) |
| `npm run docs:install`, then `docs:dev` / `docs:check` / `docs:test` | The documentation website (see [website/README.md](website/README.md)) |

Continuous integration ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the type check, the unit tests, the production build and the Playwright tests on every push, and the Rust tests on Windows, macOS and Linux.

### Browser demo mode

When it runs outside Tauri, the app uses [`MemoryBackend`](src/services/memoryBackend.ts). This is an in-memory filesystem that enforces the same scope and conflict rules, is seeded with sample documents, and persists to `localStorage`. It makes UI work and tests possible without the native shell.

## Project structure

```text
src/
  components/   UI: MenuBar, FileExplorer, TabBar, Editor, Preview, Outline, StatusBar,
                CommandPalette, SearchPanel, LinkCheckPanel, Settings/History/Shortcuts dialogs,
                AI panel and settings, error boundaries
  features/     Behaviour: documents, workspace, commands & shortcuts, formatting, tables, TOC,
                tasks, templates, import/export, combine, site export, link check, lint, autosave,
                updates, AI assistant
  services/     Backend interface split by domain, with capabilities (Tauri desktop, in-memory
                demo; room for a cloud backend), Markdown pipeline, front matter,
                alerts, HTML export, search, paths, errors
    convert/    Word, PDF, HTML and CSV import; PDF and Word export
  stores/       Zustand stores: documents, workspace, settings, UI, AI
  styles/       App and preview CSS (theme tokens)
  types/        Shared types
src-tauri/
  src/          Rust: commands/ (one module per domain: dialogs, files, workspace, app_data,
                platform, ai), scope (path checks), fs_ops (safe save, trash, move), text
                (encoding), storage (settings, recovery, logs), history, search, watcher,
                open_paths, updater, ai (Claude API, key in the OS credential store)
  capabilities/ Least-privilege permission set
  windows/      NSIS installer hooks (Explorer "Open with Markpion")
tests/          Vitest unit and component tests
e2e/            Playwright workflows and axe-core accessibility audits
scripts/        Versioning and release scripts
downloads/      The latest standard Windows installer and its checksum
docs/           All documentation: design, SRS, requirement traceability, installation guide, development log,
                website spec, and site/ (the pages of the documentation website)
website/        Website tooling: VitePress config, theme and checks (deployed to GitHub Pages)
.github/        CI, the macOS/Linux release workflow and the website deployment
```

## Documentation

| Document | Contents |
| --- | --- |
| [Website](https://nasimuddin-dev.github.io/markpion/) ([source](docs/site/)) | The public user documentation: download, installation, user guide, Markdown reference, FAQ, troubleshooting, changelog, roadmap, blog |
| [docs/DESIGN.md](docs/DESIGN.md) | Core design with diagrams: architecture layers, security boundary, document lifecycle, safe save, recovery, preview and export pipelines, updates, release |
| [docs/INSTALL.md](docs/INSTALL.md) | Installing, updating and uninstalling on Windows, macOS and Linux; troubleshooting |
| [docs/SRS.md](docs/SRS.md) | Software requirements specification (the baseline requirements) |
| [docs/TRACEABILITY.md](docs/TRACEABILITY.md) | Status of every requirement, where it is implemented, and known gaps |
| [docs/DEV_LOG.md](docs/DEV_LOG.md) | Development history: features per session, releases, test counts and next steps |
| [docs/DOCUMENTATION_SITE_SPEC.md](docs/DOCUMENTATION_SITE_SPEC.md) | Requirements for the documentation website |
| [website/README.md](website/README.md) | Maintaining the website: commands, deployment, Google Search Console |

Every feature change updates the README feature list, TRACEABILITY and the matching website guide page (the checklist is in [AGENTS.md](AGENTS.md), which `CLAUDE.md` imports). Every release updates the download section, INSTALL.md, the website changelog and the DEV_LOG; the website's version, download links and keyboard shortcuts update themselves from the app.

## Releasing a new version

```bash
npm run version:set 0.13.0
```

```bash
npm run release:installer -- --offline
```

```bash
npm run release:github
```

1. `version:set` updates the version in `package.json`, `tauri.conf.json` and `Cargo.toml`.
2. `release:installer -- --offline` builds two Windows installers:
   - the **standard** installer (~7 MB) replaces the one in [`downloads/`](downloads/), where only the latest version is kept;
   - the **offline** installer (~210 MB, with the WebView2 runtime) goes to `release-assets/`. It's too large for git, so it's ignored.

   It also writes `SHA256SUMS.txt` and refreshes the download section (Windows, macOS and Linux links) in this README and the links in [docs/INSTALL.md](docs/INSTALL.md).
3. Commit and push, then run `release:github`. It creates or updates the GitHub Release `v<version>` with both installers, the checksums and `latest.json`, using the GitHub CLI (`gh auth login` once). Installed Windows apps pick up the new version automatically on their next start.
4. Creating the release pushes the tag `v<version>`, which starts [.github/workflows/release.yml](.github/workflows/release.yml) on GitHub Actions. It builds the **macOS** (Apple Silicon and Intel `.dmg`) and **Linux** (`.AppImage`, `.deb`, `.rpm`) installers and attaches them to the same release, with `SHA256SUMS-macos-linux.txt`. Follow it with `gh run watch`. To rebuild them for an existing release, run the workflow by hand: `gh workflow run release.yml -f tag=v<version>`.

**Update signing key.** Updates are signed with a minisign key. `release:installer` reads the private key from `~/.tauri/markpion.key`, or from the `TAURI_SIGNING_PRIVATE_KEY` environment variable. The matching public key is in `src-tauri/tauri.conf.json`. **Never commit the private key, and keep a backup somewhere safe.** Installed apps only accept updates signed with this exact key; if it's lost, users would have to reinstall manually once to switch to a new key.

## Packaging and releases

`npm run tauri:build` produces:

- **Windows**: `.msi` and NSIS `.exe` installers (releases ship the NSIS installer, standard and offline)
- **macOS**: `.app` and `.dmg` (Apple Silicon and Intel)
- **Linux**: `.AppImage`, `.deb` and `.rpm` (x86_64)

Each platform has its own installers: Windows ones are built locally by `npm run release:installer` (see above), and macOS and Linux ones are built by [.github/workflows/release.yml](.github/workflows/release.yml) when the version tag is pushed. Without Apple signing secrets, the macOS app is ad-hoc signed; add the `APPLE_*` repository secrets listed in the workflow to sign and notarize it.

Settings, recovery data and logs live in the platform's application-data folders, under the identifier `com.markpion.app`.
