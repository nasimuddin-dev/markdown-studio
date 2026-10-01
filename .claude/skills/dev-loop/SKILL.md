---
name: dev-loop
description: Markpion's development loop: pick an improvement, build it, test it, document it, commit and push, watch CI, repeat, and release at intervals. Use when the user asks to continue or run the development loop, to suggest and build features, or to work on Markpion for a period of time.
---

# Markpion development loop

Repeat until the user's time is up: pick → build → test → document → commit → watch CI. Release when features have built up, and always before the session ends if user-visible changes are unreleased (see the `release` skill). Project rules are in `AGENTS.md`; follow them.

## 1. Pick

In order of preference:

1. Problems the user reported, especially from the installed app. Find the root cause, fix it, and release promptly.
2. Real bugs found along the way, including tests that keep failing (investigate before calling a failure a flake).
3. Items from the `docs/DEV_LOG.md` "Next up" list, the website roadmap's **Planned** section (`docs/site/roadmap.md`) and the Known gaps in `docs/TRACEABILITY.md`.
4. New features that fit a local-first Markdown editor; check `docs/site/features.md` first so you don't rebuild something that exists.

## 2. Build

- Layering: `services/` ← `stores/` ← `features/` ← `components/`; host-specific code only in `services/`; native file access only through Rust commands with scope checks.
- Load rarely used code with dynamic `import()`; `npm run check:startup` enforces the start-up budget.
- Styles in `src/styles/app/<area>.css` with the tokens from `tokens.css`. Every new control works in both themes and by keyboard.
- Editing files: on Windows, Git Bash heredocs, `sed` and `node -e` can drop backslashes. Use the Edit tool, or a `.cjs` script written with the Write tool, for code with escapes.

## 3. Test

- Add tests with the change: Vitest for logic and components, a Playwright flow (and an axe audit for new UI) in `e2e/`, a screen in `e2e-shots/visual.spec.ts` for new UI, a Rust unit test for Rust changes, and a native test in `e2e-native/` for Rust commands, IPC or behaviour of the real web view.
- Check that a new test fails without the fix when you can (`git stash` the source change, run, `git stash pop`).
- Gate every commit on the commands' own exit codes, never through a pipe:

```bash
npm run test:regression -- --quick
```

  That runs the type check, unit tests, build, notices, end-to-end and accessibility tests, and docs check. After UI changes, run the full `npm run test:regression` (the `ui-regression` skill), which adds the visual comparison and the native tests.
- Full e2e runs can fail one test when the machine is busy; the runner reruns failures once. If the same test fails again, or keeps failing across runs, it's a real problem: read its trace.

## 4. Document (same commit)

`README.md` (Features), `docs/TRACEABILITY.md` (a row in "Beyond the MVP"; Known gaps for limitations), the matching `docs/site/` pages (features, guide, Markdown, troubleshooting, FAQ, privacy), `docs/DESIGN.md` for architecture changes, and `docs/SRS.md` only for status notes and §21 answers. Document only what the code does. Then `npm run docs:check`.

## 5. Commit, push, watch CI

- Commit with a message that says what changed for users and why, and push to `main`. The owner's pushes bypass the branch rules; never weaken those rules.
- **Watch the CI run for every push to completion** (`gh run watch <id>`, in the background while you continue). A red CI is the next item to fix. CI also runs EPUBCheck, pdflatex and the notices check, which local runs may not.
- After changing dependencies: `npm run notices` and `npm run check:unused`.

## 6. Report

Keep the user informed with short status notes. At the end of a session, add a dated `docs/DEV_LOG.md` entry (items with commit hashes, test counts, anything unverified, "Next up", questions for the user), and summarise for the user what shipped, what's released, and what needs their decision.
