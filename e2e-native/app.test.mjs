/**
 * End-to-end tests against the real desktop app (Rust commands, scope checks,
 * file I/O, the file watcher, single-instance "Open with"), driven through
 * tauri-driver. Run them with `npm run test:native` (Windows), which builds
 * the app and starts the driver.
 */
import { afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

  it("opens files handed over while it is still starting (several files opened at once)", async () => {
    const first = join(dir, "early-one.md");
    const second = join(dir, "early-two.md");
    writeFileSync(first, "# One\n");
    writeFileSync(second, "# Two\n");
    const s = await Session.start(APP);
    try {
      // No waiting for the UI: the hand-overs race the app's start-up.
      openWithApp(first);
      openWithApp(second);
      const tabs = "return [...document.querySelectorAll('[aria-label=\"Open documents\"] [role=tab]')].map((t) => t.textContent).join('|')";
      await s.waitFor(async () => {
        const open = await s.exec(tabs);
        return /early-one\.md/.test(open) && /early-two\.md/.test(open);
      }, "both files' tabs");
    } finally {
      await s.quit();
    }
  });

  it("hands file bytes to the UI as raw bytes, and pictures only within a lone document's reach", async () => {
    const folder = join(dir, "project");
    mkdirSync(join(folder, "images"), { recursive: true });
    mkdirSync(join(folder, ".private"), { recursive: true });
    const file = join(folder, "doc.md");
    const text = "# Doc\n\nÅngström ✓ 日本語\n";
    writeFileSync(file, text);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    writeFileSync(join(folder, "images", "inside.png"), png);
    writeFileSync(join(folder, ".private", "hidden.png"), png);
    // Not beside or below any document the app has open (earlier tests' files are restored from `dir`).
    const outside = join(mkdtempSync(join(tmpdir(), "markpion-outside-")), "outside.png");
    writeFileSync(outside, png);

    const s = await Session.start(APP);
    /** Calls a Rust command through the app's own bridge and reports what came back. */
    const invoke = async (cmd, args) => {
      await s.exec(
        `window.__native = undefined;
         window.__TAURI_INTERNALS__.invoke(arguments[0], arguments[1]).then(
           (r) => { window.__native = { ok: true, type: Object.prototype.toString.call(r), bytes: r instanceof ArrayBuffer ? Array.from(new Uint8Array(r)) : null, text: typeof r === "string" ? r.slice(0, 40) : null }; },
           (e) => { window.__native = { ok: false, kind: e && e.kind }; });`,
        cmd,
        args,
      );
      return s.waitFor(() => s.exec("return window.__native"), `the answer to ${cmd}`);
    };
    try {
      await s.find("h1");
      openWithApp(file);
      await s.waitFor(async () => /doc\.md/.test(await s.exec(ACTIVE_TAB)), "the doc.md tab");

      // Import reads: the file's exact bytes, as an ArrayBuffer (not base64 text).
      const read = await invoke("read_binary_file", { path: file });
      assert.equal(read.type, "[object ArrayBuffer]");
      assert.deepEqual(Buffer.from(read.bytes), Buffer.from(text, "utf8"));

      // Preview pictures: beside the document and in its subfolders, not hidden folders, not above it.
      const inside = await invoke("read_image", { path: join(folder, "images", "inside.png") });
      assert.match(inside.text, /^data:image\/png;base64,/);
      assert.deepEqual(await invoke("read_image", { path: join(folder, ".private", "hidden.png") }), { ok: false, kind: "outOfScope" });
      assert.deepEqual(await invoke("read_image", { path: outside }), { ok: false, kind: "outOfScope" });
      // A file that was never opened can't be read at all.
      assert.deepEqual(await invoke("read_binary_file", { path: outside }), { ok: false, kind: "outOfScope" });
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
