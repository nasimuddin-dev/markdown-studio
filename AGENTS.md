# Markpion: guide for contributors and coding agents

Markpion is a desktop Markdown editor: Tauri 2 (Rust) + React 19 + TypeScript + CodeMirror 6.
This file is the single source of project rules; `CLAUDE.md` imports it.

## Map of the code

| Folder | What lives there |
| --- | --- |
| `src/services/` | Everything host-specific. `backend.ts` defines the `Backend` interface (dialogs, files, workspace, storage, platform, AI) and `capabilities`; `tauriBackend.ts` is the desktop implementation, `memoryBackend.ts` the in-browser one (tests, e2e, demo). `services/index.ts` picks one; nothing else checks for Tauri. Also Markdown rendering (`markdown.ts`) and export converters (`convert/`). |
| `src/stores/` | Zustand state: documents, workspace, settings (+ IT `policy.ts`), UI, AI. No UI code. |
| `src/features/` | Behaviour: commands and shortcuts (`commands.ts`), editor helpers, save/close lifecycle, export, AI actions (`ai.ts`). Calls `backend()`, never Tauri directly. |
| `src/components/` | React UI. Reads stores, calls features. |
| `src-tauri/src/` | Rust. `commands/` holds the Tauri commands by domain; `scope.rs` limits file access to what the user opened; `ai.rs` calls the Claude API (the API key stays in Rust and the OS credential store). |
| `tests/`, `e2e/`, `e2e-native/` | Vitest unit tests; Playwright flows with axe accessibility audits (run against `MemoryBackend`); a few tauri-driver tests against the real Windows app. |
| `docs/` | SRS, TRACEABILITY, DESIGN (architecture diagrams), INSTALL, DEV_LOG; `docs/site/` is the documentation website's content (built by VitePress from `website/`). |
| `scripts/` | Versioning, installers, GitHub release, test fixtures. |

To support a new host (for example a cloud version), implement `Backend` and choose it in `services/index.ts`; see `docs/DESIGN.md` §13.

## Commands

| Task | Command |
| --- | --- |
| Type check / unit tests / e2e | `npm run typecheck`, `npm test`, `npm run test:e2e` |
| Native e2e (Windows, real app) | `npm run test:native` (needs `cargo install tauri-driver --locked`; close Markpion first) |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Unused files, exports and dependencies | `npm run check:unused` |
| Run the app | `npm run tauri:dev` (browser only: `npm run dev`) |
| Documentation site | `npm run docs:check`, `npm run docs:test` |

## Keep the documentation in sync (required)

A feature or change is not done until the documents describe it. Update them **in the same commit** as the code.

### After every feature, fix or behaviour change

| Document | What to update |
| --- | --- |
| `README.md` | The Features list; the Project structure if a module or folder was added; Development if scripts changed |
| `docs/TRACEABILITY.md` | The requirement row or the "Beyond the MVP" table (with source location); Known gaps |
| `docs/site/` | The matching page: `features.md`, and the guide page (`guide/*.md`), Markdown page (`markdown/*.md`), troubleshooting or FAQ entry it affects. Keyboard shortcut tables are generated from `src/features/commands.ts`, so there's no manual edit for those |
| `docs/DESIGN.md` | If the architecture, a layer's responsibilities or the `Backend` interface changed |
| `docs/INSTALL.md`, `docs/site/installation/*` | If installing, updating or platform support changed |
| `docs/SRS.md` | Only the *Status* notes, revision history and §21 answers. Never rewrite requirement text |

Then run `npm run docs:check` (and `npm run docs:test` for website UI changes) along with the app's tests.

### At every release

- `npm run version:set`, then `npm run release:installer -- --offline`. This regenerates the README download section and the INSTALL.md links; check them.
- Add an entry at the top of `docs/site/changelog.md` (Added / Changed / Fixed / Security), written from the release's actual commits.
- Update the TRACEABILITY "as of" version and test counts, and the SRS "Current Product Version".
- Add a dated `docs/DEV_LOG.md` entry: features with commit hashes, version, test counts, anything unverified, "Next up", and questions for the user.
- `npm run release:github`, then confirm that the macOS/Linux workflow (`.github/workflows/release.yml`) passes and all download links return 200. The website's version and download links update themselves from `package.json`, and the documentation workflow redeploys it.

### Accuracy

Document only what the code actually does, and check the source when unsure. No invented features, versions, ratings, prices, user counts or performance claims. When you find a limitation, document it, and add it to TRACEABILITY's Known gaps and the website roadmap.

## Other conventions

- Layering: `services/` ← `stores/` ← `features/` ← `components/`. Host-specific code (Tauri, window, file system) goes only in `services/`.
- Native file access goes only through Rust commands with `Scope` checks; never grant the frontend fs, dialog or shell permissions.
- Load heavy, rarely used code (exporters, Mermaid, KaTeX, dialogs) with dynamic `import()` so startup stays small.
- Tests: Vitest for logic, Playwright e2e for user flows (it includes WCAG audits), and Rust unit tests for Rust changes.
- Never commit secrets or signing keys (the updater key lives in `~/.tauri/`). The AI API key must never reach the web view.
