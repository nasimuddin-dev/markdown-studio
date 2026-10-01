---
name: release
description: Publish a new Markpion version end to end: regression run, version bump, signed installers, release notes and docs, GitHub release, and verification of the macOS/Linux builds, CI and every download link. Use when the user asks to release, publish or ship a version, or when a development loop reaches its release point.
---

# Releasing Markpion

Follow every step; a release is done only when the last check passes. Commits and pushes to `main`, and `npm run release:github`, are approved for this project. Never force-push, rewrite history, or delete branches, releases or tags. Never commit the updater key (it lives in `~/.tauri/`), and don't install the new version on the user's machine unless they ask.

## 1. Regression (required)

Commit everything, ask the user to close Markpion if it's open, then run the whole suite (see the `ui-regression` skill):

```bash
npm run test:regression
```

Release only on **ALL REGRESSION CHECKS PASSED**. `release:installer` checks this itself and refuses to build otherwise.

## 2. Version and installers

Choose the version: patch for fixes, minor for new features.

```bash
npm run version:set 0.0.0
```

```bash
npm run release:installer -- --offline
```

`version:set` updates `package.json` and its lockfile, `tauri.conf.json`, `Cargo.toml` and the browser demo. The installer build takes about 20 to 25 minutes; run it in the background and write the docs meanwhile. It signs the Windows installer for in-app updates, writes `release-assets/latest.json`, replaces the installer in `downloads/`, and refreshes the download section of `README.md` and the links in `docs/INSTALL.md`: check both.

## 3. Release documents

Written from the release's actual commits (`git log --oneline <previous tag>..HEAD`); document only what the code does.

- `docs/site/changelog.md`: a new entry at the top with **Added / Changed / Fixed / Security**, in plain words for users.
- `docs/TRACEABILITY.md`: the "as of" version, and the test counts (Vitest tests and files, Playwright, Rust, native, visual screens).
- `docs/SRS.md`: "Current Product Version" only.
- `docs/DEV_LOG.md`: a dated entry with each item and its commit hash, the version, test counts, anything unverified, "Next up", and questions for the user.

Then `npm run docs:check`, the type check and unit tests, and commit as `Release x.y.z: <highlights>` and push.

## 4. Publish

```bash
npm run release:github
```

It creates the GitHub release and tag `v<version>` with the Windows installers, checksums and `latest.json`. The tag starts `.github/workflows/release.yml`, which builds the macOS and Linux installers.

## 5. Verify (don't skip)

- Watch the **Release** and **CI** runs for the release commit to completion (`gh run watch <id>`); both must succeed. If CI fails, read the failing job's log and fix it.
- Every download link in the README's download section, and `https://github.com/nasimuddin-dev/markpion/releases/latest/download/latest.json`, must return 200, and `latest.json` must carry the new version:

```bash
curl -sIL -o /dev/null -w "%{http_code}" <url>
```

Then tell the user the version is out, how to get it (Help → Check for Updates in the app), and what changed.
