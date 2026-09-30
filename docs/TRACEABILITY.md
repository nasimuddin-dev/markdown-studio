# Requirements Traceability

Status of each [SRS](SRS.md) requirement as of version 0.20.0. **Done** means implemented and tested (automated or manual). **Partial** means some of it is implemented and the gap is noted. **Planned** means it's scheduled for the release named in the SRS.

## Functional requirements

| ID | Status | Implementation / notes |
| --- | --- | --- |
| FR-001 | Done | Tauri 2 native shell ([src-tauri/src/lib.rs](../src-tauri/src/lib.rs)) |
| FR-002 | Done | Startup time is logged (`app.ready`); UI renders before async restore |
| FR-003 | Done | `tauri-plugin-window-state` (size/position), theme and settings, panel sizes, last session |
| FR-004 | Done | Dirty documents snapshotted every 5 s to app-data `recovery/session.json`; restore offered on the next launch ([lifecycle.ts](../src/features/lifecycle.ts)) |
| FR-010 | Done | Native Open dialog through Rust (`pick_open_file`) |
| FR-011 | Done | Native folder dialog (`pick_open_folder`) |
| FR-012 | Done | Lazy tree of folders and `.md`/`.markdown` files; hidden and dependency folders skipped |
| FR-013 | Done | New File (Ctrl/Cmd+N), New File in Folder |
| FR-014 | Done | Save (Ctrl/Cmd+S), atomic write |
| FR-015 | Done | Save As (Ctrl/Cmd+Shift+S) |
| FR-016 | Done | Rename from context menu or F2; open tabs follow the rename. Also Duplicate (first free "name copy.md", never overwrites) |
| FR-017 | Done | Delete with confirmation; moves to the OS Trash (`trash` crate) |
| FR-018 | Done | mtime conflict check on save, plus polling and focus checks with Reload / Compare / Keep Mine |
| FR-020 | Done | CodeMirror Markdown language with nested code-block languages; folding (View → Fold All / Unfold All, Fold to Level 1–3: `features/foldLevel.ts`); formatting commands ([formatting.ts](../src/features/formatting.ts)), including heading promote/demote |
| FR-021 | Done | Per-tab undo history (state preserved across tab switches) |
| FR-022 | Done | CodeMirror default keymap and native clipboard |
| FR-023 | Done | Ln/Col in the status bar; Go to Line (Ctrl/Cmd+G) |
| FR-024 | Done | Tab dot and "(unsaved)" label, window title marker, status bar text |
| FR-025 | Done | Font size, font family, line numbers, wrapping, tab size |
| FR-026 | Done | UTF-8 with BOM preservation; invalid UTF-8 refused rather than corrupted |
| FR-030 | Done | react-markdown preview |
| FR-031 | Done | Debounce 0–1000 ms (Settings) |
| FR-032 | Done | remark-gfm; task checkboxes in the preview toggle the source ([tasks.ts](../src/features/tasks.ts)) |
| FR-033 | Done | rehype-highlight (highlight.js common languages) |
| FR-034 | Done | rehype-raw followed by rehype-sanitize (GitHub schema), plus CSP |
| FR-035 | Done | Editor / Split / Preview (Ctrl/Cmd+1/2/3, Ctrl/Cmd+\\) |
| FR-040 | Done | Tabs with drag reordering |
| FR-041 | Done | Accent bar, bold label, `aria-selected` |
| FR-042 | Done | Save / Don't Save / Cancel on tab close and window close |
| FR-043 | Done | Ctrl+Tab / Ctrl+Shift+Tab, arrow keys in the tab list; Reopen Closed Tab (Ctrl/Cmd+Shift+T) |
| FR-044 | Done | Backend-owned recent files and folders (File menu, Welcome screen); session restore of the last folder and open files |
| FR-050 | Done | CodeMirror search panel |
| FR-051 | Done | Replace / Replace All (Ctrl+H, or Cmd+Alt+F on macOS) |
| FR-052 | Done | Match-case toggle |
| FR-053 | Done | Regex toggle (delivered early) |
| FR-060 | Done | Light / Dark / System |
| FR-061 | Done | Font size setting and zoom shortcuts |
| FR-062 | Done | Settings saved to `settings.json` |
| FR-063 | Done | Tauri `app_config_dir()` |

## Non-functional and security requirements

| ID | Status | Notes |
| --- | --- | --- |
| NFR-001/002 | Done | CodeMirror virtualised rendering; debounced preview; long documents' previews render in chunks near the viewport (`components/PreviewChunks.tsx`); live preview pauses above 1 MB (render on demand). The preview pipeline, exporters and Mermaid are lazy-loaded. A benchmark for very large files is still to be added |
| NFR-003 | Done | Measured at startup and logged |
| NFR-004 | Done | Save failures keep the document dirty; errors are shown as toasts or dialogs |
| NFR-005 | Done | No network access is required |
| NFR-006 | Done | A separate installer for each OS on every release: Windows NSIS (standard and offline) built by `scripts/release-installer.mjs`; macOS `.dmg` (Apple Silicon, Intel) and Linux `.AppImage`/`.deb`/`.rpm` built by [release.yml](../.github/workflows/release.yml). Rust tests run on all three in CI |
| NFR-007 | Done | Scope enforced in Rust ([scope.rs](../src-tauri/src/scope.rs)) |
| NFR-008 | Done | No telemetry; content never leaves the machine |
| NFR-009 | Done | Modular services and stores; Vitest and Rust tests |
| NFR-010 | Done | Keyboard menus, tree, tabs and dialogs; focus rings; automated axe-core WCAG 2.1 AA audit (light and dark) in e2e, covering the editor gutters, menus, context menus, find/replace, Problems, Links, Go to File, templates, About, unsaved-changes and File History dialogs, slides and the Git pop-up |
| NFR-011 | Done | Documented in [INSTALL.md](INSTALL.md): Windows 10 1803+ and 11 (x64), macOS 10.15+ (Apple Silicon and Intel), Linux x86_64 distributions from 2022 (Ubuntu 22.04+, Debian 12+, Fedora 36+). ARM64 Windows/Linux are not built yet |
| SEC-001 | Done | The capability grants only `core:default`, set-title, destroy and full-screen; no filesystem, dialog or shell permissions ([default.json](../src-tauri/capabilities/default.json)) |
| SEC-002/003 | Done | Absolute paths only, `..` rejected, canonicalised scope check |
| SEC-004 | Done | Sanitisation tests in [markdown.test.tsx](../tests/markdown.test.tsx) |
| SEC-005 | Done | `open_external` accepts only http, https and mailto |
| SEC-006/007 | N/A | No AI or secrets in the MVP |
| SEC-008 | Partial | Updates are minisign-signed and verified. Installers aren't code-signed yet: Windows needs an Authenticode certificate; macOS is ad-hoc signed until an Apple Developer ID is added as `APPLE_*` secrets (the workflow then signs and notarizes) |
| UPD-001, UPD-002, UPD-004 | Done | `features/updates.ts`: a check on every startup (optional; Settings → Startup) and Help → Check for Updates. Shows the current and available versions, with Update Now, Later and Skip This Version. Where no in-place update exists for the platform (macOS, Linux), it offers the release page instead. Tests: `tests/updates.test.ts` |
| UPD-003, UPD-005, UPD-006 | Done (Windows) | `src-tauri/src/updater.rs` uses `tauri-plugin-updater`. `latest.json` on the latest GitHub Release points to the NSIS installer. The installer's minisign signature is verified against the public key in `tauri.conf.json` before it runs. Unsaved documents are saved first. On any failure the running version is unchanged. Verified end to end on Windows: a tampered manifest is rejected, and a signed update installs in place and relaunches |

## Beyond the MVP (delivered early)

| Feature | Where | SRS reference |
| --- | --- | --- |
| Upgrade from Markdown Studio (the old name): settings, recent files, recovery and history are copied from the old `com.markdownstudio.app` folder on first start, and the Windows installer silently removes the old install and recreates the Start menu and desktop shortcuts it took with it (once; installs already updated to 0.14.0 are repaired by the next update) | `src-tauri/src/storage.rs` (`migrate_legacy_dir`), `src-tauri/windows/hooks.nsh` (`NSIS_HOOK_PREINSTALL`, `MS_RESTORE_SHORTCUTS`) | §13 upgrade, FR-062 |
| Custom CSS for documents: applied to the preview, print, slides, HTML and HTML-site export; parsed by the browser and rebuilt with every selector under `.markdown-body` (stray braces can't escape; `@import` and unknown at-rules dropped; `</` escaped in exports); managed settings can preset or lock it | `services/customCss.ts`, `components/CustomDocumentCss.tsx`, `services/exportHtml.ts` | §10 customization, §11 security |
| Export and import settings and shortcuts as `markpion-settings.json` (validated; session and AI consent excluded; managed settings kept) | `features/settingsTransfer.ts`, `SettingsDialog.tsx`, Rust `export_file`/`pick_import_file` json kind | FR-060 settings |
| Customizable keyboard shortcuts: change, remove or reset any command's shortcut (conflicts detected), applied live to menus, the global handler and the editor keymap | `features/commands.ts` (`applyKeybindings`, `commandWithShortcut`), `components/ShortcutsDialog.tsx`, `Editor.tsx` (keymap compartment), settings `keybindings` | §14 keyboard shortcuts |
| Windows High Contrast / forced colours: states shown by colour or shadow get outlines and borders in system colours (selection, active tab, focus, editor selection, unsaved dots); e2e test checks outlines and runs axe in forced colours | `styles/app.css` (`@media (forced-colors: active)`), `e2e/accessibility.spec.ts` | §15 accessibility |
| Managed settings for IT: a machine-wide `policy.json` presets defaults and locks settings (shown as managed, can't be changed); invalid policies are logged and ignored | `src-tauri/src/storage.rs` (`read_policy`, `policy_path`), `commands/app_data.rs` (`load_policy`), `stores/policy.ts`, `settingsStore.ts`, `SettingsDialog.tsx` | §11 enterprise deployment |
| Optional AI assistant (Claude): improve, fix grammar, shorten, summarize, continue, translate, ask; review before applying (replacements show a Changes diff with changed words marked, or the Original); own API key in the OS credential store, requests from the native process only, consent before the first request | `src-tauri/src/ai.rs`, `commands.rs` (`ai_status`, `ai_set_key`, `ai_complete`), `features/ai.ts`, `stores/aiStore.ts`, `components/AiPanel.tsx`, `AiSettings.tsx` | §19 AI writing assistant (optional, with consent) |
| Move files and folders in the explorer: drag onto a folder or Move To… (keyboard); never replaces; open tabs follow | `components/FileExplorer.tsx`, `features/workspace.ts` (`moveEntry`, `moveEntryTo`), Rust `move_path` (`fs_ops::move_into`, scope-checked) | FR-017 file management |
| Table rows and columns (also align and move columns): Tab/Shift+Tab between cells (a new row after the last), insert above/below and left/right, delete row/column at the cursor (Format menu), reformatting the table | `features/tables.ts` | §19 table editing |
| Window background matches the theme from the first frame (the main window is created in `setup` with a dark or light background), so a slow first start isn't a white window | `src-tauri/src/lib.rs` (`window_background`) | NFR-001 perceived startup |
| Contained rendering errors: each area (editor, preview, sidebar, tab bar, status bar) shows an error with Try Again instead of the whole window going blank; a window-level fallback saves the recovery snapshot and reloads; errors go to the diagnostic log | `components/ErrorBoundary.tsx`, `App.tsx`, `main.tsx`, `features/lifecycle.ts` (`saveRecoveryNow`) | §12 reliability, FR-004 |
| Export Folder as HTML Site: a page per document, links between documents rewritten to the pages, images embedded, an index.html contents page; asks before replacing files | `features/siteExport.ts`, Rust `pick_export_folder` and `ensure_folder` (scope-checked) | §19 publishing workflows |
| GitHub emoji shortcodes (`:tada:`) in the preview, HTML and Word exports (PDF keeps the text), with shortcode completion in the editor | `services/markdown.ts` (remark-gemoji), `convert/toDocx.ts`, `features/completion.ts` (`emojiCompletionSource`) | FR-032 GFM compatibility |
| Document properties from front matter (`title`, `author`, `description`, `keywords`) in PDF, Word and HTML exports | `services/frontMatter.ts` (`frontMatterMetadata`), `toPdf.ts`, `toDocx.ts`, `exportHtml.ts` | §12 export |
| Export page size (A4 or Letter; automatic from the system region) for PDF and Word | `services/convert/pageSize.ts`, `toPdf.ts`, `toDocx.ts`, Settings → Export | §12 export options |
| Drag a file from the Explorer into the editor to insert a relative link (image link for pictures; `fileLinkMarkdown`, `insertFileLinkAt`) instead of moving it | `components/FileExplorer.tsx`, `features/pathActions.ts` | FR-017 file management, §17 links |
| Rename Heading (F2, Format menu, Outline menu): renames the heading and its `#anchor` links in one edit, remaps anchors of later same-text headings, and offers to update `file.md#anchor` links in the workspace's other Markdown files (shared `rewriteWorkspaceLinks` with move/rename link updates; unsaved files skipped) | `features/renameHeading.ts`, `features/linkUpdate.ts` | §19 document outline and navigation |
| Document outline, with Copy Link to Heading / Copy Markdown Link and moving sections (drag and drop, context menu, Alt+Up/Down) | `components/Outline.tsx`, `features/outline.ts`, `features/sections.ts` | §19 document outline and navigation |
| Mermaid diagrams and LaTeX math (preview, exports; native Word equations) | `components/MermaidDiagram.tsx`, `services/markdown.ts`, `services/convert/latex.ts`, `omml.ts`, `services/mathImage.ts` | §18 v0.3 |
| Markdown lint with a Problems panel (links, anchors, headings including `#Title` without a space and `---` under text, list items without a space, `**` with inner spaces (markers paired left to right, backslash escapes counted), link and image paths with spaces; `tests/lintDocs.test.ts` requires the project's own docs to have no findings, alt and link text, table column counts as GFM counts them, footnote definitions, reference-link definitions (`[text][id]`, `[id][]`; labels matched case-insensitively, a bare `[id]` counts as a use but isn't flagged)) and quick fixes (`ProblemFix` as CodeMirror lint actions); each check can be turned off (`lintDisabledRules`, Settings list with Show Again, policy-lockable); F8 / Shift+F8 move between problems | `features/lint.ts`, `features/lintExtension.ts` | §19 Markdown linting |
| Workspace link check (files, images, anchors), and "Links to this document" (incoming links between Markdown files from the same scan; images and self-links excluded) | `features/linkCheck.ts`, `components/LinkCheckPanel.tsx` | §19 Markdown linting |
| Compare with File (palette pick or Explorer context menu) as a line diff, sharing the diff view with File History (`components/CompareDialog.tsx`, `DiffView.tsx`); removed lines come before added ones, and paired changed lines get a word-level diff (`wordDiff`, `pairedWordDiffs` in `features/diff.ts`; skipped when the lines share under a third of their words). Local file history with diff and restore; also the saved file while there are unsaved changes, and the last Git commit for tracked files | `src-tauri/src/history.rs`, `components/HistoryDialog.tsx` | §19 version history and snapshots |
| Print adds the title and page numbers to each page (CSS page margin boxes; Chromium/WebView2 only; e2e renders to PDF and checks the text). Export to HTML, PDF and Word (with footnotes: a Footnotes section in PDF, native footnotes in Word; Mermaid diagrams drawn as pictures); Copy as Formatted Text and Copy as HTML; Print | `services/exportHtml.ts`, `services/convert/toPdf.ts`, `toDocx.ts`, `footnotes.ts` | §19 export to HTML and PDF |
| Import Word, PDF, HTML and CSV/TSV (links to headings, Word TOC bookmarks or web-page heading ids, become Markdown heading anchors; Word export makes headings bookmarks and PDF export makes them named destinations, so `#anchor` links jump in Word and PDF); paste rich text and spreadsheet cells | `services/convert/`, `features/importing.ts`, `features/richPaste.ts` | §5 technical writer needs |
| Convert a folder to Markdown; combine a folder into one document; export a folder as one PDF or Word file | `features/batchConvert.ts`, `features/combine.ts`, `features/exporting.ts` | §19 publishing workflows |
| YAML front matter table, GitHub alerts | `services/frontMatter.ts`, `services/alerts.ts` | §10.1 front-matter-aware documents; §18 v0.3 enhanced Markdown |
| Templates, table of contents, table formatting, sort table by column, convert selected CSV/TSV text to a table, Fix Table (`fixTable`: divider, header, cell counts, outer pipes, pipes in code; also offered in the toolbar's Table tools for tables the parser doesn't recognise), heading promote/demote, number headings (`headingNumbers.ts`: 1./1.1, lone H1 title skipped, only dotted numbers treated as existing, TOC refreshed in the same edit), move section up/down (`sections.ts`), task checkboxes (click in the preview or Ctrl/Cmd+Enter), footnotes, paste URL as link, follow links from the editor (Ctrl/Cmd+click, Alt+Enter; `followLink.ts`, shared with the preview's links, which now open `file.md#heading` at the heading), convert links between inline and reference style (`referenceLinks.ts`), link completion (files, headings, another document's headings after `](file.md#`, and reference labels after `][` and footnotes after `[^`: `referenceCompletionSource`) | `features/templates.ts`, `toc.ts`, `tables.ts`, `formatting.ts`, `tasks.ts`, `completion.ts`, `referenceLinks.ts`, `followLink.ts` | §18 v0.3 enhanced Markdown and customization |
| Find in the preview (Ctrl/Cmd+F when the preview is alone or focused): text ranges across elements, case-insensitive, up to 1,000, highlighted with the CSS Custom Highlight API (selection fallback), re-run on preview changes | `components/PreviewFind.tsx`, `features/commands.ts` (`findInPreview`) | FR-050 find |
| Find in Files and Replace in Files (with files to include/exclude: comma-separated globs, same rules in Rust `PathFilter` and `services/pathFilter.ts`), command palette, Go to File, Go to Heading, Go to Heading in Folder (`collectFolderHeadings`), keyboard shortcuts reference, focus mode | `components/SearchPanel.tsx`, `features/replaceInFiles.ts`, `CommandPalette.tsx`, `ShortcutsDialog.tsx` | §5 power user needs |
| Editor reading aids: typewriter scrolling (the cursor line kept in the middle) and line length (`editorLineLength`: 72/80/100/120 characters, centered with scroller padding; full width when the pane is narrower) | `components/Editor.tsx` (`appearanceExt`), `stores/settingsStore.ts` | §15 usability |
| Update links after renaming or moving a file or folder in the explorer (inline links, images, reference definitions and HTML links/images; asks first; skips unsaved files; keeps File History). Link check and lint also cover reference definitions and HTML `<a href>`/`<img src>` (entities such as `&amp;` decoded, and kept when rewritten) | `features/linkUpdate.ts`, `features/workspace.ts`, `features/lint.ts` (`findAllLinks`) | FR-017 file management, §17 links |
| Rename from a tab or, without an open folder, from the Explorer's Open Files list; a file approved on its own may be renamed within its folder (`Scope::check_rename_target`: never overwrites, approval moves with it); recent entries follow renames and moves; Open Containing Folder starts the folder dialog there | `src-tauri/src/scope.rs`, `features/pathActions.ts`, `components/FileExplorer.tsx`, `components/TabBar.tsx` | FR-016 rename, §11 security |
| Read-only documents: files read-only on disk open locked (`FileContent.readOnly` from Rust metadata), Toggle Read-Only for any document; CodeMirror `readOnly` plus a change filter (commands blocked, reloads allowed) and a store guard; banner with Save As / Edit Anyway; status bar state | `src-tauri/src/fs_ops.rs`, `components/Editor.tsx`, `components/ChangeBanner.tsx`, `features/documents.ts` | FR-024 dirty state, §12 reliability |
| Edit menu line tools: sort lines (natural order), remove duplicate lines, join lines, upper/lower/title case; selected lines or whole document, one undo step. Typing a Markdown mark, quote or bracket with text selected wraps the selection | `features/textTransforms.ts`, `features/surround.ts` | §15 usability (editing beyond FR-022) |
| Copy button on preview code blocks (hover or keyboard focus; not in exports) | `components/Preview.tsx` (`CodeBlock`) | FR-030 preview, §15 usability |
| Scroll sync by source line: top-level preview blocks carry `data-line` (and chunk placeholders their first line); each side maps its top to a fractional source line and back by interpolating between blocks, proportional at the very top and bottom or with no blocks; double-click in the preview (split view) reveals the block's line at the same height. Display math blocks (KaTeX) have no source position and are interpolated over | `services/sourceLines.ts`, `features/scrollSync.ts`, `components/Preview.tsx`, `Editor.tsx` | FR-035 split view, §15 usability |
| Present as Slides: full-window slides split at `---` (or `#`/`##` headings), speaker notes after `Note:` (N), keyboard navigation, links open outside the app | `features/slides.ts`, `components/SlideShow.tsx` | §19 future enhancements (publishing) |
| Formatting toolbar: word-processor-style groups over existing commands, pressed state from the syntax tree at the cursor, Heading 1–6 styles, a table size picker, Table tools menu inside a table, WAI-ARIA toolbar keyboard pattern, View toggle | `components/Toolbar.tsx`, `features/formatState.ts` | §8 user interface, §15 usability |
| Git status (read-only): branch, ahead/behind and changed files in the explorer; change bars in the editor gutter (added, changed, deleted lines against `HEAD`, from `git show HEAD:./file` with a Scope check, compared in the editor, off above 1 MB), with a pop-up of the committed lines and Revert, Next/Previous Change; `git status` with fsmonitor off, 10 s timeout, setting to turn off | `src-tauri/src/git.rs`, `features/git.ts`, `features/gitGutter.ts`, `stores/gitStore.ts` | §19 Git integration and source-control status |
| Close Folder button in the explorer; resizable Explorer/Outline split; remove recent entries and Clear Recent | `components/FileExplorer.tsx`, `App.tsx` (`ExplorerAndOutline`), `features/recent.ts` | FR-044 recent files, §15 usability |
| Paste or drop images into an `assets/` folder; Format → Insert Image… (links images inside the document's folder in place, copies others into `assets/`) | `features/images.ts`, Rust `pick_import_file` ("image") | §17.2 images |
| Open from OS (file association, single instance, drag and drop), Explorer "Open with" | `src-tauri/src/open_paths.rs`, `src-tauri/windows/hooks.nsh` | §13 packaging and desktop integration |
| Live folder watching | `src-tauri/src/watcher.rs`, `features/watch.ts` | FR-018 |
| Auto save, save options (trim whitespace, final newline, line endings), large-document mode | `features/autosave.ts`, `features/saveTransforms.ts` | §10.2, NFR-002 |
| Separate installers per OS on every release, offline Windows installer with WebView2 | `scripts/`, `.github/workflows/release.yml` | §13 packaging |
| Documentation and product website (47 pages: download, installation per OS, user guide, Markdown reference, troubleshooting, FAQ, changelog, roadmap, blog) with SEO, sitemap and structured data; version, downloads and shortcut tables generated from the app | `website/`, `.github/workflows/documentation.yml` | §13.4 distribution website, §15 usability |
| Host-independent UI: every desktop-specific call (files, dialogs, window title, full screen, close guard, AI) goes through the `Backend` interface, so a web or cloud host can be added as one more implementation; dead-code check (`npm run check:unused`); agent/contributor guide | `services/backend.ts`, `services/tauriBackend.ts`, `services/memoryBackend.ts`, `knip.json`, `AGENTS.md` | §9 technical architecture, §19 future enhancements (web version) |

## Test coverage

| Level | Where | Count (0.20.0) |
| --- | --- | --- |
| Unit and component | `tests/` (Vitest, Testing Library, jsdom) | 407 tests in 68 files |
| End-to-end and accessibility | `e2e/` (Playwright; axe-core WCAG 2.1 AA audits in light and dark themes) | 54 tests |
| Rust | `#[cfg(test)]` modules in `src-tauri/src/` | 41 tests (plus 1 ignored live API test) |

## Known gaps and next improvements

- Updating links after a rename or move covers inline links, images, reference-style definitions and HTML `<a href>`/`<img src>`; absolute paths aren't rewritten (Check Links in Folder finds broken ones), nor are links after renames made outside the app.
- Upgrading from Markdown Studio (the old name) on Windows can't remove an all-users install when Markpion is installed for the current user only (removing it needs administrator rights), so both stay installed until the old one is uninstalled by hand. A taskbar pin of Markdown Studio is lost on upgrade (Windows doesn't let installers pin apps). The GitHub Pages site moved to nasimuddin-dev.github.io/markpion; the old address doesn't redirect.
- PDF export sets inline math as text (italic variables, superscripts and subscripts; `services/convert/mathText.ts`), keeping the LaTeX for formulas that need symbols the built-in font lacks (arrows, set notation), nested scripts or matrices. It draws display math as pictures only where the web engine allows it (Windows/WebView2; WebKit on macOS refuses). Word export converts a common subset to native equations (matrices and environments stay as LaTeX). HTML export and Print → Save as PDF render all math. Documented on the website.
- Code-sign the Windows installer (Authenticode) so SmartScreen doesn't warn; updates are already signature-verified.
- macOS builds are ad-hoc signed, not notarized (needs an Apple Developer ID). In-place updates are Windows-only; macOS and Linux are offered the download page (signing their updates in CI needs the updater key as a repository secret).
- The macOS and Linux builds haven't been run on real hardware yet, only built in CI.
- ARM64 builds for Windows and Linux (SRS §13.1, §21).
- The startup bundle is 736 KB (248 KB gzipped, measured 2026-09-29); the preview pipeline (with highlight.js), export, Mermaid and the History, Keyboard Shortcuts and AI review dialogs are lazy-loaded. By source map, the largest parts are React DOM (202 KB) and the HTML, CSS and JavaScript grammars (about 136 KB), which `@codemirror/lang-markdown` imports statically to highlight HTML inside Markdown; splitting them out would need a patched or forked package.
- A native OS menu bar on macOS (the in-app menu is used on all platforms today).
- Large documents (measured 2026-09-29, production build, Edge): a keystroke costs at most 0–120 ms up to 800 KB. Pasting a whole document into a new tab takes about 1.7 s at 100 KB, 6.7 s at 400 KB and 11 s at 800 KB until the preview shows it (before two fixes: 3.4, 9.6 and 21 s). The HTML re-parse (rehype-raw) now runs only for documents that contain HTML, and bulk changes rebuild the preview instead of inserting thousands of blocks one by one. Parsing in a Web Worker was tried and measured slower (2026-09-29: sending the syntax tree back costs more than parsing, and made keystrokes in a 100 KB document block for ~0.8 s), so it was not kept. Re-parsing on a keystroke is already fast; the remaining cost is building the page's DOM the first time, so progressive rendering (the first 150 blocks at once, the rest in steps) was tried next; it showed the top of the document sooner but made keystrokes in a 100 KB document block for ~0.8 s and the full render slower, so it was not kept either. Both experiments replaced react-markdown's renderer. What shipped instead keeps it: a rehype step groups long documents (150+ top-level blocks) into chunks of 50 blocks, and each chunk builds its DOM only when it comes within 1500 px of the visible area. Measured 2026-09-29 (production build, Edge, a generated document pasted into a new tab, median of 5 alternating runs): 400 KB 2.1 → 1.6 s and 800 KB 5.2 → 3.5 s until the end of the document shows; keystrokes 54–69 ms. The remaining time is Markdown parsing. Placeholder heights are estimates, so on WebKit (macOS, no scroll anchoring) the preview can shift when a chunk above the viewport is built. CSS `content-visibility: auto` on the preview's blocks (skipping layout and painting off screen) was measured too (2026-09-29, three alternating runs at 100/400/800 KB): no consistent gain, so it was not kept; the cost is creating the DOM, not laying it out. Live preview pauses above 1 MB.
- Playwright runs against the browser demo; a Tauri-driver e2e run against the native build is still to do.
- Localization (i18n): waiting on the choice of languages.
