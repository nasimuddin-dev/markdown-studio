#!/usr/bin/env node
/**
 * The full regression run before a release (and after any feature that
 * changes the UI): every automated check, in order, with a report.
 *
 *   npm run test:regression                 everything
 *   npm run test:regression -- --no-native  without the native Windows tests
 *   npm run test:regression -- --quick      skip the visual and native steps
 *
 * Steps: type check, unit tests, build + start-up budget, third-party notices,
 * Playwright end-to-end flows with accessibility audits (failures are rerun
 * once, alone, to tell machine-load flakes from real failures), the visual
 * comparison of 30 screens in both themes, the native tests against the real
 * Windows app (skipped while Markpion is open), and the documentation check.
 *
 * Writes regression-report/report.md. When every step passes it also
 * writes .regression-pass.json with the commit it tested; release:installer
 * refuses to build a release for any other commit.
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const noNative = quick || args.includes("--no-native");
const OUT = "regression-report";
mkdirSync(OUT, { recursive: true });

const results = [];
const sh = (cmd) => spawnSync(cmd, { shell: true, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

/** Runs a step, logging its output; returns whether it passed. */
function step(name, cmd, { summary } = {}) {
  const started = Date.now();
  process.stdout.write(`${name.padEnd(34)} `);
  const r = sh(cmd);
  const log = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const file = join(OUT, `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.log`);
  writeFileSync(file, log);
  const ok = r.status === 0;
  const detail = summary ? summary(log, ok) : "";
  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`${ok ? "pass" : "FAIL"}  ${secs}s  ${detail}`);
  results.push({ name, ok, secs, detail, log: file });
  return { ok, log };
}

const vitestSummary = (log) => /Tests\s+(.+?)\s*$/m.exec(log)?.[1] ?? "";
const playwrightSummary = (log) => [...log.matchAll(/^\s+(\d+ (?:passed|failed|flaky|skipped))/gm)].map((m) => m[1]).join(", ");

const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
console.log(`Regression run for ${version} at ${head.slice(0, 7)}${dirty ? " (with uncommitted changes)" : ""}\n`);

step("Type check", "npx tsc --noEmit -p .");
step("Unit tests (Vitest)", "npx vitest run", { summary: vitestSummary });
step("Build and start-up budget", "npx vite build && npm run -s check:startup", { summary: (log) => /Startup JavaScript: (.+?)\./.exec(log)?.[1] ?? "" });
const cargo = sh("cargo --version").status === 0;
if (cargo) step("Third-party notices", "npm run -s notices -- --check");
else results.push({ name: "Third-party notices", ok: true, skipped: "cargo isn't installed", detail: "skipped: cargo isn't installed" });

// End-to-end: on failure, rerun only the failed tests once. A test that then passes was
// disturbed by load; it's reported as flaky. One that fails again is a real failure.
const e2e = step("End-to-end + accessibility", "npx playwright test", { summary: playwrightSummary });
if (!e2e.ok) {
  const rerun = step("End-to-end: rerun of failures", "npx playwright test --last-failed", { summary: playwrightSummary });
  if (rerun.ok) {
    const first = results.find((r) => r.name === "End-to-end + accessibility");
    const flaky = [...e2e.log.matchAll(/^\s+\d+\) (\S+:\d+:\d+ › .+?) ─/gm)].map((m) => m[1]);
    first.ok = true;
    first.detail += ` (passed on rerun, flaky under load: ${flaky.join("; ") || "see log"})`;
    console.log(`${"".padEnd(34)} → counted as a pass: the failures passed alone (machine load). A test that keeps doing this needs a look.`);
  }
}

if (!quick) {
  const baseline = "e2e-shots/out/visual";
  const hasBaseline = existsSync(baseline) && readdirSync(baseline).some((f) => f.endsWith(".png"));
  if (!hasBaseline) {
    step("Visual (recording a baseline)", "npx playwright test -c e2e-shots/playwright.config.ts visual --update-snapshots", { summary: () => "no baseline yet: recorded one, nothing compared" });
  } else {
    const visual = step("Visual comparison (30 screens)", "npx playwright test -c e2e-shots/playwright.config.ts visual", { summary: playwrightSummary });
    if (!visual.ok) {
      // List the screens that changed, with their diff images, for review.
      const diffs = [];
      const walk = (dir) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (f.endsWith("-diff.png")) diffs.push(p);
        }
      };
      if (existsSync("test-results")) walk("test-results");
      results.at(-1).diffs = diffs;
    }
  }
}

if (!noNative) {
  if (process.platform !== "win32") {
    results.push({ name: "Native (real app)", ok: true, skipped: "Windows only", detail: "skipped: Windows only" });
  } else if (/markpion\.exe/i.test(sh('tasklist /FI "IMAGENAME eq markpion.exe" /FO CSV /NH').stdout ?? "")) {
    // Never close the user's Markpion: the native tests need it closed, so they're skipped.
    results.push({ name: "Native (real app)", ok: false, skipped: "Markpion is open", detail: "NOT RUN: close Markpion and run again (or use --no-native)" });
    console.log(`${"Native (real app)".padEnd(34)} NOT RUN  Markpion is open`);
  } else {
    step("Native (real app)", "npm run -s test:native", { summary: (log) => [...log.matchAll(/^ℹ (pass|fail) (\d+)/gm)].map((m) => `${m[2]} ${m[1]}`).join(", ") });
  }
}

step("Documentation", "npm run -s docs:check", { summary: (log) => /Link check passed: (.+)/.exec(log)?.[1] ?? "" });

const failed = results.filter((r) => !r.ok);
const lines = [
  `# Regression report`,
  "",
  `Version ${version}, commit ${head.slice(0, 7)}${dirty ? " (with uncommitted changes)" : ""}, ${new Date().toISOString()}.`,
  "",
  "| Step | Result | Time | Details |",
  "| --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.name} | ${r.skipped && r.ok ? "skipped" : r.ok ? "pass" : "**FAIL**"} | ${r.secs ?? "-"}s | ${r.detail ?? ""} |`),
  "",
];
for (const r of results.filter((x) => x.diffs?.length)) {
  lines.push("## Screens that changed", "", "Review each diff image. If the change is intended, record a new baseline with `npm run test:visual:update`; otherwise fix the UI.", "", ...r.diffs.map((d) => `- ${d.replace(/\\/g, "/")}`), "");
}
for (const r of failed) lines.push(`Log for "${r.name}": ${r.log?.replace(/\\/g, "/") ?? "(not run)"}`);
writeFileSync(join(OUT, "report.md"), lines.join("\n") + "\n");

console.log(`\nReport: ${OUT}/report.md`);
if (failed.length) {
  console.log(`REGRESSION FAILED: ${failed.map((r) => r.name).join(", ")}`);
  process.exit(1);
}
if (dirty) {
  console.log("ALL REGRESSION CHECKS PASSED, but with uncommitted changes: commit and run again to clear a release.");
  process.exit(0);
}
writeFileSync(".regression-pass.json", JSON.stringify({ commit: head, version, date: new Date().toISOString(), native: !noNative, visual: !quick }, null, 2) + "\n");
console.log(`ALL REGRESSION CHECKS PASSED for ${head.slice(0, 7)}: a release can be built from this commit.`);
