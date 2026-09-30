/**
 * End-to-end tests against the real desktop app (Rust commands, scope checks,
 * file I/O, the file watcher, single-instance "Open with"), driven through
 * tauri-driver. Run them with `npm run test:native` (Windows), which builds
 * the app and starts the driver.
 */
import { afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Key, Session } from "./webdriver.mjs";

const APP = process.env.MARKPION_APP;
if (!APP) throw new Error("MARKPION_APP isn't set; run the tests with npm run test:native.");

const ACTIVE_TAB = "return document.querySelector('[aria-label=\"Open documents\"] [role=tab][aria-selected=true]')?.textContent ?? ''";
const EDITOR_TEXT = "return [...document.querySelectorAll('.cm-line')].map((l) => l.textContent).join('\\n')";

/**
 * Opens a file the way the OS does ("Open with", a double-click): a second
 * launch hands its arguments to the running app and exits.
 */
function openWithApp(file) {
  const second = spawnSync(APP, [file], { timeout: 15000 });
  assert.equal(second.status, 0, "the second launch should hand over the file and exit");
}

/** Waits until no copy of the app is running, so the next launch isn't handed to it. */
async function waitForExit() {
  for (let i = 0; i < 100; i++) {
    const list = spawnSync("tasklist", ["/FI", "IMAGENAME eq markpion.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" }).stdout ?? "";
    if (!/markpion\.exe/i.test(list)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("The app didn't exit.");
}

describe("the desktop app", () => {
  let dir;
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "markpion-native-"));
  });
  afterEach(waitForExit);

  it("starts and shows the welcome screen", async () => {
    const s = await Session.start(APP);
    try {
      const heading = await s.find("h1");
      assert.match(await s.text(heading), /Markpion/);
      assert.equal(await s.exec("return document.title"), "Markpion");
    } finally {
      await s.quit();
    }
  });

  it("opens a file handed over by the OS, then saves an edit to disk", async () => {
    const file = join(dir, "note.md");
    writeFileSync(file, "# Note\n\nFirst line.\n");
    const s = await Session.start(APP);
    try {
      await s.find("h1");
      openWithApp(file);
      await s.waitFor(async () => /note\.md/.test(await s.exec(ACTIVE_TAB)), "the note.md tab");
      const editor = await s.find(".cm-content");
      await s.click(editor);
      await s.chord([Key.Control], Key.End);
      await s.type(editor, "Typed in the native app.");
      await s.chord([Key.Control], "s");
      await s.waitFor(() => readFileSync(file, "utf8").includes("Typed in the native app."), "the file on disk to change");
      assert.match(readFileSync(file, "utf8"), /^# Note\n\nFirst line\.\nTyped in the native app\.\n?$/);
      await s.waitFor(async () => !/•|unsaved/i.test(await s.exec(ACTIVE_TAB)), "the tab to show it's saved");
    } finally {
      await s.quit();
    }
  });

  it("reloads an unedited file that changed on disk", async () => {
    const file = join(dir, "watched.md");
    writeFileSync(file, "Before.\n");
    const s = await Session.start(APP);
    try {
      await s.find("h1");
      openWithApp(file);
      await s.waitFor(async () => /Before\./.test(await s.exec(EDITOR_TEXT)), "the file's text");
      writeFileSync(file, "After, changed outside the app.\n");
      await s.waitFor(async () => /After, changed outside the app\./.test(await s.exec(EDITOR_TEXT)), "the editor to show the new text", 20000);
    } finally {
      await s.quit();
    }
  });
});
