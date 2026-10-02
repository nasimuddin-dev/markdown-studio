/**
 * End-to-end tests against the real desktop app (Rust commands, scope checks,
 * file I/O, the file watcher, single-instance "Open with"), driven through
 * tauri-driver. Run them with `npm run test:native` (Windows; Linux in CI), which
 * builds the app and starts the driver. Steps that answer the native Save dialog
 * (e2e-native/save-dialog.ps1) run on Windows only.
 */
import { afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
  // A cold start of the debug build can take a while on a busy machine; the hand-over itself is quick.
  const second = spawnSync(APP, [file], { timeout: 45000 });
  assert.equal(second.status, 0, "the second launch should hand over the file and exit");
}

/** Waits until no copy of the app is running, so the next launch isn't handed to it. */
async function waitForExit() {
  for (let i = 0; i < 100; i++) {
    const running =
      process.platform === "win32"
        ? /markpion\.exe/i.test(spawnSync("tasklist", ["/FI", "IMAGENAME eq markpion.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" }).stdout ?? "")
        : spawnSync("pgrep", ["-x", "markpion"]).status === 0;
    if (!running) return;
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

  // Open on GitHub and Send by Email aren't clicked here: they'd open the real browser and mail app
  // (the IPC can't be stubbed in the real web view). Their links are covered by tests/feedback.test.tsx.
  it("Send Feedback: the buttons respond (a missing summary is explained, Copy Text, Cancel)", async () => {
    const s = await Session.start(APP);
    try {
      await s.find("h1");
      const openDialog = async () => {
        await s.click(await s.findByText('nav[aria-label="Application menu"] button', "Help"));
        await s.click(await s.findByText('[role="menuitem"]', "Send Feedback…"));
        return s.find(".feedback-modal");
      };
      const button = (name) => s.findByText(".feedback-modal button", name);
      const dialogOpen = () => s.exec("return !!document.querySelector('.feedback-modal')");

      // Without a summary, a button says what's missing.
      await openDialog();
      // An empty summary: the button says what's missing, and nothing opens (the dialog stays).
      await s.click(await button("Open on GitHub"));
      assert.match(await s.text(await s.find(".feedback-modal .field-error")), /Write a short summary first/);
      await s.click(await button("Send by Email"));
      assert.equal(await dialogOpen(), true);

      // Copy Text puts the report on the clipboard; Cancel closes.
      await s.type(await s.find("#feedback-summary"), "Copied");
      await s.click(await button("Copy Text"));
      await s.waitFor(() => s.exec("return [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('Feedback copied'))"), "the copied message");
      await s.click(await button("Cancel"));
      await s.waitFor(async () => !(await dialogOpen()), "Cancel to close the dialog");
    } finally {
      await s.quit();
    }
  });

  it("Source Control stages and commits with the real Git", async () => {
    const git = (...args) => {
      const r = spawnSync("git", ["-C", repoDir, ...args], { encoding: "utf8" });
      assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
      return r.stdout;
    };
    const repoDir = join(dir, "repo");
    mkdirSync(repoDir, { recursive: true });
    git("init", "-q", "-b", "main");
    // A local identity, so the test doesn't depend on (or change) the machine's Git settings.
    git("config", "user.name", "Markpion Test");
    git("config", "user.email", "test@example.com");
    git("config", "commit.gpgsign", "false");
    writeFileSync(join(repoDir, "notes.md"), "# Notes\n");
    git("add", "notes.md");
    git("commit", "-q", "-m", "First");
    writeFileSync(join(repoDir, "notes.md"), "# Notes\n\nChanged.\n");

    const s = await Session.start(APP);
    try {
      await s.find("h1");
      // Handed over like "Open with" (tauri-driver doesn't pass launch arguments on).
      openWithApp(repoDir);
      await s.waitFor(() => s.exec("return !!document.querySelector('.tree-row')"), "the folder to open").catch(async (e) => {
        throw new Error(`${e.message}. The window shows: ${(await s.exec("return document.body.innerText")).replace(/\s+/g, " ").slice(0, 400)}`);
      });
      await s.click(await s.findByText('[role="tab"]', "Git"));
      await s.click(await s.find('button[aria-label="Stage notes.md"]'));
      await s.find('[aria-labelledby="scm-staged"]');
      await s.type(await s.find("#scm-message"), "Commit from the native test");
      await s.click(await s.find(".scm-commit .button.primary"));
      await s.waitFor(() => /Commit from the native test/.test(git("log", "-1", "--format=%s")), "the commit");
      assert.equal(git("status", "--porcelain"), "");
      await s.waitFor(() => s.exec("return document.querySelector('.source-control')?.textContent.includes('No changes')"), "the panel to show no changes");

      // Push to a remote (a bare repository on disk: no network, same code path), then pull a commit made elsewhere.
      const remote = join(dir, "remote.git");
      spawnSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
      git("remote", "add", "origin", remote);
      await s.click(await s.find(".source-control button[title='Refresh']"));
      const pushButton = () => s.find("button[aria-label^='Push']");
      await s.waitFor(async () => !(await s.exec("return document.querySelector(\"button[aria-label^='Push']\").disabled")), "Push to be enabled");
      await s.click(await pushButton());
      await s.waitFor(() => /Commit from the native test/.test(spawnSync("git", ["-C", remote, "log", "-1", "--format=%s"], { encoding: "utf8" }).stdout), "the push");
      assert.equal(git("rev-parse", "--abbrev-ref", "@{u}").trim(), "origin/main");

      const other = join(dir, "other");
      spawnSync("git", ["clone", "-q", remote, other]);
      const inOther = (...args) => spawnSync("git", ["-C", other, ...args], { encoding: "utf8" });
      inOther("config", "user.name", "Other");
      inOther("config", "user.email", "other@example.com");
      inOther("config", "commit.gpgsign", "false");
      writeFileSync(join(other, "from-elsewhere.md"), "# Elsewhere\n");
      inOther("add", "from-elsewhere.md");
      inOther("commit", "-q", "-m", "From another clone");
      assert.equal(inOther("push", "-q").status, 0);
      git("fetch", "-q");
      await s.click(await s.find(".source-control button[title='Refresh']"));
      await s.waitFor(async () => !(await s.exec("return document.querySelector(\"button[aria-label^='Pull']\").disabled")), "Pull to be enabled");
      await s.click(await s.find("button[aria-label^='Pull']"));
      await s.waitFor(() => existsSync(join(repoDir, "from-elsewhere.md")), "the pulled file");

      // Publish the folder as a site to gh-pages on the remote; the work tree and the branch stay as they are.
      await s.click(await s.findByText(".menu-button", "File"));
      await s.click(await s.findByText(".menu-item-label", "Publish"));
      await s.click(await s.findByText(".menu-item-label", "Folder to GitHub Pages…"));
      await s.click(await s.findByText(".modal-buttons button", "Publish"));
      const published = () => spawnSync("git", ["-C", remote, "ls-tree", "-r", "--name-only", "gh-pages"], { encoding: "utf8" }).stdout;
      await s.waitFor(() => /notes\.html/.test(published()), "the published pages");
      assert.deepEqual(published().trim().split("\n"), [".nojekyll", "from-elsewhere.html", "index.html", "notes.html"]);
      assert.equal(git("rev-parse", "--abbrev-ref", "HEAD").trim(), "main");
      assert.equal(git("status", "--porcelain"), "");
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

      // Exports arrive as a raw body with the name and kind in headers; bad requests are refused
      // before any Save dialog opens (a good one would open the dialog, which WebDriver can't drive).
      const exportWith = async (body, headers) => {
        await s.exec(
          `window.__native = undefined;
           window.__TAURI_INTERNALS__.invoke("export_binary_file", arguments[0] === null ? {} : new Uint8Array(arguments[0]), { headers: arguments[1] }).then(
             (r) => { window.__native = { ok: true, r }; },
             (e) => { window.__native = { ok: false, kind: e && e.kind, message: e && e.message }; });`,
          body,
          headers,
        );
        return s.waitFor(() => s.exec("return window.__native"), "the export answer");
      };
      const pdf = [37, 80, 68, 70, 45];
      assert.deepEqual(await exportWith(pdf, { "x-export-name": "a.pdf", "x-export-kind": "exe" }), { ok: false, kind: "invalidPath", message: "Unsupported export type" });
      assert.deepEqual(await exportWith(pdf, { "x-export-name": "bad%zz.pdf", "x-export-kind": "pdf" }), { ok: false, kind: "invalidPath", message: "Invalid export file name" });
      assert.equal((await exportWith(pdf, { "x-export-name": encodeURIComponent("..\\up.pdf"), "x-export-kind": "pdf" })).kind, "invalidPath");
      // A JSON body (the old base64 form) isn't accepted.
      assert.deepEqual(await exportWith(null, { "x-export-name": "a.pdf", "x-export-kind": "pdf" }), { ok: false, kind: "invalidPath", message: "Invalid export data" });

      // The exports below go through the native Save dialog, which only Windows can answer here
      // (save-dialog.ps1 uses Windows APIs; WebDriver can't reach native dialogs).
      if (process.platform !== "win32") return;

      // A real export: every byte value survives the trip to disk, through the native Save dialog.
      const target = join(dir, "exported résumé.zip");
      const payload = Array.from({ length: 70000 }, (_, i) => (i * 31 + 7) % 256);
      const answer = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(import.meta.dirname, "save-dialog.ps1"), "-Path", target], { stdio: "pipe" });
      const answered = new Promise((resolve) => answer.on("exit", resolve));
      const saved = await exportWith(payload, { "x-export-name": encodeURIComponent("résumé.zip"), "x-export-kind": "zip" });
      assert.equal(await answered, 0, "the Save dialog should be answered");
      assert.equal(saved.ok, true, `export failed: ${saved.message}`);
      assert.equal(saved.r.toLowerCase(), target.toLowerCase());
      assert.deepEqual([...readFileSync(target)], payload);

      // E-books and LaTeX documents have their own kinds (and Save dialog filters).
      const answerSave = (path) => {
        const p = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(import.meta.dirname, "save-dialog.ps1"), "-Path", path], { stdio: "pipe" });
        return new Promise((resolve) => p.on("exit", resolve));
      };
      const book = join(dir, "book.epub");
      const bookAnswered = answerSave(book);
      const savedBook = await exportWith([80, 75, 3, 4], { "x-export-name": "book.epub", "x-export-kind": "epub" });
      assert.equal(await bookAnswered, 0, "the Save dialog should be answered");
      assert.equal(savedBook.ok, true, `EPUB export failed: ${savedBook.message}`);
      assert.deepEqual([...readFileSync(book)], [80, 75, 3, 4]);

      const paper = join(dir, "paper.tex");
      const paperAnswered = answerSave(paper);
      await s.exec(
        `window.__native = undefined;
         window.__TAURI_INTERNALS__.invoke("export_file", { suggestedName: "paper.tex", content: arguments[0], kind: "tex" }).then(
           (r) => { window.__native = { ok: true, r }; },
           (e) => { window.__native = { ok: false, kind: e && e.kind, message: e && e.message }; });`,
        "\\documentclass{article}\n\\begin{document}\nÉté\n\\end{document}\n",
      );
      const savedPaper = await s.waitFor(() => s.exec("return window.__native"), "the LaTeX export answer");
      assert.equal(await paperAnswered, 0, "the Save dialog should be answered");
      assert.equal(savedPaper.ok, true, `LaTeX export failed: ${savedPaper.message}`);
      assert.equal(readFileSync(paper, "utf8"), "\\documentclass{article}\n\\begin{document}\nÉté\n\\end{document}\n");
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
