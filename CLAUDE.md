# Markpion: project rules

## Keep the documentation in sync (required)

A feature or change is not done until the documents describe it. Update them **in the same commit** as the code.

### After every feature, fix or behaviour change

| Document | What to update |
| --- | --- |
| `README.md` | The Features list; the Project structure if a module or folder was added; Development if scripts changed |
| `docs/TRACEABILITY.md` | The requirement row or the "Beyond the MVP" table (with source location); Known gaps |
| `docs/site/` | The matching website page: `features.md`, and the guide page (`guide/*.md`), Markdown page (`markdown/*.md`), troubleshooting or FAQ entry it affects. Keyboard shortcut tables are generated from `src/features/commands.ts`, so there's no manual edit for those |
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

- Layering: `services/`, `stores/`, `features/`, `components/`. Native file access goes only through Rust commands with `Scope` checks; never grant the frontend fs, dialog or shell permissions.
- Tests: Vitest for logic, Playwright e2e for user flows (it includes WCAG audits), and Rust unit tests for Rust changes.
- Never commit secrets or signing keys (the updater key lives in `~/.tauri/`).
