# Markpion

Formerly **Markdown Studio**. A fast, local-first, privacy-conscious Markdown editor for Windows, macOS and Linux, built with **Tauri 2**, **React + TypeScript**, **CodeMirror 6** and the **remark/rehype** ecosystem.

**Website and user documentation: [nasimuddin-dev.github.io/markpion](https://nasimuddin-dev.github.io/markpion/)** (download, installation guides, user guide, Markdown reference, FAQ, troubleshooting, changelog).

The requirements are in [docs/SRS.md](docs/SRS.md), and implementation status per requirement is in [docs/TRACEABILITY.md](docs/TRACEABILITY.md).

## Download

<!-- download:start -->
Markpion 0.15.0 was released on 2026-09-29 and has a separate installer for each operating system. Each one is self-contained: nothing else needs to be installed. All files and checksums are on the [0.15.0 release page](https://github.com/nasimuddin-dev/markpion/releases/tag/v0.15.0).

| Operating system | Download |
| --- | --- |
| **Windows** 10 (1803+) and 11, x64 | [Standard installer](downloads/Markpion-0.15.0-windows-x64-setup.exe?raw=true) (6.9 MB) · [Offline installer](https://github.com/nasimuddin-dev/markpion/releases/download/v0.15.0/Markpion-0.15.0-windows-x64-offline-setup.exe) (212.0 MB) |
| **macOS** 10.15+ | [Apple Silicon (M1 and later)](https://github.com/nasimuddin-dev/markpion/releases/download/v0.15.0/Markpion-0.15.0-macos-arm64.dmg) · [Intel](https://github.com/nasimuddin-dev/markpion/releases/download/v0.15.0/Markpion-0.15.0-macos-x64.dmg) |
| **Linux** x86_64 | [AppImage](https://github.com/nasimuddin-dev/markpion/releases/download/v0.15.0/Markpion-0.15.0-linux-x86_64.AppImage) (any distribution) · [.deb](https://github.com/nasimuddin-dev/markpion/releases/download/v0.15.0/Markpion-0.15.0-linux-amd64.deb) (Ubuntu, Debian, Mint) · [.rpm](https://github.com/nasimuddin-dev/markpion/releases/download/v0.15.0/Markpion-0.15.0-linux-x86_64.rpm) (Fedora, RHEL, openSUSE) |

### Windows

| Installer | When to use it | Size | SHA-256 |
| --- | --- | --- | --- |
| **Standard**: [Markpion-0.15.0-windows-x64-setup.exe](downloads/Markpion-0.15.0-windows-x64-setup.exe?raw=true) | Recommended. WebView2 is already part of Windows 11 and updated Windows 10; if it's missing, the installer adds it automatically (needs internet) | 6.9 MB | `06377f7c4461c2865afb7c0b790dc840d944c7bfa0755c0908a8a140f2490d8b` |
| **Offline**: [Markpion-0.15.0-windows-x64-offline-setup.exe](https://github.com/nasimuddin-dev/markpion/releases/download/v0.15.0/Markpion-0.15.0-windows-x64-offline-setup.exe) | Includes WebView2; no internet needed | 212.0 MB | `0e0bfafb850d2bf477b10eeee9976ec940c5c0a73527a29bed48124b2dbca395` |

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
- **Debian, Ubuntu, Mint**: `sudo apt install ./Markpion-0.15.0-linux-amd64.deb` (apt installs the required system libraries automatically).
- **Fedora, RHEL, openSUSE**: `sudo dnf install ./Markpion-0.15.0-linux-x86_64.rpm` (or `sudo zypper install` on openSUSE).

On macOS and Linux, the app tells you when a new version is available and opens its download page.

For requirements, checksum verification, silent install, uninstalling and troubleshooting, see the **[installation guide](docs/INSTALL.md)**.
<!-- download:end -->

## Features

- Create, open, edit, save and Save As Markdown files (`.md`, `.markdown`) with native dialogs
- Windows shell integration: "Open with Markpion" in the right-click menu, listed under Open with and Default apps, Installed apps / Programs and Features entry, install for "Only me" or "Everyone"
- Opens files from the OS: double-click / "Open with" (file association), drag and drop onto the window, and single-instance hand-off
- Paste or drop images into a document: they are saved to an `assets/` folder next to it and linked automatically
- Workspace folders with a file explorer: new file/folder, duplicate, rename (F2), delete to the Trash/Recycle Bin, Reveal in File Explorer, Copy (Relative) Path
- Tab context menu: Close Others, Close to the Right, Close Saved, Copy Path, Reveal
- Tabs with dirty indicators, and Save / Don't Save / Cancel prompts on close and on quit; Save All; Reopen Closed Tab (Ctrl/Cmd+Shift+T); recent files and folders (File menu and welcome screen)
- Link autocompletion (workspace files after `](`, images after `![](`, headings after `](#`), emoji shortcode completion (`:roc` → 🚀 `:rocket:`) Tab/Shift+Tab to move between table cells (Tab in the last cell adds a row), Table: Insert Row Above/Below, Insert Column Left/Right, Delete Row/Column (the table is reformatted), and Format Table (Ctrl/Cmd+Alt+T) that aligns GFM tables, CJK-aware; Sort Table by Column (A to Z / Z to A) sorts rows by the column under the cursor (numbers numerically, text in natural order, empty cells last)
- Format menu and shortcuts: bold (Ctrl/Cmd+B), italic (I), link (K), inline code (E), strikethrough, headings (Ctrl/Cmd+Alt+1–3), promote/demote heading (Ctrl/Cmd+Alt+= / Ctrl/Cmd+Alt+-), Move Section Up/Down (moves a heading with its text and subsections past its neighbour), lists, task lists, check/uncheck task (Ctrl/Cmd+Enter), quotes, code blocks, tables and footnotes (Insert Footnote, Ctrl/Cmd+Alt+R: numbered `[^n]` reference with its definition added at the end)
- Paste a URL while text is selected to turn the selection into a link: `[selected text](url)`
- CodeMirror 6 editor with Markdown syntax highlighting, code-block languages, undo/redo, multi-cursor, code folding (View → Fold All / Unfold All), find & replace (case-sensitive, regex, whole word) and go to line
- Import Word (.docx), PDF and web pages (.html) as Markdown (headings, lists, tables, links, images saved to assets/), and paste rich text from browsers or Word as Markdown
- CSV/TSV tools: import a .csv or .tsv file as an aligned Markdown table, paste cells copied from Excel or Google Sheets as a table, and Copy Table as CSV for spreadsheets
- Convert Folder to Markdown (File menu): converts every Word, PDF, HTML and CSV/TSV file in the open folder to a .md file beside it in one step; files that already have a Markdown version are skipped
- Combine Folder into One Document (File menu): merges every Markdown file in the folder (README/index first, natural order) into `<Folder> (combined).md` with a table of contents; links between the files become in-document links and image paths are re-based. Export it as PDF or Word to share the folder as a single file, or use File → Export Folder as One PDF / One Word Document to do both in one step without writing a combined file. File → Export Folder as HTML Site writes one standalone page per document into a chosen folder (mirrored structure, links rewritten to the pages, images embedded, an index.html contents page)
- Link check (sidebar → Links, or Edit → Check Links in Folder): finds broken links to files, missing images and `file.md#heading` anchors across every Markdown file in the folder. Click a problem to jump to it
- Automatic updates: at startup, the app checks GitHub for a newer version and offers **Update Now**. It downloads the update, verifies its signature, installs it over the current version and restarts. You can also use Help → Check for Updates, or turn the startup check off in Settings. Nothing else is sent
- Table of contents: Format → Insert / Update Table of Contents builds a linked, nested TOC that stays up to date on save (Settings → Files)
- Export to PDF (selectable text, clickable links, heading bookmarks, tables, task checkboxes, images, Mermaid diagrams, display formulas as pictures on Windows, inline formulas as text with real superscripts and subscripts, footnotes) and to Word (.docx) with real Word headings, numbered/bulleted/task lists, tables, code, links, embedded images, Mermaid diagrams as pictures, LaTeX formulas as native Word equations, native Word footnotes and page numbers; PDF and Word pages are A4 or Letter (automatic from the system region, or chosen in Settings)
- Export to standalone HTML (styled, images inlined, sanitized), Copy as Formatted Text (paste into Word, email or Google Docs), Copy as HTML, and Print / Save as PDF (Ctrl/Cmd+P)
- Markdown lint in the editor: broken links, missing images, broken anchors, duplicate headings, skipped heading levels and missing alt text, with a Problems panel
- Focus Mode (Ctrl/Cmd+Shift+Enter), Full Screen (F11) and a searchable Keyboard Shortcuts reference (Help menu)
- Command palette (Ctrl/Cmd+Shift+P), Go to File (Ctrl/Cmd+Alt+O: open any Markdown file in the folder by typing part of its name or path), document outline (drag headings to reorder sections; right-click a heading to copy a link to it or move its section; Alt+Up/Down moves the focused section), and Find in Files across the workspace (Ctrl/Cmd+Shift+F; match case, whole word, regex) with Replace All in Files (confirmation with counts, unsaved files skipped, previous versions kept in File History)
- Mermaid diagrams (lazy-loaded, strict security mode) and LaTeX math (`$…$`, `$$…$$`, rendered as MathML) in the preview and exports
- Live GitHub Flavored Markdown preview (tables, task lists, strikethrough, autolinks, emoji shortcodes such as `:tada:`, fenced code with highlighting) with a configurable debounce. Click a task checkbox in the preview to check or uncheck it in the source (undoable)
- YAML front matter (`---` metadata at the top, as used by Jekyll, Hugo and Obsidian) is shown as a tidy metadata table in the preview, left out of HTML, PDF and Word exports, and its `title` names exported documents
- GitHub alerts: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]` render as coloured callouts with icons in the preview and HTML export, and as labelled callouts in PDF and Word
- New from Template (File menu): meeting notes, README, blog post, decision record (ADR), weekly status report, changelog and daily journal, with `{{date}}`, `{{time}}`, `{{week}}` and `{{cursor}}` placeholders. Markdown files in a `templates/` folder of the open workspace appear as templates too
- Editor-only, split and preview-only views, resizable panels and synced scrolling
- Light, dark and system themes; configurable font, font size, line numbers, wrapping and tab size
- Optional auto save (after a delay, or on tab/window focus change) that never overwrites external changes
- Save options: trim trailing whitespace (keeps Markdown hard breaks and code blocks), final newline, default line ending for new files
- Large-document mode: live preview pauses above 1 MB of text, with render-on-demand
- Local file history: the previous version is kept on every save (30 per file, in app data); browse with a line diff and restore (undoable)
- Safe saves: atomic temp-file writes, conflict detection when a file changed on disk, and actionable errors (permission denied → Save As, disk full, and so on)
- Live folder watching: the explorer and open files update immediately when other programs change files on disk
- External change detection: clean tabs reload automatically; dirty tabs get Reload / Compare / Keep Mine
- Crash recovery for unsaved documents, and session restore for the last folder and open files
- Rendering errors are contained: if the preview or another area fails, it shows the error with Try Again while the rest of the window, including saving, keeps working
- UTF-8 (with or without BOM), with LF/CRLF line endings preserved per file
- Word count in the status bar, with a statistics popover (words, characters, lines, paragraphs, reading time) for the document and the selection
- Spell checking with the system dictionary (Settings)
- Keyboard-first: every core action has a shortcut and an accessible menu, with visible focus states
- Help → Export Diagnostic Logs for support requests (logs never contain document text)
- Runs on Windows, macOS and Linux, with a separate native installer for each (see [Download](#download))

## Security model

- The frontend has **no direct filesystem, dialog or shell permissions** ([capabilities/default.json](src-tauri/capabilities/default.json)). Every native operation goes through validated Rust commands ([src-tauri/src/commands.rs](src-tauri/src/commands.rs)).
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
                CommandPalette, SearchPanel, LinkCheckPanel, Settings/History/Shortcuts dialogs
  features/     Behaviour: documents, workspace, commands & shortcuts, formatting, tables, TOC,
                tasks, templates, import/export, combine, link check, lint, autosave, updates
  services/     Backend abstraction (Tauri + in-memory demo), Markdown pipeline, front matter,
                alerts, HTML export, search, paths, errors
    convert/    Word, PDF, HTML and CSV import; PDF and Word export
  stores/       Zustand stores: documents, workspace, settings, UI
  styles/       App and preview CSS (theme tokens)
  types/        Shared types
src-tauri/
  src/          Rust: commands, scope (path checks), fs_ops (safe save, trash), text (encoding),
                storage (settings, recovery, logs), history, search, watcher, open_paths, updater
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

Every feature change updates the README feature list, TRACEABILITY and the matching website guide page (the checklist is in [CLAUDE.md](CLAUDE.md)). Every release updates the download section, INSTALL.md, the website changelog and the DEV_LOG; the website's version, download links and keyboard shortcuts update themselves from the app.

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
