---
name: ui-regression
description: Run Markpion's full end-to-end and UI regression suite (functional flows, accessibility audits, visual comparison of 30 screens, native app tests) and review the results. Use before every release, after any feature or fix that changes the UI, and whenever the user asks for regression or UI testing.
---

# UI regression testing

Markpion's regression suite is one command. Run it before **every** release and after any change a user could see. `release:installer` refuses to build a release unless it passed, in full, for the exact commit being released.

## 1. Prepare

- Commit your work first: a run with uncommitted changes reports its results but doesn't clear a release.
- **Markpion must be closed** for the native tests. Never close the user's Markpion yourself; if it's open, ask them to close it, or run with `--no-native` for a check that won't clear a release.

## 2. Run

```bash
npm run test:regression
```

It runs, in order, and writes `regression-report/report.md`:

| Step | What it checks |
| --- | --- |
| Type check, unit tests | `tsc`, Vitest (logic, components, converters) |
| Build and start-up budget | production build; start-up JavaScript within its budget |
| Third-party notices | `THIRD_PARTY_NOTICES.md` matches the dependencies |
| End-to-end + accessibility | Playwright user flows against the browser demo, with axe WCAG 2.1 AA audits in light and dark themes, and layout checks at 720×480, 1024×640 and 1366×768 (`e2e/layout.spec.ts`: no sideways scrolling, dialogs and their buttons on screen, no overlapping or clipped controls). Failures are rerun once alone: passing on the rerun means machine load, failing again means a real failure |
| Visual comparison | 30 screens (both themes), pixel for pixel against the local baseline in `e2e-shots/out/visual/` |
| Native (real app) | tauri-driver tests against the real Windows app (CI also runs them on Linux) (start-up, file handover, saving, raw-byte IPC, Save dialog exports, the feedback dialog) |
| Documentation | the website builds and its links resolve |

Options: `--no-native` (skip the native tests), `--quick` (skip visual and native). Neither clears a release.

## 3. Review

- **Every step passed:** the report says so and `.regression-pass.json` records the commit. Say what ran and the counts.
- **A test failed again on its rerun:** it's a real failure. Read its log (path in the report) and the Playwright error context in `test-results/<test>/error-context.md`. For a test that hangs or times out, read the step timings from its trace: unzip `trace.zip` and pair the `before`/`after` events in `test.trace`. Fix the cause (several "flakes" in this project were real bugs), then run again.
- **Screens changed** (visual step failed): open every listed `*-diff.png` together with its `*-actual.png`. Look for overlapping or cut-off text, misalignment, wrong colours in either theme, and controls that look clickable but aren't (or the reverse). The pixel comparison uses one window size; for layout at other sizes rely on `e2e/layout.spec.ts`, and look at screenshots at 720×480 when a dialog or panel changed. If every change is intended, record the new baseline and run again; otherwise fix the UI:

  ```bash
  npm run test:visual:update
  ```

- **Native not run** because Markpion was open: ask the user to close it, then run again.

## 4. Keep the suite growing

When a feature adds or changes UI, extend the suite in the same commit:

- a Playwright flow in `e2e/` for what the user does (`workflows.spec.ts`, or a new spec);
- an axe audit for a new dialog, panel or menu in `e2e/accessibility.spec.ts` (both themes);
- open the new dialog or panel in `e2e/layout.spec.ts`, so it's checked at every window size down to the 720×480 minimum;
- a screen in `e2e-shots/visual.spec.ts`, avoiding text that changes every release (such as the version), then record the baseline;
- a native test in `e2e-native/app.test.mjs` when Rust commands, IPC or the real web view matter. Native tests must never open the user's browser or mail app (the IPC can't be stubbed in the real web view), and must never close the user's Markpion.

Update the screen and test counts in `AGENTS.md` and `docs/TRACEABILITY.md` when they change.
