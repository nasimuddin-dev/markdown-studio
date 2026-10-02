# Development Log

Daily development sessions (4–6 PM). Newest entries at the bottom.

## 2026-09-23 — Initial MVP build (v0.1)

**What was built:** the full v0.1 MVP from [SRS.md](SRS.md). Per-requirement status is in [TRACEABILITY.md](TRACEABILITY.md).

- Tauri 2 Rust backend (`src-tauri/src/`):
  - backend-enforced file scope and path-traversal rejection
  - native dialogs, atomic safe save with mtime conflict detection, and UTF-8/BOM/CRLF preservation
  - delete to Trash, recent list, settings, crash recovery, redacted logs
  - least-privilege capability
- React/TypeScript frontend (`src/`):
  - menu bar, explorer, tabs, CodeMirror editor and sanitized GFM preview
  - status bar, settings, dialogs and toasts
  - external-change banner, recovery, session restore, keyboard shortcuts
- `MemoryBackend` browser demo mode, so the UI runs without Rust.
- CI (`.github/workflows/ci.yml`) and a cross-platform release workflow (`release.yml`).
- The SRS was converted to [SRS.md](SRS.md) (the original .docx was moved to the Recycle Bin).

**Verification:**

- `npm run typecheck`: clean. `npm test`: 38 passed. `vite build`: OK.
- Verified by hand in the browser demo: open folder, open, edit, save, the Save As flow, the unsafe-HTML document, external-change banner, conflict dialog, close-dirty prompt, find/replace, view modes, settings, crash recovery and session restore.

**Unverified:** the Rust code has **not been compiled yet**, because there's no Rust toolchain on this machine. It includes unit tests (`cargo test`). To compile it, install Rust (https://rustup.rs) plus the Tauri prerequisites, then run `npm run tauri:dev`.

**Update (same day):** Rust 1.98.1 was installed via `winget install Rustlang.Rustup`, and MSVC Build Tools and WebView2 were already present. The Rust backend compiled without changes, and `cargo test` gives 15 passed. `npm run tauri:dev` launches the native window, which shows the welcome screen, with a logged startup time of about 100 ms. In Git Bash, `cargo` needs `export PATH="$HOME/.cargo/bin:$PATH"` until the shell is restarted. The first launch exited cleanly (code 0) shortly after starting, for an unknown reason (possibly the window was closed); the relaunch stayed up.

**Next up:**

1. Smoke-test the native flows in `npm run tauri:dev`: Open File/Folder dialogs, Save/Save As, the close guard on unsaved changes, window-state restore, delete-to-Recycle-Bin, and external links.
2. Shrink the ~1 MB main bundle: lazy-load CodeMirror language data and highlight.js languages.
3. Large-file benchmark (10 MB+) and preview performance (NFR-001/002).
4. v0.2 polish (SRS §18): a richer compare view for external changes and search improvements.
5. Playwright end-to-end tests for the critical flows (§17.1).
6. Document minimum supported OS versions (NFR-011).

**Questions for the user:**

- Should scheduled sessions commit their work to git? No commits are made until you approve.
- Several SRS §21 questions are still open: license, application identifier (currently `com.markdownstudio.app`), and minimum OS versions.

## 2026-09-23 (evening): Enterprise feature loop, iterations 1–9

The user approved a continuous loop: build a feature, test it, run it, then commit and push. The Rust toolchain is now installed and all Rust code compiles, with `cargo test` passing 20 tests.

| # | Feature | Commit |
| --- | --- | --- |
| 1 | Format menu and shortcuts (bold/italic/link/headings/lists/quote/code/table); explorer toggle moved to Ctrl+Shift+E | dccadea |
| 2 | Command palette (Ctrl+Shift+P / F1) with fuzzy search | 5c658c5 |
| 3 | Document outline panel (current-section highlight, jump to heading) | 03f29b1 |
| 4 | Export to HTML (self-contained, sanitized, images inlined), Copy as HTML, Print / Save as PDF | e54128b |
| 5 | Open files from the OS: launch args / file association, single instance, drag and drop onto the window | 8d6d794 |
| 6 | Auto save (after delay / on focus change), quiet on conflicts | 5f8ae2a |
| 7 | Find in Files: native Rust search with case, word and regex options; Search sidebar view | a092caf |
| 8 | Mermaid diagrams (lazy, strict) and LaTeX math (MathML); lodash-es pinned via overrides (`npm audit`: 0 vulnerabilities) | c6da031 |
| 9 | Save options (trim whitespace, final newline, new-file EOL), minimal-diff editor sync, large-document preview pause | c5f1bc7 |

**Tests:** 96 Vitest and 20 Rust, all passing. Each feature was also checked in the browser demo. The native behaviour of iteration 5 was checked with the debug build: the second instance forwarded its file and the log recorded `os.open`.

**Push status:** the push to `origin/main` is waiting for an interactive GitHub sign-in (Git Credential Manager), so these commits exist locally only until the user signs in once.

**Next up:**

1. Paste or drop an image into a document, saving it to an `assets/` folder next to the file.
2. Performance: code-split the main bundle (~1.4 MB) by lazy-loading the preview and export pipeline and the highlight.js languages.
3. Auto-update (UPD-001..006) with `tauri-plugin-updater`. This needs a signing keypair and an update endpoint from the user.
4. Markdown lint / Problems panel (broken relative links, duplicate headings, missing image files).
5. Table formatter (align columns) and link autocompletion for workspace files.
6. Localization (i18n) scaffolding.
7. Playwright end-to-end tests against the browser demo.

**Questions for the user:**

- Please complete the GitHub sign-in so pushes can go through. Running `git push` once in a terminal will cache the credentials.
- Auto-update needs an update-signing key and an update URL (for example GitHub Releases `latest.json`). Should I generate the keypair?
- License, final app identifier (currently `com.markdownstudio.app`), and minimum OS versions (SRS §21).

### Iterations 10–13 (same evening)

| # | Feature | Commit |
| --- | --- | --- |
| 10 | Paste or drop images into a document: saved to `assets/` next to the file via a scoped Rust command, linked on their own line | e27b918 |
| 11 | Code-split the preview and export pipelines: startup bundle 1.4 MB → 612 KB (693 KB after 12–13) | 7cba49a |
| 12 | Markdown lint (broken links and images, anchors, duplicate headings, heading levels, alt text) with a Problems panel | 6a5fe3d |
| 13 | Format Table (CJK-aware alignment) and link autocompletion (files, images, `#anchors`) | 3108380 |

**Final check:** `tsc` is clean. Vitest: 120 tests passing across 17 files. Rust: 22 passing. `vite build` succeeds, and `npm audit` reports 0 vulnerabilities.

**Push status:** still waiting for the GitHub sign-in. 14+ commits are queued on local `main`.

**Next up:**

1. Localization (i18n) scaffolding: extract UI strings; English plus one more locale.
2. Playwright end-to-end tests against the browser demo (open, edit, save, find, export).
3. Auto-update (UPD-*), once the user provides or approves a signing key and update URL.
4. A native macOS menu bar, and "Reveal in File Explorer" / "Copy Path" in the explorer context menu.
5. Performance: trim the highlight.js language set and benchmark 10 MB documents.
6. Spell-check language setting, and word/character count for the selection.

### Iterations 14–19 (continued loop)

| # | Feature | Commit |
| --- | --- | --- |
| 14 | Reusable accessible context menu; explorer Reveal / Copy Path / Copy Relative Path; tab menu (Close Others / to the Right / Saved) | aaab8a3 |
| 15 | Playwright end-to-end suite (6 workflows) on the installed Edge; CI job with Chromium | f093be8 |
| 16 | axe-core WCAG 2.1 AA audit in e2e (light and dark); fixed contrast, labels, nested controls and list semantics | 6106913 |
| 17 | Local file history (30 versions per file) with diff and restore; saving during an in-flight save now queues a re-save | 94cba75 |
| 18 | Focus Mode, Full Screen (F11) and a searchable Keyboard Shortcuts reference | d30af93 |
| 19 | Document statistics popover, spell-check toggle, Windows save-rename retry | 6d6c62d |

**Tests:** Vitest 136, Playwright 14 (including 8 accessibility audits), Rust 24. All passing.

**Push status:** still blocked on the GitHub sign-in. 21 commits are waiting locally.

**Questions for the user:**

- Which UI languages should localization cover (besides English)?
- Auto-update signing key and update URL (UPD-*).

## 2026-09-24: Conversion tools, released as 0.4.0

The user asked for conversion tools (DOCX/PDF to Markdown and the reverse) and continued development.

| # | Feature | Commit |
| --- | --- | --- |
| 21 | Import Word (.docx) and HTML as Markdown (mammoth, turndown + GFM); images saved to `assets/`; paste rich text as Markdown | 08e8fed |
| 22 | Export to Word (.docx) from the Markdown syntax tree; verified by opening the file in Microsoft Word through COM | db8d0b9 |
| 23 | Import PDF as Markdown (pdf.js plus layout heuristics); CMaps and standard fonts bundled for offline use | e70950e |
| 24 | Export to PDF (pdfmake, vector, bookmarks, links, vector checkboxes); non-Latin scripts are offered Print instead | 1c4d0fc |
| — | Native end-to-end check: drove the installed app with Windows UI Automation and the real file dialogs. Found and fixed list marker spacing and missing image alt text | 073225a |
| — | Also shipped: Windows shell integration (0.3.1), offline installer, GitHub Releases through `npm run release:github` | — |

**Release 0.4.0:** the standard installer is 6.3 MB (in `downloads/`) and the offline installer is 212 MB (GitHub Release). Both download URLs return 200, and the checksum is verified.

**Tests:** Vitest 160, Playwright 17, Rust 26. All passing. `npm audit`: 0 vulnerabilities.

**Next up:**

1. Insert or update a Table of Contents from headings.
2. CSV/TSV → Markdown table (paste and import), and export a table to CSV.
3. Batch conversion: convert every .docx/.pdf in a folder to Markdown.
4. Localization: still waiting on the user's language choices.
5. Auto-update (UPD-*), using GitHub Releases as the update source.

## 2026-09-24: Document tools, released as 0.5.0

| # | Feature | Commit |
| --- | --- | --- |
| 25 | Insert / Update Table of Contents (GitHub-style anchors, refreshed on save); CSV/TSV import as a table; paste spreadsheet cells as a table; Copy Table as CSV | 4d83ecd |
| 26 | Convert Folder to Markdown: batch-converts every .docx/.pdf/.html/.csv/.tsv in the workspace, skipping files that already have a .md | 9be8c7b |

**Release 0.5.0:** the standard installer is 6.3 MB (SHA-256 27a735ea…) and the offline installer is 212 MB (SHA-256 0b34bac0…).

**Tests:** Vitest 174, Playwright 17, Rust 27. All passing.

**Next up:** see 0.6.0 below.

## 2026-09-24: Updates and link checking, released as 0.6.0

| # | Feature | Commit |
| --- | --- | --- |
| 27 | Check for updates: Help menu plus an optional daily check against the GitHub Releases API. Offers Download, Later or Skip This Version (UPD-001/002/004). CSP `connect-src` allows only `api.github.com` | a6dbc00 |
| 28 | Workspace link check (sidebar → Links): missing files and images, bad `#anchors` within and across files, empty links; click a problem to jump to it | 2102208 |

**Native check:** installed 0.6.0 and drove Help → Check for Updates through UI Automation. It reported "You're up to date", so the request to GitHub passes the production CSP.

**Release 0.6.0:** standard installer SHA-256 c0fd2549…; offline installer SHA-256 d4425112….

**Tests:** Vitest 182, Playwright 17, Rust 27. All passing.

**Next up:**

1. Signed in-app updates (`tauri-plugin-updater`). This needs a signing key held by the maintainer.
2. Localization: still waiting on the user's language choices.
3. Export a folder (all .md) to PDF or Word in one step; merge several files into one document.

## 2026-09-24 (evening): Combine a folder, released as 0.7.0

| # | Feature | Commit |
| --- | --- | --- |
| — | Fixed an e2e flake: the accessibility audits timed out when the dev server started cold under parallel load (`test.slow()`) | 0fd48e0 |
| 29 | File → Combine Folder into One Document: merges every .md in the folder (README/index first, natural order, depth-first) into `<Folder> (combined).md` with a TOC. Headings move one level down under the combined title, links between files become in-document anchors (renumbered where heading ids collide), and relative images and links are re-based. Front matter and old TOC blocks are dropped. Unsaved edits in open tabs are included, and a dirty combined tab is never overwritten | 7b2fa6e |

**Verification:** 6 Vitest tests and a Playwright workflow (palette → Combine → the combined tab opens and the preview shows the heading hierarchy). The preview server can't start in unattended runs, so the browser check ran through Playwright instead. Not verified in the native app this session (the feature uses only existing backend commands).

**Release 0.7.0:** standard installer 6.3 MB (SHA-256 22d3ae03…); offline installer 211.3 MB (SHA-256 7cda0c7d…). Both GitHub download URLs return 200. Installed locally with `/S`, and the registry shows 0.7.0.

**Tests:** Vitest 188, Playwright 18, Rust 27. All passing.

**Next up:**

1. Export a folder straight to one PDF or Word file (combine plus export in one step, without writing the .md).
2. Signed in-app updates (`tauri-plugin-updater`). Needs a maintainer-held signing key.
3. Performance: a subset of highlight.js languages; a 10 MB document benchmark.
4. Localization: waiting on the language choice.

**Questions for the user:**

- Which UI languages should localization cover?
- Signing key and update endpoint for in-app updates.

## 2026-09-25: Automatic in-app updates, released as 0.8.0

The user asked for automatic updates: check at startup, ask, then replace the old version with the new one.

| # | Feature |
| --- | --- |
| 30 | `tauri-plugin-updater` driven from Rust commands (`check_app_update`, `install_app_update`), so the frontend needs no updater permissions. Checks on every startup (can be turned off in Settings), with Update Now, Later and Skip This Version. Open documents are saved first, a progress dialog shows the download, and the verified NSIS installer replaces the current version in place and relaunches. |
| — | Release pipeline: the standard installer is signed with the updater key (`~/.tauri/markdown-studio.key`, never committed), and `latest.json` is written and uploaded to the GitHub Release. The endpoint is `releases/latest/download/latest.json`. |

**Native end-to-end test:**

1. Built a test 0.7.9 whose update endpoint was a local server, and installed it.
2. Served a manifest with the wrong signature. It was rejected ("signature verification failed"), and 0.7.9 kept running.
3. Served the real signed 0.8.0. Update Now from the startup prompt installed 0.8.0 in place (registry and exe both 0.8.0), and the app relaunched in about 3 seconds.

**Tests:** Vitest 191, Playwright 17, Rust 27. All passing.

## 2026-09-25: Writing features, released as 0.9.0

The user asked for a continuous loop: suggest a feature, build it, test it, push it.

| # | Feature | Commit |
| --- | --- | --- |
| 31 | YAML front matter is shown as a metadata table in the preview (not a rule plus a stray heading), left out of exports, and its `title` names exported documents | a95a571 |
| 32 | GitHub alerts (`> [!NOTE]`, TIP, IMPORTANT, WARNING, CAUTION): coloured callouts with icons in the preview and HTML export, and labelled callouts in PDF and Word. Styled after sanitizing | e06dfe6 |
| 33 | New from Template: 7 built-in templates plus the workspace `templates/` folder; `{{date}}`, `{{week}}` and `{{cursor}}` placeholders | 392c308 |
| 34 | Paste a URL over selected text to make `[text](url)` | ef472f7 |

**Release 0.9.0:** the first release delivered through the in-app updater. Installed 0.8.0 apps offer it at startup.

**Tests:** Vitest 207, Playwright 18, Rust 27. All passing.

## 2026-09-25 (evening): Heading levels and clickable tasks, released as 0.10.0

| # | Feature | Commit |
| --- | --- | --- |
| 35 | Promote / Demote Heading (Format menu, palette, Ctrl/Cmd+Alt+= and Ctrl/Cmd+Alt+-): each selected heading moves one level, staying within H1–H6. Other lines are unchanged | 0b22bef |
| 36 | Task checkboxes in the preview can be clicked (or toggled with Space) to check or uncheck the task in the source. The change goes through the editor, so Ctrl+Z undoes it. Tasks are located with the preview's GFM parser, so code blocks, quotes, nested lists, front matter and CRLF files are handled | 704e342 |

**Verification:** Vitest and a Playwright workflow in Edge: the shortcut changes H3→H2→H4 in the preview; clicking the second task checks `- [x] second` in the source and leaves the first alone. An early version of the checkbox logged a React "uncontrolled to controlled" warning. It is now an uncontrolled input keyed on its state, and the warning is gone. The preview dev server can't start in unattended runs, so browser checks ran through Playwright.

**Release 0.10.0** (33742ac): standard installer 6.9 MB (SHA-256 6442eb92…); offline installer 211.9 MB (SHA-256 b9fec90b…). Both GitHub download URLs return 200, and `latest.json` shows 0.10.0, so installed apps are offered the update at startup. The README (version, links, checksums, features), INSTALL.md (the standard installer size is now ~7 MB, not ~4 MB) and TRACEABILITY are updated. **Local install skipped:** the silent install needs UAC elevation, and nobody was present to approve it. The machine still has 0.9.0, which will offer 0.10.0 at its next startup.

**Tests:** Vitest 212, Playwright 18, Rust 27. All passing.

**Next up:**

1. Move a whole section (a heading plus its subheadings) up or down, or promote it, from the outline.
2. Performance: a subset of highlight.js languages to shrink the preview bundle; a 10 MB document benchmark.
3. Tauri-driver e2e against the native build.
4. Localization: waiting on the language choice.

**Questions for the user:**

- Which UI languages should localization cover?
- Code-signing certificate (Authenticode) so SmartScreen doesn't warn on install?
- Local installs need an elevated (UAC) prompt, which unattended runs can't approve. Should the scheduled run skip the local install, or will you run the installer yourself?

## 2026-09-25 (late evening): Separate installers for Windows, macOS and Linux

The user asked for the app to be platform-independent, with a separate installer for each of Windows, macOS and Linux.

| # | Change | Commit |
| --- | --- | --- |
| 37 | The release workflow builds macOS (Apple Silicon and Intel `.dmg`) and Linux (`.AppImage`, `.deb`, `.rpm`) installers with stable names, and attaches them and `SHA256SUMS-macos-linux.txt` to the release that `release:github` creates for Windows. It had failed on every release since 0.3.1: empty Apple secrets broke macOS signing (the app is now ad-hoc signed without a certificate), and the updater key isn't in CI (no updater artifacts are built there). It can be run by hand for an existing tag | see git log |
| — | README Download section: a table for all three systems, then per-OS install steps. The release script generates it, so every release refreshes all three. docs/INSTALL.md has full macOS and Linux guides (requirements, Gatekeeper, apt/dnf/AppImage, updating, uninstalling, checksums) | same |
| — | On macOS and Linux the update check falls back to the GitHub release page ("Download"), because signed in-place updates are published for Windows only. Takes effect from the next release | same |

**Verification:** re-ran the workflow for v0.10.0. All 4 jobs passed, and all 5 new assets plus the checksum file are on the release. Every README download link returns 200. The `.deb` declares `libwebkit2gtk-4.1-0, libgtk-3-0`, so apt installs the dependencies. **Not verified:** installing and running on a real Mac or Linux machine (not available here). Note that the 0.10.0 macOS/Linux builds were made from the v0.10.0 tag, so the update-check fallback applies only from the next release.

**Tests:** Vitest 213, Playwright 18, Rust 27. All passing.

**Questions for the user:**

- Apple Developer ID (for notarization, so macOS doesn't warn): do you have one to add as `APPLE_*` repository secrets?
- Should the updater signing key be added as a repository secret (`TAURI_SIGNING_PRIVATE_KEY`), so macOS and Linux get in-place automatic updates like Windows?
- Linux ARM64 (for example Raspberry Pi) and Windows ARM64 builds: wanted?

## 2026-09-25 (night): Documentation brought up to date with the current design

The user asked for all project documents to match the current design, and to be updated whenever a feature is developed.

- **README:** added missing features (Save All and recent files, word count and statistics, spell check, Export Diagnostic Logs, the three-OS note). The security model now describes the only network request (the update check) and signed updates. Development now covers the Node 22 requirement, `npm run build`, the release scripts and what CI runs. The project structure lists every folder and module, and a new Documentation section describes each doc and the update policy.
- **TRACEABILITY:** status as of 0.10.0. NFR-011 is now Done (minimum OS versions are documented). NFR-006, SEC-001, SEC-008 and the UPD rows are corrected. The "Beyond the MVP" table grew from 7 to 16 rows with source locations, and there is a new test-coverage table. Known gaps are refreshed: startup bundle 691 KB (232 KB gzipped), ARM64, and the stale "Playwright to do" item removed.
- **SRS:** now version 1.1, with a revision history, an implementation-status summary, status notes for §13 (per-OS installers) and §18 (release scopes), and §21 open questions marked answered, partly answered or open. The requirement text is unchanged.
- **INSTALL.md:** macOS and Linux troubleshooting rows.

**Policy from now on:** every feature commit updates the README feature list and TRACEABILITY (plus INSTALL.md or the SRS status notes if affected), and every release updates the download section, INSTALL.md and this log.

## 2026-09-25 (extra hour, 6:18–7:00 PM): Writing and structure tools, released as 0.11.0

The user asked for one more hour today.

| # | Feature | Commit |
| --- | --- | --- |
| 38 | Check / Uncheck Task (Ctrl/Cmd+Enter; on other lines the key keeps its default) and Insert Footnote (Ctrl/Cmd+Alt+R: the next `[^n]` at the cursor, its definition at the end, definitions kept together) | 969a371 |
| 39 | File → Export Folder as One PDF / One Word Document: combines the folder in memory and exports it without writing a combined `.md`. The PDF/Word exporters now take any Markdown source | f63b69e |
| 40 | Sort Table by Column (A to Z / Z to A): numeric when every filled cell is a number (1,200, 3.5%, $9), otherwise natural order; empty cells last; stable | 1a29f1d |
| 41 | Reopen Closed Tab (Ctrl/Cmd+Shift+T; up to 20; skips files that are open again or gone) | a03fde0 |
| 42 | Move Section Up / Down: a heading with its text and subsections moves past its same-level neighbour within its parent; headings in code fences are ignored | 3e39e44 |

**Verification:** Vitest for every command, and a Playwright workflow in Edge for each: the task toggle and footnote rendering in the preview, a folder export producing a real `.docx` download (and no combined file), reopen via the palette, and move section via the palette.

**Release 0.11.0** (6d1ba36): Windows standard 6.9 MB (SHA-256 24037ac8…) and offline 211.9 MB (d5c3f463…). macOS arm64/x64 `.dmg` and Linux `.AppImage`/`.deb`/`.rpm` were built by the release workflow (all 4 jobs green). All 6 README release links return 200, and `latest.json` shows 0.11.0. The docs were updated with each feature (README, TRACEABILITY) and at the release (SRS current version 0.11.0, TRACEABILITY as-of and test counts, INSTALL links).

**Tests:** Vitest 225 (37 files), Playwright 21, Rust 27. All passing.

**Next up:**

1. Outline panel: drag to reorder sections (reusing `sections.ts`), and Copy Link to Heading.
2. Performance: a highlight.js language subset; a 10 MB document benchmark.
3. Tauri-driver e2e against the native build; test the macOS and Linux builds on real machines.

**Questions for the user:** unchanged. Apple Developer ID, the updater key as a CI secret, ARM64 builds, licensing, UI languages.

## 2026-09-25 (night): Documentation website

The user asked for the documents to follow `docs/DOCUMENTATION_SITE_SPEC.md`: a public documentation and product website.

- **Framework:** VitePress 1.6 in `website/`, with its own `package.json`, so the app's dependencies are untouched. Vite is overridden to 6.4.3, giving 0 vulnerabilities; stock VitePress pulls in a vulnerable Vite 5/esbuild dev server.
- **47 pages:** home, download, features, FAQ, changelog (v0.3.1–v0.11.0 from the git history), roadmap, privacy; Getting Started (3); installation per OS (3); user guide (10); Markdown reference (8); troubleshooting (9, each in Problem / Symptoms / Cause / Solution / Diagnostics / Report form); reference (keyboard shortcuts, configuration); blog (index and 4 articles).
- **Single sources of truth:** the version, release date and installer links come from the app's `package.json`, the git tags and the release naming convention (`docs/data/release.data.ts`). The keyboard shortcut tables are parsed from `src/features/commands.ts` with the TypeScript parser at build time.
- **Screenshots:** real UI captures (`npm run docs:screenshots` drives the browser build with Playwright and encodes WebP), 20–92 KB each.
- **SEO:** a unique title and description per page (enforced), canonical URLs, Open Graph and Twitter tags, JSON-LD (SoftwareApplication, WebSite and Organization on the home page; BreadcrumbList on documentation pages; Article on blog posts; no ratings, prices or counts), `sitemap.xml` and `robots.txt`.
- **Validation:** `npm run docs:check` runs the type check, the content check (front matter, one H1, alt text, stray interpolation), the build (fails on dead links) and a link check of every href and src in the output. `--external` checked 69 GitHub and release links, all OK. `npm run docs:test` runs 24 browser checks: axe-core WCAG 2.1 AA on 11 pages in light and dark (all pass), mobile at 375 px with no horizontal scrolling, and the mobile menu.
- **Accessibility fixes found by the audit:** brand button contrast, code language labels and syntax colours (now `github-light-high-contrast`), collapsible sidebar groups (nested-interactive), and an unlabelled theme switch before hydration (component override with a static `aria-label`).
- **Deployment:** `.github/workflows/documentation.yml` builds and checks on pull requests and deploys to GitHub Pages on pushes to `main` (website, version or shortcut changes), on releases, and by hand.
- **Accuracy fixes found while writing:** web (`https`) images do make network requests, so "the only network request is the update check" was corrected in the README and SRS too. A probe showed that PDF export drops footnotes and Word export drops footnote references. This is documented, and recorded in TRACEABILITY known gaps and on the roadmap.

**Desktop app unaffected:** typecheck, Vitest 225, Playwright 21 and `vite build` all pass.

**Next up:** footnotes, Mermaid and math in PDF/Word export; website search console setup (owner); keep the website changelog updated with each release.

**Deployed:** with the user's approval, GitHub Pages was enabled (source: GitHub Actions) and the site is live at https://nasimuddinbd02.github.io/markdown-studio/. All 21 checked URLs return 200, and a missing page returns 404. The sitemap has 47 URLs, robots.txt is served, and the 23 browser checks (WCAG audits in both themes, mobile) pass against the live site.

**Questions for the user:** add the site to Google Search Console (steps in `website/README.md`)? Choose a license (the FAQ says one hasn't been published)?

## 2026-09-25 (9:17–10:30 PM): Export fidelity and outline actions, released as 0.12.0

The user asked to continue the loop until 10:30 PM. From this session on, every change updates its documents (see `CLAUDE.md`).

| # | Feature | Commit |
| --- | --- | --- |
| 43 | Footnotes in PDF export (superscript numbers linked to a Footnotes section) and Word export (native Word footnotes), numbered in first-reference order; unreferenced definitions left out | 62a3feb |
| 44 | Mermaid diagrams in PDF and Word exports: rendered with SVG labels, rasterized at 2× in the web engine, embedded as PNG, with solid edge-label backgrounds; syntax errors fall back to the code. Verified in Edge: the .docx holds the rendered diagram and no Mermaid source | 5954415 |
| 45 | Outline: right-click a heading for Copy Link to Heading / Copy Markdown Link (GitHub slugs, duplicates numbered) and Move Section Up/Down; Alt+Up/Down on a focused heading, with focus following the moved section | 54df62b |
| 46 | View → Fold All / Unfold All (also in the palette) | 330851b |
| — | Documentation workflow fix: the github-pages environment only accepts `main`, so the release-event deploy failed and its concurrency group cancelled the push deploy. The release trigger is removed and deploys queue instead of cancelling. The site was redeployed and shows 0.12.0 | 413c131 |

**Docs:** each feature updated the README, TRACEABILITY and the matching website pages (export tables, Mermaid, footnotes, troubleshooting, FAQ, roadmap, editor, writing tools, keyboard shortcuts, settings). The remaining export gap, LaTeX math in PDF/Word, is documented.

**Release 0.12.0** (face7d8): Windows standard 6.9 MB (SHA-256 34287ae3…) and offline 211.9 MB (0dbebc86…). The macOS arm64/x64 and Linux AppImage/deb/rpm builds all pass. All 6 README release links return 200, and `latest.json` shows 0.12.0. The website changelog has the v0.12.0 entry. **Installed locally with `/S`: the registry shows 0.12.0.** CI (typecheck, unit, e2e, Rust on 3 OSes) is green.

**Tests:** Vitest 234 (37 files), Playwright 24, Rust 27, website checks (47 pages; 24 browser checks). All passing.

**After the release (unreleased, ships in the next version):** #47, drag headings in the outline to reorder sections (pointer-based, with a drop indicator; drop below the last heading to move to the end; undoable), with the pure `moveSectionTo()` unit-tested and an Edge e2e test of drag, drop and undo. Vitest 238, Playwright 25.

**Next up:**

1. Math in PDF and Word export: native Word equations (OMML) from LaTeX, or rasterized MathML where the web engine allows it.
2. Performance: startup bundle (691 KB) and a large-document benchmark.
3. Tauri-driver e2e against the native build; real-hardware checks on macOS and Linux.

**Questions for the user:** add the site to Google Search Console (steps in `website/README.md`); choose a license; Apple Developer ID and Windows code-signing certificate.

## 2026-09-25 (10 PM): GitHub account renamed to nasimuddin-dev

The user renamed the GitHub account from `nasimuddinbd02` to `nasimuddin-dev`. GitHub redirects the repository, releases and API, but **GitHub Pages doesn't**: the old site URL returned 404.

- All references were updated (56 across 27 files): the website's `SITE`/canonical URLs, sitemap host and `robots.txt`; README and INSTALL links; every website "report an issue" and release link; the release data loader; the link checker; `src/services/updates.ts` (release API and page); `src-tauri/tauri.conf.json` (homepage and **updater endpoint**, effective from the next release); and the NSIS installer's homepage. The git remote now points to `github.com/nasimuddin-dev/markdown-studio` (at the user's request).
- Installed apps up to 0.12.0 still check the old updater URL. GitHub's redirect serves them `latest.json` today (verified: HTTP 200), and the next release's `latest.json` points to the new account. **If anyone ever registers the old username, those redirects stop**, so users on ≤0.12.0 should update once to a release built after this change.
- Older DEV_LOG entries and the user's copy of the website spec keep the old URL as historical text.
- **Website:** https://nasimuddin-dev.github.io/markdown-studio/ (Google Search Console should use this URL).

## 2026-09-25 (10:00–10:30 PM): Released as 0.13.0

Released straight after the account rename, so installed apps move to the new update address quickly.

- **Contents:** #47, drag sections in the outline (345af4c), and the move to `github.com/nasimuddin-dev` (bae2891): updater endpoint, release links, release-check API and website URL.
- **Release 0.13.0** (0d8ca4b): Windows standard (SHA-256 d83a901c…) and offline 211.9 MB (2d877ec1…). `latest.json` points to `github.com/nasimuddin-dev/.../v0.13.0/…`. The macOS arm64/x64 and Linux AppImage/deb/rpm builds all pass, and all 6 README release links return 200. `latest.json` resolves to 0.13.0 through both the new URL and the old one (via GitHub's redirect), so installed 0.8.0–0.12.0 apps are offered 0.13.0 and move to the new endpoint. The website redeployed and shows 0.13.0. **Installed locally with `/S`: the registry shows 0.13.0.**
- **Docs:** website changelog v0.13.0 (Added: outline drag; Changed: new account), SRS current version, TRACEABILITY as-of and test counts, README and INSTALL (generated).

**Tests:** Vitest 238 (37 files), Playwright 25, Rust 27, website checks (47 pages, 70 external links OK). All passing.

**Session total (9:17–10:30 PM):** 5 features (#43–#47), 2 releases (0.12.0, 0.13.0), a docs-workflow fix and the account migration.

**Next up:**

1. Math in PDF and Word export (OMML or rasterized MathML).
2. Performance: startup bundle (691 KB) and a large-document benchmark.
3. Tauri-driver e2e against the native build; real-hardware checks on macOS and Linux.

**Questions for the user:**

- Add https://nasimuddin-dev.github.io/markdown-studio/ to Google Search Console (steps in `website/README.md`).
- Choose a license.
- The scheduled daily task's description still mentions the old repository URL in its text. Pushes use the git remote, which is already updated. Should I update the task description too?

## 2026-09-25 (late): Fix, long file names broke the tab layout (unreleased)

The user reported that a tab with a long file name showed its icon above the name, pushed the close button out of line, and had a scrollbar squeezed into the tab bar.

- **Cause:** a regression from the accessibility commit 6106913 (2026-09-23). Two selectors were swapped: the flex layout of the tab's contents was scoped to `.tab.dirty .tab-main` (unsaved tabs only), and the italic style to every `.tab-label`. Saved tabs lost the row layout and the "…" truncation, and every tab name was italic.
- **Fix:** `.tab-main` is laid out for every tab, and only unsaved tabs are italic. The tab strip's scrollbar is hidden; the mouse wheel scrolls the tabs sideways, and the active tab is scrolled into view.
- **Test:** a Playwright regression test checks that the icon, name and close button share one row, the long name is truncated, a saved name isn't italic and an unsaved one is, and the tabs fill the bar. It fails on the old CSS (icon 18.5 px above the name) and passes now. Playwright 26.
- **Docs:** website Tabs page (truncation, wheel scrolling, italic unsaved names). Ships in the next release.

## 2026-09-28 (4:00 PM, scheduled session): features without a log entry

The scheduled session ended before it wrote its entry. Its commits, from `git log`: d69c7d4 LaTeX formulas exported to Word as native equations, 3f072bb display formulas drawn as pictures in PDF export, 1e3f608 Replace in Files, 409d443 Go to File (Ctrl/Cmd+Alt+O), 6953bd6 Explorer: Duplicate a file. "Copy as Formatted Text" was left uncommitted; it was tested and committed on 2026-09-29 (5d1bdf6). All shipped in 0.14.0.

## 2026-09-29: Renamed to Markpion (0.14.0), inline math in PDF, shortcut fix, docs merge (0.15.0)

At the user's request the app was renamed from **Markdown Studio** to **Markpion**.

- **Rename** (7a2df02): product name, window title, bundle identifier `com.markpion.app`, Rust crate/binary `markpion`, npm package, installer names `Markpion-<version>-…`, registry integration, update/release URLs, website and docs (90 files). New logo (an "M" with a pen nib) with regenerated icons and website screenshots. The GitHub repository was renamed to `nasimuddin-dev/markpion` (`gh repo rename`); the git remote was updated. GitHub redirects the old repository, releases and API, so 0.13 installs find the update (verified: the old `latest.json` URL returns 0.14.0). **GitHub Pages doesn't redirect:** the old site URL returns 404.
- **Upgrade path:** on first start Markpion copies settings, recent files, recovery and history from the old `com.markdownstudio.app` folder (`storage::migrate_legacy_dir`, Rust test). The Windows installer silently runs the Markdown Studio uninstaller first. The release script also accepts the updater key under its old file name (`~/.tauri/markdown-studio.key`).
- **Release 0.14.0** (7f28ab9): Windows standard and offline installers, macOS and Linux builds from CI. Both Windows download links returned 200.
- **PDF export: inline formulas as text** (46763a0): italic variables, real superscripts/subscripts, fractions, roots, Greek; formulas needing glyphs the bundled Roboto lacks keep their LaTeX. A test checks the allowed characters against the font file. Verified visually by rendering an exported PDF with pdf.js.
- **Bug reported by the user: no desktop shortcut after updating** (dbb7cf2). Cause, confirmed in Tauri's generated `installer.nsi`: the old uninstaller deletes Markdown Studio's desktop and Start menu shortcuts, and an update (`/UPDATE`) never creates shortcuts. The user's PC had Markpion 0.14.0 for all users and no shortcut at all. The installer hook now creates both once (when it removes Markdown Studio, or when Markdown Studio's data folder shows the PC was already upgraded to 0.14.0), with a registry marker so they don't come back after the user deletes them; `/NS` is respected. It compiles (makensis); **the upgrade itself is unverified** until the user's app updates to 0.15.0.
- **Docs merged into `docs/`** (1b6cdcd, user's choice of layout): website pages moved to `docs/site/`; `website/` keeps the tooling. The VitePress config resolves the pages' imports from `website/node_modules` and keeps Vue external in the server build; the shortcut loader loads the website's TypeScript 5 (the app has TypeScript 7). docs:check and the 23 site browser checks pass.
- **Performance investigation, nothing shipped:** section-by-section preview rendering looked like a 4× win in dev mode, but production builds showed no difference (per keystroke ~110 ms at 800 KB either way), so it was reverted. Measured: pasting 100/400/800 KB takes 3/10/21 s until the preview shows it. Recorded in TRACEABILITY known gaps and the roadmap.

**Tests:** Vitest 260 (41 files), Playwright 31, Rust 28, website check (48 pages) and 23 site browser checks. All passing.

**Next up:**

1. Large documents: find where the 3–21 s first display goes (paste handling, CodeMirror, first preview render) and move it off the main thread or render progressively.
2. Verify the shortcut fix on the user's PC after the 0.15.0 update.
3. Tauri-driver e2e against the native build.

**Questions for the user:**

- The old website address (nasimuddin-dev.github.io/markdown-studio) now returns 404. A small `markdown-studio` repository with a redirect page would keep old links working. Should I create it?
- The local folder is still `D:\Development\markdown-studio`. Rename it to `markpion`? (The scheduled task and the memory folder refer to the old path.)
- The bundle identifier is `com.markpion.app`; Tauri warns that identifiers ending in `.app` aren't recommended on macOS. Changing it later would need another data migration, so it's best decided now.
- `AGENTS.md` (untracked) is a copy of the project rules. Commit it, or delete it?

## 2026-09-29 (afternoon): 0.16.0, AI assistant, architecture for a future cloud version, link updates

Built in the development loop (the user asked for a release every 5 hours, then for one release now).

- **Features:** large-document preview about 2× faster (0d54dea); export page size (808a2f5); document properties from front matter (002e871); emoji shortcodes (1edff64) and completion (6135e12); Word page numbers (e63d352); Export Folder as HTML Site (4779582); contained rendering errors (9741b79); table rows/columns (0f76228) and Tab navigation (c6af89f); move in the Explorer (e5d8ebc); no white window at startup (5b3d9e1, reported by the user); optional AI assistant with Claude (1f897bc, 6243ebd, 2c9bfeb streaming); managed settings policy (1f04308); Windows High Contrast (7dd09f1); customizable shortcuts (c302882); settings export/import (17e9dd0); link updates after rename/move (730d72b).
- **Architecture (user request: scalable, cloud-friendly):** `Backend` split by domain with `capabilities`, Rust commands per domain (8f999c7); window title, full screen and the close guard moved behind `PlatformApi`, so only `services/` knows about Tauri; unused dependencies and dead exports removed, `knip` check added; History/Shortcuts/AI dialogs lazy-loaded and preloaded after startup (8564ea9, ee0dacf). `AGENTS.md` is now the single contributor/agent guide and `CLAUDE.md` imports it. `docs/DESIGN.md` added (b9ef55b) with the path to a cloud backend (§13).
- **Tried and not kept:** preview parsing in a Web Worker, and progressive preview rendering (both measured slower; recorded in TRACEABILITY).
- **Test flakiness found:** three UI tests timed out when the whole suite ran cold in parallel (lazy dialog imports and a slow role query); fixed with preloading and longer timeouts.

**Version:** 0.16.0. **Tests:** Vitest 328 (51 files), Playwright 35, Rust 35 (+1 ignored live API test), website check (50 pages). All passing.

**Unverified:** the AI assistant against the live API with a real key (only an invalid-key live test runs); the white-window fix on a first start of a fresh install; the macOS and Linux builds on real hardware.

**Next up:**

1. Virtualized preview for very large documents, keeping react-markdown.
2. Reference-style link definitions in link updates and Check Links.
3. Tauri-driver e2e against the native build.

**Questions for the user:**

- A redirect repository for the old website address (nasimuddin-dev.github.io/markdown-studio)?
- Rename the local folder `D:\Development\markdown-studio` to `markpion`?
- Keep the bundle identifier `com.markpion.app` (Tauri warns about `.app` on macOS)?

## 2026-09-29 (evening): 0.17.0, toolbar, slides, Git status, user-reported fixes

The user asked for one release and then to keep looping; during the loop they reported three problems and asked for a toolbar. 0.17.0 was released early (before the 5-hour mark) to deliver the fixes.

- **User-reported:** file dialogs opening behind the window (6ab3393: every dialog now has the main window as parent; **unverified live**, the user's Markpion was running, so the debug build couldn't be tested without closing it); PDF import bullets (94ae7fb: Word's Symbol-font U+F0B7 bullets weren't recognised; checked against the user's resume, not committed); no way to close a folder from the Explorer, Outline not resizable, no way to clear recent files (c97b267).
- **User idea, implemented:** formatting toolbar (3a47ed0), pressed state from the syntax tree, WAI-ARIA toolbar keyboard pattern.
- **Features:** reference-style (503525b) and HTML (c999bbb) links in link checks/updates; chunked preview for long documents (dd45b90, measured 800 KB 5.2 → 3.5 s; CSS content-visibility measured and not kept); Insert Image (04dbb8b); Present as Slides (dd4f74a); read-only Git status (c97b267, fsmonitor disabled); paste position fix (a3fff12).

**Version:** 0.17.0. **Tests:** Vitest 358 (57 files), Playwright 41, Rust 39 (+1 ignored), website check (50 pages). All passing.

**Unverified:** the dialog-parent fix on the user's PC; Git status on macOS/Linux; slides and chunked preview on WebKit (macOS).

**Next up:**

1. Confirm the dialog fix after the user updates to 0.17.0.
2. Toolbar: more paragraph styles (Heading 4–6) and a table menu.
3. Tauri-driver e2e against the native build.

**Questions for the user:**

- Local LLMs (SRS §19, for example Ollama) alongside Claude: wanted?
- A redirect repository for the old website address?
- Rename the local folder to `markpion`?

## 2026-09-29 (5:37 PM, scheduled session): baseline check only

The scheduled run started at 5:37 PM, after the 5:25 PM cut-off for new features, so no feature was built and no release was made (0.17.0 from the earlier session is current).

- **Baseline:** tree clean on `main` at 17e6923. Typecheck clean; Vitest 358 (57 files) and Rust 39 (+1 ignored) passing. Playwright was not re-run (no code changed since 0.17.0, where 41 passed).

**Next up:** unchanged from the 0.17.0 entry above (confirm the dialog-parent fix, toolbar headings 4–6 and table menu, tauri-driver e2e).

**Questions for the user:** unchanged from the 0.17.0 entry. Also: the scheduled task fired late today (5:37 PM instead of 4:00 PM); if that keeps happening, a larger time window may be worth setting.

## 2026-09-29 (5:44–7:35 PM, continuous session): 0.18.0

The user asked to keep the loop going, then to release once features were ready.

- **Features:** toolbar Heading 4–6 and Table tools (66b4e21); Git change bars in the gutter (946ffa0), with a pop-up of the committed lines, Revert, and Next/Previous Change (cac881b); the last Git commit in File History (80dd73b) and the saved file while there are unsaved changes (7f234c4); custom CSS for documents, scoped to `.markdown-body` by rebuilding the parsed rules (7f15b2a); Number Headings (e14129d); Find in Files include/exclude globs, in Rust and TypeScript with shared test cases (d673b6c); Copy button on preview code blocks (63da895); Go to Heading (e373084); Edit menu line tools (8b708ee); read-only documents (c998be2); lint rules for table column counts, footnotes and link text (c902a5c), with quick fixes (a39eb90).
- **Fixes:** HTML entities in `href`/`src` for link checks and updates (dc4f880). Accessibility (1b17f62): the audit now covers the gutters, menus, context menus, find/replace, Problems, Links, Go to File, templates, About, unsaved-changes, File History, the read-only bar and the Git pop-up; it found and fixed Problems-panel contrast, line-number contrast, the unsaved-changes label contrast (light theme) and invalid ARIA in the File History list.
- **Measured, not changed:** the startup bundle (736 KB): React DOM 202 KB, and ~136 KB of HTML/CSS/JS grammars that `@codemirror/lang-markdown` imports statically (d5eae9f). highlight.js is already lazy.
- **Native check:** a debug build opened a file in a scratch Git repository; UI Automation confirmed File History shows "Last commit" with the correct diff (the real `git show` path). Screenshots and keyboard input were unavailable (the desktop was locked), so the gutter bars were checked in the browser build only.

**Version:** 0.18.0. **Tests:** Vitest 390 (63 files), Playwright 49, Rust 40 (+1 ignored), website check (50 pages). All passing.

**Unverified:** the gutter bars and read-only locking in the native window (covered by browser e2e and Rust tests); Git features on macOS/Linux.

**Next up:**

1. Tauri-driver e2e against the native build (needs msedgedriver and `cargo install tauri-driver`; see questions).
2. More lint quick fixes (for example heading levels) and a "Fix All" for a document.
3. Per-workspace custom CSS (a file in the folder, shared through Git), after weighing the risk of styles from untrusted repositories.

**Questions for the user:**

- May I download msedgedriver (Microsoft) and `cargo install tauri-driver` for native end-to-end tests?
- Local LLMs (SRS §19, for example Ollama) alongside Claude: wanted?
- A redirect repository for the old website address?

## 2026-09-29 (7:35–8:30 PM): 0.19.0, user-reported rename and Explorer issues

After 0.18.0 was released and installed locally (the silent install worked), the loop continued.

- **User-reported (b27ce2e):** a file saved without an open folder couldn't be renamed and didn't show in the Explorer. Added Rename… to the tab menu (Save As… for unsaved documents), an Open Files list in the Explorer when no folder is open (F2 to rename, context menu), and Open Containing Folder (the folder dialog starts in the file's folder). The native scope now lets a file approved on its own take a new name in its own folder (never overwriting; the approval moves with it; Rust tests). Also user-reported: the Recent list's Clear button looked awkward. The cause was a second `.link-button` rule that underlined and squeezed the whole Recent list; it's now `.text-link`, and Clear is a quiet button aligned with the heading.
- **Features:** lint quick fixes for skipped heading levels and misspelled anchors (3124920), Edit → Fix All Problems (147ac6b), toolbar table size picker (ec37a70). DESIGN.md brought up to date (1f333e9).
- **0.18.0 release:** all seven downloads (Windows standard/offline, macOS arm64/x64, Linux AppImage/deb/rpm) returned 200; the macOS/Linux workflow passed.

**Version:** 0.19.0. **Tests:** Vitest 393 (64 files), Playwright 50, Rust 40 (+1 ignored), website check (50 pages).

**Unverified:** renaming a single file in the native app (Rust scope tests and the in-browser flow cover it).

**Next up:** unchanged from the 0.18.0 entry (tauri-driver e2e, per-workspace custom CSS).

## 2026-09-29 (8:30–9:40 PM): 0.20.0

0.19.0 was published (the 212 MB offline upload needed three attempts because of TLS "bad record MAC" errors; the size on GitHub matches) and installed here after the user approved the UAC prompt.

- **User-reported:** the Explorer without a folder showed two nearly identical buttons (Open Folder and Open "Downloads"); now one Open Folder that starts in the current file's folder (639adcc).
- **Visual review** (screenshots of every main screen, both themes): the formatting toolbar and the View options bar shared `.toolbar`, so the view buttons got the toolbar's background and a wrapped toolbar row started with a divider (080b205); the find bar showed CodeMirror's lowercase labels (e81dc4a); Settings became a sectioned layout (795b744); search filters moved below Replace (f891064); the demo guide listed Heading 1–3 (2180bfd). A duplicate-selector scan of `app.css` found no other leaks.
- **User request:** Format → Fix Table repairs tables typed with mistakes, also from the toolbar's Table tools (which now open for tables the parser doesn't recognise).
- **Features:** Compare with File (4767763), Convert Selection to Table (4e65d5d), wrap the selection with `*`/`` ` ``/brackets (36c70e5), Rename File command (9b35c20), Toggle Word Wrap / Line Numbers (55cdba5), Save As name from the title (17d372f) and folder next to other open files (a88f081), palette whole-word ranking (2f485a5), recents follow renames (0c0eb4c).
- **Process note:** several shell heredocs silently dropped backslashes from code (a NUL character and broken regexes appeared); all were found by type checks, tests or an audit and fixed. Edits with escapes now go through written script files or the Edit tool.

**Version:** 0.20.0. **Tests:** Vitest 407 (68 files), Playwright 54, Rust 41 (+1 ignored), website check (50 pages).

**Next up:** tauri-driver e2e (needs the user's go-ahead to download msedgedriver); per-workspace custom CSS; a settings search box.

## 2026-09-29 (9:40 PM) – 2026-09-30 (6:00 AM), overnight session: 0.21.0

The user asked to keep developing until 8:30 AM and to create the release build at the end.

- **Checking documents:** Fix Table as a quick fix (46980f3); `#Title` without a space and `---` under text (3b616c5); list items without a space and bold with inner spaces (aafafe0); paths with spaces, with a test that keeps the project's own docs lint-clean (9b4c09d); F8 / Shift+F8 (7272d9e); turning checks off, with accessible Problems-panel actions (389965f); code masked once per run (cf278d2); reference links without a definition or unused (dbefd15), and a label defined twice (2f3f02e); misspelled file names get a suggestion and a quick fix (e3bc658), compared by stem and extension (ef1c7a6).
- **Links and headings:** scroll sync by source line and double-click to the source (03f8133); reference-label, footnote and other-document heading completion (d772f9b, 1f4bd9d); convert links to reference/inline style (e08d38f); Ctrl/Cmd+click and Alt+Enter follow links (8d996ef); Rename Heading with link updates across the folder (e3ed1d8), and F2 on footnote/reference labels (289b6ac); Links to this document (b118ff6, 97bbd52); Go to Heading in Folder (2c0ef4e); Remove Link (a3ef45c); image hover (7a8b1d6); heading link icon in the preview (dd1c849); Copy Link to Current Heading (d2af3d1); links to headings in PDF and Word exports (803ab9e, 8af88ea).
- **Editing:** Table menu and column tools (60f7c83, 1f20e47); callouts, dates (7490d8d, e5824c1); typewriter scrolling (61d3525); Find in the preview (ef5fca7); line length (5d3a8b1); Fold to Level (607be46, made parser-independent in 462ed75); Dim Other Paragraphs (f6a371d); Toggle Comment (17aa041); math and Mermaid starters (945ac32); Select Section (aba3439, 0813f6d); collapsible Outline (f5d212d); F6 pane focus (d43ac4e, e32b08b); Align tables on save (462ed75).
- **Files:** Explorer recent list without a folder (7d03944) with removal (85b1e2b); drag a file into the editor to link it (2d94dcc); pictures in the Explorer with a preview dialog (c6bb502, d923fe1); Collapse Folders (a68976a); folder for pasted images, used by imports too (9e1b55a, 69045c4); Move Selection to New File (e872484); Save as Template (fb9b1a6); Close All Tabs (eea697e); Show in Explorer (1abc759); Copy Relative Path on tabs (450e1b8); line endings and BOM from the status bar (11c7287, f0606c4); tab folder hints (c6ccd4b).
- **Status bar:** Git change summary (7656bf6), task progress (1d34a1f), Go to Line on Ln/Col (63dd44e), word count goal (147ce22, ba79651).
- **Export, print, review:** title and page numbers when printing and in printed HTML (e0346f6, ed1f537), running titles in PDF and Word (c6d2016, 033cf94); Markdown with Images as .zip (447173b); Copy as Plain Text (457de7a); a new page per top-level heading (e32b08b); word-level diffs and removals before additions (61e554d); the AI review's Changes view (72f9c2e); speaker notes and Print Slides (623102c, dad3d06).
- **Fixes:** long menus ran off short windows (7075686); the Links tab was cut off in a narrow sidebar (665efaf); HTML comments containing `>` leaked text into Word/PDF exports (17aa041); following links from the editor had pulled the Markdown renderer into the startup bundle (3690fe1), now guarded by `tests/startupImports.test.ts` (8a9ab86).
- **Process:** a commit went in with a failing docs-lint test because `vitest | grep && git commit` hides vitest's exit code; it was fixed in the next commit (6fa019a), and every commit since then went through a check script that stops on any failure. The F6 e2e test was flaky in parallel runs because F6 could land on the preview's loading placeholder, which can't take focus; the app now skips it (e32b08b).

**Version:** 0.21.0. **Tests:** Vitest 522 (99 files), Playwright 93, Rust 41 (+1 ignored), website check (50 pages). Startup JavaScript 1,155 KB (384 KB gzipped).

**Unverified:** the new native command parameters (`list_dir` with pictures, `save_image_asset` with a folder, the `zip` export kind) are covered by Rust unit tests and the installer build, not by clicking through the native app (the session ran unattended); F6 inside the native webview (Chromium-based browsers can treat F6 as their own shortcut, though a webview has no toolbar to move to).

**Next up:**

1. Tauri-driver e2e against the native build (needs msedgedriver and `cargo install tauri-driver`; see questions).
2. Per-workspace custom CSS, after weighing the risk of styles from untrusted repositories.
3. Wiki-style `[[links]]`, if wanted (completion, preview, link checks and renames would all need to understand them).

**Questions for the user:**

- May I download msedgedriver (Microsoft) and `cargo install tauri-driver` for native end-to-end tests?
- Local LLMs (SRS §19, for example Ollama) alongside Claude: wanted?
- A redirect repository for the old website address?
- Pictures now show in the Explorer by default (Settings → Files turns them off). Keep that default?

## 2026-09-30 (6:00 AM – 10:00 AM), morning session: 0.22.0

The user asked to keep developing until 10 AM and to release at the end, without installing the release on this machine.

- **Writing:** close brackets automatically, off by default (6fa348a); Insert Snippet, and the palette gives focus back where it was (a6d8c24); Insert Front Matter (7d06e4b); ask for a name when pasting a screenshot (609cf91); a check for front matter without its closing `---` (c9605a8); Open Today's Note (a489f57); sentences, speaking time and Flesch readability in the statistics popover (7024502).
- **Wiki links:** `[[Page]]`, `[[Page|text]]`, `[[Page#Heading]]` in the preview and exports (db2a9cc); link checks and Links to this document (14a2fe4); updated on renames and moves (e968fac) and on Rename Heading (93b7169); heading completion after `[[page#` (8514983).
- **Links:** hover a link to another document to see its start (65a4d01); Mentions without a link in the Links tab (5d63705).
- **Tags:** Go to Tag (e23d946); completion after `#` (d632b70) and in the front matter (5e28f12); labels in the preview and HTML export (f0e5c1e), clickable (d35c970); Rename Tag with F2 (f898ae1); the sidebar's Tags tab (23c6e2d), refreshed on save (7cc0301); each tag shown as most often written (b0c3ec2); a check for a tag in two capitalisations, and lines of tags are no longer "headings without a space" (ed57ef6); coloured in PDF and Word (f9edfec).
- **Files:** a Filter files box in the Explorer; renames and moves update absolute paths too (both committed just before the release commit).
- **Process:** every commit went through the gated check script. One full e2e run failed three tests under load (two were the long accessibility audits); they passed alone and in two full reruns.

**Version:** 0.22.0. **Tests:** Vitest 560 (104 files), Playwright 100, Rust 41 (+1 ignored), website check (50 pages).

**Unverified:** tag labels and the Tags tab weren't looked at in a browser (the dev server couldn't be started from this session); they are covered by unit and e2e tests. The readability score is an estimate (syllables guessed from spelling) and was checked only against one easy and one hard sample. The release was not installed locally, as asked.

**Next up:**

1. Run the new ARM64 build check workflow and, once it passes, add Linux and Windows ARM64 to the release.
2. Tauri-driver e2e against the native build (see questions).

**Questions for the user:**

- May I download msedgedriver (Microsoft) and `cargo install tauri-driver` for native end-to-end tests?
- Local LLMs (SRS §19, for example Ollama) alongside Claude: wanted?
- A redirect repository for the old website address?
- Pictures show in the Explorer by default (Settings → Files turns them off). Keep that default?
- Which languages should the app be translated into?

### After the 0.22.0 release (same morning)

The user asked to work through the whole backlog.

- **macOS menu bar** (8021f2a): the in-app menus go to the system menu bar on macOS (`src-tauri/src/menu.rs`, `features/nativeMenu.ts`, new `setNativeMenu` / `onMenuCommand` in `PlatformApi`), with the standard Markpion and Window menus and macOS's own Undo/Redo/Cut/Copy/Paste/Select All. Items carry no accelerators, so keys keep going through the app's shortcut handling. Unverified: not run on a Mac (it compiles and its menu JSON is unit-tested).
- **ARM64 build check** (d89b646): `.github/workflows/arm64.yml`, run by hand; it publishes nothing. Windows ARM64 built on the first run; Linux ARM64 needed `xdg-utils` for the AppImage, then both built. `release.yml` now builds them for every release from 0.23.0 (ee041b7), and the README template and website list them from that version. Unverified: none has run on ARM hardware; Windows ARM64 has no in-place updates yet.
- **Update prompt:** the user asked for an update check at startup that asks before updating. This already works (`features/updates.ts`): 5 s after launch, if **Check for updates when Markpion starts** is on (the default), the app asks with **Update Now**, **Later** or **Skip This Version**. A skipped version isn't offered again at startup, but **Help → Check for Updates…** still offers it. The 0.22.0 `latest.json` is live, so 0.21.0 installs will be offered this update.

**Can't be done from here:**

- Code signing and notarization (they need certificates or an Apple Developer ID).
- Testing on real Mac and Linux hardware.
- The startup-bundle split (it needs a fork of `@codemirror/lang-markdown`).

**Waiting on your answers:**

- Native e2e tests (msedgedriver download)
- ~~A redirect for the old website address~~: not needed (the user, 2026-09-30).
- ~~Which languages to translate into~~: English only (the user, 2026-09-30); no translation work.
- **Native end-to-end tests** (the user said yes to the download): msedgedriver 154.0.4258.37 (matching WebView2) in `%LOCALAPPDATA%\markpion-dev\`, tauri-driver 2.1.0 via `cargo install`. `npm run test:native` builds a debug app and runs `e2e-native/` with a small built-in WebDriver client. Three tests cover start-up, a file handed over through single instance, saving and reloading a file changed on disk. msedgedriver doesn't pass `args` to the app, so the tests hand files over with a second launch.
- **Incident:** the first native runs set temporary APPDATA/LOCALAPPDATA, but Tauri resolves the known folders directly. They wrote to the real profile: `recent.json` now lists four temporary test files, the saved session opens three of them, and two `history/` folders were added. Settings values were kept. Debug builds now take `MARKPION_TEST_DATA_DIR` for every folder, including web storage (release builds ignore it). The runner fails if the real profile changes. Cleaned up afterwards: the user deleted the two history folders, then approved removing the test entries from `recent.json` and the saved session (backups in %TEMP%).
- **Redirect for the old website address:** not needed (the user).
- **Local AI models** (the user said yes): Settings → AI Assistant lets you choose Claude or a local model through Ollama. It uses `src-tauri/src/ai_local.rs` (loopback addresses only, no proxy, `/api/tags` and streamed `/api/chat`), and the frontend sends `localUrl`. With a local model there's no key and no consent prompt. Unverified: Ollama isn't installed here, so this is tested with unit tests (Rust: address check, parsing, request; UI: settings list, request shape, missing model), not against a running Ollama.
- **Math in PDF and Word:** display formulas in PDF are now typeset by MathJax (`services/mathSvg.ts`, loaded only for exports with math) as vector SVG, on every web engine. Before, they were pictures on Windows only and LaTeX elsewhere, and matrices, arrows and set symbols stayed as LaTeX. Word draws display formulas it can't make native (matrices, environments) as pictures from the same SVG, with the LaTeX as alt text. Checked visually by rendering a sample PDF with pdf.js, and the production bundle loads MathJax in the browser. MathJax is CommonJS: `services/mathjaxEnv.ts` provides the `PACKAGE_VERSION` global it expects, and Vite pre-bundles it. `katex` is no longer a direct dependency (rehype-katex brings its own). Unverified: macOS (WebKit) wasn't tried; the picture route there now uses plain SVG, which WebKit allows on a canvas.

## 2026-09-30 (afternoon): refactoring and UI design, 0.23.0

The user asked to analyse the application and refactor it to be more scalable and robust, and to make the UI more professional and user-friendly.

**Analysis.** The biggest structural risk was the stylesheet: one 2,650-line `app.css` with 17 font sizes, 9 corner radii, 9 shadows and ad-hoc z-index values. Earlier UI bugs came from selectors defined twice in it. The menus lived inside the MenuBar component (File had 45 items, taller than a small window). The command palette gave no hint of where a command lives, and the formatting toolbar wrapped onto two rows in split view.

- **Menus** (c46ae7d): one model in `features/menus.ts` for the in-app menu bar, the macOS menu bar (Rust `menu.rs` builds nested submenus) and the palette's location hints. There are 18 submenus, one level deep, opened by hover, click or →/←. On/off commands have check marks (`Command.checked`, `menuitemcheckbox`). Tests keep every menu at 30 items or fewer and every item pointing at a real command. The docs were updated to the new menu paths (about 40 places).
- **Toolbar** (3f557e9): one row; controls that don't fit (measured on resize, one by one) go into a More menu. At 1280 px in split view link, image and table stay visible.
- **Design system** (fc3efc8): `app.css` is now an index of 16 area files under `src/styles/app/`, with tokens for type, radii, shadows, layers and the remaining overlay colours. `tests/styles.test.ts` rejects literal values, repeated selectors, undefined custom properties and theme colours without a dark value; it was checked by injecting violations. The split was verified pixel for pixel against 28 screens (`e2e-shots/visual.spec.ts`, a local baseline). Normalising near-duplicate values changed only the outline's level labels (9 → 10 px) and 1-pixel corners.
- **Polish** (350b84f): Settings footer (secondary actions left, Done right); Reset to Defaults asks first; narrow Explorer header; eased hover colours with duration tokens.
- **Process:** every commit went through the gated check script (typecheck, Vitest, Playwright, docs check). Two e2e tests failed once each under full-suite load: slides ("session closed") and File History's word diff. Both passed 3–4 times alone and in the next full run. The File History one looks timing-dependent and is worth a look.

**Version:** 0.23.0. **Tests:** Vitest 588 (108 files), Playwright 101, Rust 45 (+1 ignored), visual regression 28 screens (local), website check (50 pages).

**Unverified:** the macOS native submenus compile and their JSON is unit-tested, but weren't run on a Mac. The release was not installed locally, as asked; the in-app updater delivers it.

**Next up:**

1. Look into the File History e2e test that is timing-dependent under load.
2. `commands.ts` (750 lines) could be split by domain the way the menus now are.
3. Spacing tokens: padding and margins still use about 95 literal values.

## 2026-10-01: security, performance and scalability review

The user asked for a review of the code for security, scalability and performance issues, with remedies.

**Reviewed:** the Rust scope checks and every command, Git, AI (Claude and Ollama), updater, storage and logs, the watcher and search; the CSP and capabilities; the Markdown sanitizer and the plugins that run after it; and the per-keystroke paths in the UI.

**Fixed in this commit:**

- **Dependency:** `npm audit` reported a vulnerable `@xmldom/xmldom` (high) under `speech-rule-engine` (from MathJax; not in the app bundle). An override, scoped to that package, moves it to the patched version. A first, unscoped override broke the Word importer (mammoth needs the 0.8 API); the test gate caught it.
- **Privacy:** new setting `previewRemoteImages` (Settings → Preview, lockable by policy). Off, the preview loads no web pictures.
- **Memory:** the preview's picture cache was an unbounded map of data URLs; it's now least-recently-used with a 96 MB budget (`services/lruCache.ts`).
- **Typing in large documents:** the status bar counted words and tasks over the whole text on every keystroke; counts are now deferred, and above 1 MB settle after a pause. The Markdown checks skip documents over 1 MB. One shared limit (`services/limits.ts`) replaces three copies.
- **Logs:** log lines from the UI are capped (64-character category, 2,000-character message) and kept to one line.
- **Bug found by the new tests:** the preview dropped pictures embedded as `data:image/…` (an import opened without saving); they now show.

**Found sound (no change):** path scope and traversal checks; least-privilege capabilities; `git` run with fsmonitor off, no shell and a timeout; the API key stays in Rust and the OS credential store; Ollama limited to loopback; signed updates; sanitizing before any plugin adds markup; Mermaid strict mode; KaTeX without trust.

**Open (documented in TRACEABILITY Known gaps):** preview assets under a lone document's folder tree (absolute paths); base64 IPC for imports. Recommended next: raw-bytes IPC, blocking file I/O off the async runtime, splitting `commands.ts`, and `cargo audit` in CI.

**Tests:** Vitest 593 (109 files), Playwright 101, Rust 46 (+1 ignored). Not released yet.

### Later the same day: the open items from the review

The user asked for every issue found to be fixed.

- **Pictures near a lone document:** on a closer look, "relative paths only" wouldn't narrow anything (the same files are reachable by relative path). The fix is in the rule itself (`scope.rs` `asset_in_reach`): never hidden folders, and only pictures beside the document when it sits directly in the home folder or a drive's root.
- **Imports as raw bytes:** `read_binary_file` returns `tauri::ipc::Response`; the UI gets an `ArrayBuffer`. No base64 round trip.
- **Blocking I/O:** `read_text_file`, `write_text_file` (with its history snapshot), `read_binary_file` and `read_image` run in `blocking(...)`.
- **Linux watching:** folders are watched one by one (up to 4,096, skipping hidden, dependency and build folders), and new folders are added as they appear; Windows and macOS keep the single recursive watch.
- **Command list:** `commands.ts` (764 lines) is now a 139-line registry over `commands/` (core, format, document, edit, view, ai, help). The website's shortcut tables are read from those files; the built page is identical (86 rows) before and after.
- **Dependency audit:** `cargo audit`: 0 vulnerabilities in 542 crates (8 unmaintained/unsound notices in crates that come with Tauri's Linux stack). CI now runs `npm audit` and `cargo audit`.
- Also fixed: the Linux troubleshooting page still said there were no ARM64 builds.

**Unverified:** the Linux watcher on a real Linux desktop (unit-tested here; CI builds and tests it on Ubuntu).

- **Found by the new native test:** a file handed to the app while it was still starting was dropped (the UI wasn't listening for the event yet), for example the second of two files opened together. Paths now wait with the launch paths until the UI asks for them. The native suite (5 tests) covers this, the raw-byte reads and the picture rule in the real app.

**Tests:** Vitest 593 (109 files), Playwright 101, Rust 49 (+1 ignored), native 5.

**Released as 0.23.1** (the review's fixes: d67168a, a95b294). Not installed locally; the in-app updater delivers it.

**Next up:**

1. Run the Linux watcher on a real Linux desktop.
2. Send exports to the native side as raw bytes too.
3. The File History e2e test that is timing-dependent under load.

## 2026-09-30 (9:26 PM – midnight): development loop, 0.24.0

The user asked to keep the development loop going until midnight.

| Item | Commit |
| --- | --- |
| Exports (PDF, Word, zip) reach the native side as a raw request body, with name and kind in headers; a native e2e test exports 70,000 bytes through the real Save dialog (answered by `e2e-native/save-dialog.ps1`) and checks every byte | 34b37a8 |
| The timing-dependent File History e2e test: the edited line wraps, and End goes to the end of a row, not the line; the test now clicks past the end of the last row (10/10 in parallel) | 624b004 |
| Spacing scale `--space-1..10`: 238 values were exact (pixel-identical), 38 off-scale ones folded into the nearest step (1–2px, reviewed); guarded by `tests/styles.test.ts`. The visual check now uses soft assertions | 4957da7 |
| Breadcrumbs above the editor (View → Breadcrumbs), with jumps to sibling headings | 8c53135 |
| Long documents previewed section by section (800 KB: 1.6 s instead of 12.6 s to first display, dev build), with an equivalence test against the single pass | dd8f0bd |

**Bug found by the equivalence test:** the outline's heading list counted `#` lines in HTML comments, `<pre>` and `$$` math as headings, unlike the preview; fixed in dd8f0bd.

**Version:** 0.24.0. **Tests:** Vitest 606 (112 files), Playwright 103, Rust 50 (+1 ignored), native 5, visual regression 28 screens (local), website check.

**Unverified:** the sectioned preview on macOS (WebKit) and Linux; the speed-up was measured in the development build on Windows.

**After the release:** sections below an edit no longer re-parse when their line numbers shift: each is parsed with its own line numbers and its wrapper carries the offset (`data-line-offset`, read by `previewBlockLine` for scroll sync and double-click). A test counts parses: an edit at the top re-parses one section (86583c2). **Released as 0.24.1.** Tests: Vitest 607 (112 files), Playwright 103 (the slide show and the dark-theme audit failed once each under full-suite load and passed alone), Rust 50 (+1 ignored).

**Next up:**

1. A smaller startup bundle.
2. The Linux watcher on a real Linux desktop.

## 2026-10-01 (7:14 AM – noon): development loop, 0.25.0

The user asked to keep the development loop going until 12 PM.

| Item | Commit |
| --- | --- |
| Start-up bundle 120 KB smaller: a light HTML language for the Markdown editor (`services/markdownHtml.ts`, swapped in by `vite.config.ts`), checked against `@codemirror/lang-html`; CI start-up budget (`npm run check:startup`, 370 KB gzipped) | ccc2f18 |
| Settings, About and the Links panel load on first use; the demo backend only loads in the browser (`loadBackend`). Start-up now 1,042 KB (343 KB gzipped), from 1,203 KB (402 KB) | f8e847f |
| Dialogs that load on first use give focus back to the editor (`rememberFocus`) | 4b7f0ac |
| Browser demo: downloads aren't cancelled on a busy machine; the pickers work without `prompt()` | a9801e9, de7096e |
| Reflow Paragraph (Alt+Q) and Unwrap Paragraph; the editor keymap now includes Edit menu commands (their shortcuts did nothing while typing) | 649fb1b |
| Export as EPUB, Export Folder as One E-book, and a front matter cover picture; CI validates sample books with EPUBCheck | ac75195, 34c2eda, 10aefac, 9a1cc6a |
| Footnote and anchor links work in exported HTML and EPUB (they pointed at ids without the sanitizer's `user-content-` prefix) | 9a1cc6a |
| PDF inline formulas with arrows, set symbols and `\mathbb` capitals, set in KaTeX's fonts (OFL, from the `katex` package) | 2390937, 513b7e4 |
| Import E-book (.epub), also in Convert Folder to Markdown | cf4868f |
| Export as LaTeX and Export Folder as One LaTeX Document; CI compiles sample documents with pdflatex | fa86e7b, 06b2b84 |
| `npm run version:set` updates `package-lock.json` too | release commit |
| Test reliability: the slides test no longer opens example.com in a popup (it stalled the browser under load); print tests wait for the app; the compare step of the accessibility audit waits for the file list; light-HTML tests parse fully before checking | fa86e7b, 4b7f0ac, 9a1ca52, 06b2b84 |

**Version:** 0.25.0. **Tests:** Vitest 656 (119 files), Playwright 110, Rust 50 (+1 ignored), native 5 (now also exporting an EPUB and a LaTeX file through the real Save dialog; the start-up handover test timed out once right after the release build on the busy machine and passed on the rerun), website check. CI also runs EPUBCheck and pdflatex on sample output.

**Released as 0.25.0** at 10:51 (release workflow, CI and documentation passed; all 11 download links and latest.json return 200). **After the release:** Copy as LaTeX (File → Copy As), the selection or document without the preamble; nested scripts of digits and signs in PDF inline formulas (`e^{-x^2}`) as Unicode script characters. Tests: Vitest 658, Playwright 111.

**Unverified:** EPUB files in e-reader apps (only EPUBCheck and XML checks); LaTeX output with XeLaTeX/LuaLaTeX and on real documents beyond the CI samples; the KaTeX font fallback in PDFs opened outside pdf.js (the text extraction test reads the symbols back).

**Notes:** full local e2e runs were slowed by other processes on this machine (CPU at about 60% between runs); single failures under that load passed when rerun, and CI passed throughout. The project has no third-party notices file; the KaTeX fonts embedded in PDFs are OFL-licensed, which a notices file should list once the license question (SRS §21) is settled.

**Next up:**

1. Open exported EPUBs in e-reader apps (Apple Books, Calibre, Thorium) and record the results.
2. The Linux watcher on a real Linux desktop.
3. Nested scripts with letters (`e^{x^y}`) in PDF inline formulas.

**Questions for the user:**

- Should Markpion ship a third-party notices file (it bundles Roboto, KaTeX fonts and many npm packages)? This depends on the license decision in SRS §21.

## 2026-10-01 (afternoon): notices, feedback and repository protection, 0.25.1

The user asked for a third-party notices file, for error reporting and feedback in the app, and for the GitHub repository to require their permission for any change.

| Item | Commit |
| --- | --- |
| Copy as LaTeX (File → Copy As) | 875d0fc |
| PDF inline formulas: nested scripts of digits and signs as Unicode script characters | b0b8430 |
| `THIRD_PARTY_NOTICES.md` (3 fonts, 382 npm packages, 516 Rust crates, with license texts; per-OS native binaries are left out, after CI showed they differ between Windows and Linux), generated by `npm run notices`, checked in CI, installed beside the app, Help → Third-Party Notices. Roboto 3.014 turned out to be OFL-1.1 (read from the font file), not Apache-2.0 | 4f67600, 6b586f5 |
| Help → Send Feedback / Report a Problem, Report on error messages, failed areas and the crash screen; GitHub issue or email (nasim.uddinbd02@gmail.com, given by the user), or copy; nothing sent automatically | 973b401, fbd4fdb |
| GitHub: rulesets on `main` (code-owner approval, 6 CI checks, no force push or deletion) and on `v*` tags (owner only); fork workflows need approval for all outside contributors; the owner bypasses, so direct pushes and releases still work (checked with a real push) | e0fdb0a, 5bbf263 (settings changed through the GitHub API) |

**Version:** 0.25.1. **Tests:** Vitest 669 (120 files), Playwright 114, Rust 50 (+1 ignored), native 5 (with the 0.25.0 changes), website check.

**Unverified:** the notices file in an installed app (the Tauri bundle resource is new in this release); Send by Email with real mail apps (the link format is unit-tested).

**Not done:** installing a new version on this machine was refused by the permission system; the user's installed copy is 0.23.1 and can update through Help → Check for Updates.

**Next up:**

1. Check the installed 0.25.1: Help → Send Feedback, Help → Third-Party Notices, and the notices file in the install folder.
2. Open exported EPUBs in Apple Books, Kobo or Calibre (epub.js renders them in an e2e test).
3. The Linux build on a physical Linux desktop (the native tests run in CI under a virtual display).

## 2026-10-01 (late afternoon): development loop, 0.25.2

| Item | Commit |
| --- | --- |
| Visual check: File → Export baseline updated for the new items (reviewed); the Send Feedback dialog added (30 screens) | 3878d9a |
| EPUB: a chapter file per top-level section, links and footnotes rewritten across chapters; EPUBCheck in CI caught `aria-describedby` pointing into another chapter, fixed | d70988a, 9c50f70 |
| The user reported that none of the Send Feedback buttons worked: they were disabled until a summary was typed, and disabled buttons looked enabled (no `:disabled` style anywhere). The buttons now explain the missing summary; disabled buttons are faded. A native test clicks the dialog's buttons in the real app | 4d6d4be |

**Mistake:** a first version of the native feedback test tried to stub `open_external` in the page; the stub didn't take effect in the real web view, and one GitHub "new issue" page opened in the user's browser (nothing was submitted). The test no longer clicks Open on GitHub or Send by Email.

**Version:** 0.25.2. **Tests:** Vitest 673 (120 files), Playwright 114, Rust 50 (+1 ignored), native 6, visual 30 screens (local).

## 2026-10-01 (evening): regression suite, skills and a UI audit, 0.25.3

The user asked for an end-to-end UI regression suite run before every release, saved as a skill, with all skills kept in the repository, and then to continue the loop with UI testing.

| Item | Commit |
| --- | --- |
| `npm run test:regression` (`scripts/regression.mjs`): every check in order with a report; `release:installer` requires a full pass for the commit. Skills committed in `.claude/skills/`: `dev-loop`, `ui-regression`, `release` | ab377b1, 6923a49 |
| Layout checks (`e2e/layout.spec.ts`) at 720×480, 1024×640 and 1366×768 in both themes, over 20 screens, dialogs and panels | 09a21da, 3069d5d |
| Bugs they found: Keyboard Shortcuts' Close button and Report a Problem's buttons off screen in short windows (dialog buttons are now sticky); a narrow sidebar's search box with room for a few letters (options move under it below 240px); result file names cut mid-word, hiding the match count | 09a21da, 3069d5d |

**Version:** 0.25.3. **Tests:** Vitest 673 (120 files), Playwright 126 (12 layout checks), Rust 50 (+1 ignored), native 6, visual 30 screens (local). The full regression run passed for the release commit's code.

**Unverified:** the sticky dialog buttons and the narrow search box on macOS (WebKit) and Linux (WebKitGTK); both use widely supported CSS (`position: sticky`, `:has()`, container queries), but they were checked only in Chromium/WebView2.

**Next up:**

1. A layout check of the AI panel (it shows only during an AI request, so it needs a stubbed response).
2. Open exported EPUBs in Apple Books, Kobo or Calibre (epub.js renders them in an e2e test).
3. The Linux build on a physical Linux desktop (the native tests run in CI under a virtual display).

## 2026-10-01 (evening, until 8:30 PM): planned items and LaTeX with pictures, 0.26.0

The user asked to complete the planned items, then to continue the loop until 8:30 PM.

| Item | Commit |
| --- | --- |
| Layout checks for the slide show (with notes) and the table picker (the toolbar shows its button only in wide windows, so the check widens the window for it) | 470d799 |
| The AI review in the layout checks and an axe audit, with a stand-in AI for the browser demo (`window.__markpionE2eAi`, test only); e2e first page loads get 20 s after four audits timed out waiting for a cold dev server | 7cec254 |
| Exported e-books opened and rendered in epub.js (every chapter, pictures, contents links, a footnote and a link across chapters) | 7bd9f00 |
| Native app tests on Linux in CI (WebKitWebDriver, xvfb, D-Bus): all 6 pass on Ubuntu 22.04, including the file watcher | a5772a0, 6bd6426 |
| Export as LaTeX with Pictures (.zip): pictures (SVG to PNG) and Mermaid diagrams as PNG figures; CI compiles a sample with both | 1fc1d47 |
| Two tests that failed under load: the light-HTML auto-close test now uses forceParsing (ensureSyntaxTree doesn't update the view's state) | 744aa60 |
| **Bug found by the native hand-over test** (it failed intermittently, and still with a 45 s timeout): a second launch's message could arrive while setup created the main window (WebView2 runs a nested message loop), before the app state was registered; `app.state()` then panicked mid-message and the second copy waited forever. Paths that arrive that early now wait in a queue that setup takes with the launch paths. Passed 3 native runs, 2 of them under load | 68c67d3 |

**Version:** 0.26.0. **Tests:** Vitest 674 (120 files), Playwright 142 (24 layout checks, 1 epub.js test), Rust 51 (+1 ignored), native 6 (Windows locally, Linux in CI), visual 30 screens (local). The full regression run passed for the release commit (68c67d3), with no flakes.

**Unverified:** e-books in Apple Books, Kobo or Calibre (epub.js renders them); the Linux build on a physical desktop (the native tests run under a virtual display); LaTeX with Pictures compiled with real documents beyond the CI sample.

**Next up:**

1. macOS: there's no WebDriver for its web view, so native tests can't run there; a manual check list for a Mac.
2. In-place updates for macOS and Linux, which need the updater key as a repository secret (the user's decision).
3. Large documents (several MB) with every section open in the preview.

**Questions for the user:**

- Should the updater key be added as a GitHub repository secret, so macOS and Linux get in-place updates too? It's the same key that signs Windows updates; anyone with access to the repository's secrets could then sign updates.

**After the release (until 8:30 PM):** 0.26.0 published and verified (the offline installer's upload failed four times with the connection aborted on this machine, then went through on a retry; its checksum matches). The user asked to build every remaining feature except cloud integration, then be reminded to start the cloud work. Started with source control: `git_write.rs` lists staged and unstaged changes and stages, unstages and commits through the user's git, with tests against temporary repositories (0b0cf82); not in the UI yet.

**Next up (the user's plan: all non-cloud features first):**

1. Source control in the UI: Tauri commands with scope checks (the open folder only), a Source Control sidebar tab (staged and unstaged files, stage/unstage, a commit message box and Commit), diffs against HEAD, tests at every level (Rust, unit, e2e with layout and axe checks, native).
2. Pull and push with the system's Git credentials; branches.
3. Publishing to static sites and documentation platforms.
4. A plugin system: a design for the user's approval first (plugins must not reach the IPC or the API key).
5. Large documents with every section open; the last inline-math cases in PDF.
6. Then remind the user to start the cloud integration (sync, collaboration, the cloud backend).

## 2026-10-01 (night): Source Control, 0.27.0

The user asked to continue with the remaining non-cloud features (Git first).

| Item | Commit |
| --- | --- |
| Source Control tab: changed files staged and not, stage/unstage, commit through the user's git; demo repository model for the browser; scope checks on the root and every path | 1419071 |
| The layout checks found a fifth sidebar tab didn't fit the narrowest window (the sidebar scrolled sideways when a button got focus); icon-only tabs now share the width, and the checks flag a sidebar wider than itself | 1419071 |
| Branches (switch, create), pull (fast-forward only) and push (sets the upstream), with a two-minute limit for network commands; privacy page lists pull/push as user-started connections; disabled icon buttons are faded | 015f934 |

**Version:** 0.27.0. **Tests:** Vitest 679 (121 files), Playwright 145, Rust 59 (+1 ignored), native 7 (Windows locally, Linux in CI: they commit, push and pull with real Git against a local bare remote), visual 32 screens (local).

**Unverified:** pull and push against a hosted remote (GitHub) with a credential helper; the tests use a local bare repository, which runs the same git commands without the network.

**Next up (the user's plan):**

1. Publishing to static sites and documentation platforms.
2. A plugin system (design for the user's approval first).
3. Large documents with every section open; the last inline-math cases in PDF.
4. Then remind the user to start the cloud integration.

## 2026-10-01 (late night): publishing and the last PDF math cases, 0.28.0

Continuing the user's plan (every non-cloud feature, then the cloud integration).

| Item | Commit |
| --- | --- |
| Publish Folder to GitHub Pages: the HTML site's pages committed to gh-pages through a temporary index (work tree, index and current branch untouched), on top of the remote's gh-pages so the push fast-forwards; .nojekyll; the Pages address from a GitHub remote; site building shared with Export Folder as HTML Site (`buildSite`) | c9a8967 |
| PDF inline math: \notin and \not before relations as the symbol with a slash (placed like KaTeX, scaled to heading, footnote and script sizes), AMS negated relations, nested letter scripts in the linear form, inline matrices row by row; the parser reads \not and matrix environments (Word keeps a matrix's LaTeX) | f777ac4 |

**Version:** 0.28.0. **Tests:** Vitest 688 (122 files), Playwright 146, Rust 63 (+1 ignored), native 7 (the Source Control test now also publishes to gh-pages on a local bare remote; Linux in CI too), visual 32 screens (local; the File menu baseline was re-recorded for the new Publish row).

**Unverified:** publishing to a real GitHub repository (the tests use a local bare remote, which runs the same git commands without the network); GitHub Pages must be turned on once in the repository's settings, which Markpion can't do without an account.

**Left in PDF math:** accents (\hat, \vec, \overline: the bundled fonts lack the combining marks) and commands outside the subset (\binom, \mathcal) keep their LaTeX. Copying ∉ from a PDF gives "∈/".

**Next up (the user's plan):**

1. A plugin system: a design for the user's approval first (proposed in this session).
2. Large documents (several MB) responsive with every section open.
3. Then remind the user to start the cloud integration (sync, collaboration, cloud backend, and publishing to platforms that need an account such as Confluence).
