import { expect, test, type Page } from "@playwright/test";

const mod = process.platform === "darwin" ? "Meta" : "Control";
/** Document tabs (the sidebar also has Explorer/Search tabs). */
const docTabs = (page: Page) => page.getByRole("tablist", { name: "Open documents" }).getByRole("tab");

/** Fresh demo workspace: clear stored state and answer demo "dialogs" with their defaults. */
async function start(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("e2e-started")) {
      localStorage.clear();
      sessionStorage.setItem("e2e-started", "1");
    }
    window.prompt = (_message?: string, defaultValue?: string) => defaultValue ?? null;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Markdown Studio" })).toBeVisible();
}

async function openDemoFolder(page: Page) {
  await page.getByRole("button", { name: "Open Folder" }).first().click();
  await expect(page.getByRole("treeitem", { name: /README\.md/ })).toBeVisible();
}

async function openFile(page: Page, name: string) {
  await page.locator(".tree-row", { hasText: new RegExp(`^${name.replace(".", "\\.")}$`) }).click();
  await expect(page.getByRole("tab", { name: new RegExp(name.replace(".", "\\.")) })).toHaveAttribute("aria-selected", "true");
}

test("create, edit, preview, save, close and reopen a document (§17.2)", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.keyboard.press(`${mod}+N`);
  const editor = page.getByRole("textbox", { name: "Markdown editor" });
  await editor.click();
  // insertText avoids the editor's list auto-continuation on Enter.
  await page.keyboard.insertText("# E2E Title\n\n- [x] task\n\n| a | b |\n| - | - |\n| 1 | 2 |\n");

  const preview = page.locator(".markdown-body");
  await expect(preview.locator("h1")).toHaveText("E2E Title");
  await expect(preview.locator("table td")).toHaveCount(2);
  await expect(preview.locator("input[type=checkbox]")).toBeChecked();
  await expect(page.getByRole("tab", { name: /Untitled-1\.md/ })).toContainText("(unsaved)");

  await page.keyboard.press(`${mod}+S`); // demo "Save As" accepts /demo/Untitled-1.md
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(page.getByRole("treeitem", { name: /Untitled-1\.md/ })).toBeVisible();

  await page.keyboard.press(`${mod}+W`);
  await expect(docTabs(page)).toHaveCount(0);
  await openFile(page, "Untitled-1.md");
  await expect(page.locator(".markdown-body h1")).toHaveText("E2E Title");
});

test("unsaved changes are protected when closing a tab (Appendix A.3)", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.type("draft ");
  await page.keyboard.press(`${mod}+W`);

  const dialog = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("tab", { name: /README\.md/ })).toBeVisible();

  await page.keyboard.press(`${mod}+W`);
  await page.getByRole("dialog").getByRole("button", { name: "Don't Save" }).click();
  await expect(docTabs(page)).toHaveCount(0);
});

test("unsafe HTML never executes in the preview (SEC-004)", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    if (d.type() === "alert") dialogs.push(d.message());
    void d.dismiss().catch(() => {});
  });
  await start(page);
  await openDemoFolder(page);
  await page.locator(".tree-row", { hasText: /^docs$/ }).click();
  await openFile(page, "security-test.md");
  const preview = page.locator(".markdown-body");
  await expect(preview.locator("h1")).toHaveText("Unsafe content test");
  await expect(preview.locator("script, iframe")).toHaveCount(0);
  await expect(preview.locator("[onerror]")).toHaveCount(0);
  await preview.getByText("javascript link").click();
  await page.waitForTimeout(300);
  expect(dialogs).toEqual([]);
});

test("find in files opens the matching document at the match", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.keyboard.press(`${mod}+Shift+F`);
  const box = page.getByRole("textbox", { name: "Search in files" });
  await expect(box).toBeFocused();
  await box.fill("shortcuts");
  await expect(page.locator(".search-summary")).toContainText("result");
  await page.locator(".search-match").first().click();
  await expect(page.getByRole("tab", { name: /guide\.md/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".status-right")).toContainText("selected");
});

test("command palette runs commands", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("preview only");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-editor")).toHaveCount(0);
  await expect(page.locator(".markdown-body h1")).toBeVisible();
});

test("formatting shortcuts and table formatting", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.type("word");
  await page.keyboard.press("Shift+Home");
  await page.keyboard.press(`${mod}+B`);
  await expect(page.locator(".markdown-body strong")).toHaveText("word");

  await page.keyboard.press("End");
  await page.keyboard.insertText("\n\n|a|bb|\n|-|-|\n|ccc|d|");
  // Lowercase key, as a physical keyboard reports it (Ctrl+Alt doubles as AltGr on Windows).
  await page.keyboard.press(`${mod}+Alt+t`);
  await expect(page.locator(".cm-line").filter({ hasText: "| ccc | d   |" })).toHaveCount(1);

  await page.keyboard.insertText("\n\n### Section");
  await page.keyboard.press(`${mod}+Alt+=`);
  await expect(page.locator(".markdown-body h2")).toHaveText("Section");
  await page.keyboard.press(`${mod}+Alt+-`);
  await page.keyboard.press(`${mod}+Alt+-`);
  await expect(page.locator(".markdown-body h4")).toHaveText("Section");

  // Task checkboxes in the preview toggle the task in the source.
  await page.keyboard.insertText("\n\n- [ ] first\n- [ ] second");
  await page.getByRole("checkbox", { name: "Open task" }).nth(1).click();
  await expect(page.locator(".cm-line").filter({ hasText: "- [x] second" })).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "Completed task" })).toBeChecked();
  await expect(page.locator(".cm-line").filter({ hasText: "- [ ] first" })).toHaveCount(1);

  // Ctrl/Cmd+Enter checks the task on the cursor line.
  await page.locator(".cm-line").filter({ hasText: "- [ ] first" }).click();
  await page.keyboard.press(`${mod}+Enter`);
  await expect(page.getByRole("checkbox", { name: "Completed task" })).toHaveCount(2);

  // Insert Footnote adds the reference and a definition to type into.
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.press(`${mod}+Alt+r`);
  await page.keyboard.type("The source.");
  await expect(page.locator(".markdown-body sup a")).toHaveText("1");
  await expect(page.locator(".markdown-body section li").filter({ hasText: "The source." })).toHaveCount(1);
});

test("combine the folder into one document", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("combine folder");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Combine" }).click();
  await expect(page.getByRole("tab", { name: /demo \(combined\)\.md/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("treeitem", { name: /demo \(combined\)\.md/ })).toBeVisible();
  const preview = page.locator(".markdown-body");
  await expect(preview.locator("h1")).toHaveText("demo");
  await expect(preview.locator("h2", { hasText: "Welcome to Markdown Studio" })).toBeVisible();
  await expect(preview.locator("h2", { hasText: "Guide" })).toBeVisible();
});

test("export the folder as one Word document", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("export folder as one word");
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const file = await download;
  expect(file.suggestedFilename()).toBe("demo.docx");
  const bytes = await (await file.createReadStream()).toArray();
  expect(Buffer.concat(bytes).subarray(0, 2).toString()).toBe("PK"); // a .docx is a zip file
  await expect(page.getByRole("treeitem", { name: /combined/ })).toHaveCount(0);
});

test("reopen a closed tab", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.keyboard.press(`${mod}+W`);
  await expect(docTabs(page)).toHaveCount(0);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("reopen closed tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: /README\.md/ })).toHaveAttribute("aria-selected", "true");
});

test("move a section up", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("## Alpha\n\none\n\n## Beta\n\ntwo");
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("move section up");
  await page.keyboard.press("Enter");
  await expect(page.locator(".markdown-body h2").first()).toHaveText("Beta");
  await expect(page.locator(".markdown-body h2").last()).toHaveText("Alpha");
});

test("Mermaid diagrams are exported to Word as pictures", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.locator(".tree-row", { hasText: /^docs$/ }).click();
  await openFile(page, "diagrams-and-math.md");
  await expect(page.locator(".markdown-body svg").first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("export as word");
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const file = await download;
  const bytes = Buffer.concat(await (await file.createReadStream()).toArray());
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const media = Object.keys(zip.files).filter((f) => /^word\/media\/.+\.png$/.test(f));
  expect(media.length).toBe(1);
  const png = await zip.file(media[0])!.async("uint8array");
  expect(png.length).toBeGreaterThan(2000); // a real drawing, not an empty canvas
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml).not.toContain("flowchart LR");
  // The inline and display formulas are native Word equations.
  expect(xml.match(/<m:oMath>/g)?.length).toBe(2);
});

test("outline context menu moves a section", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("## Alpha\n\none\n\n## Beta\n\ntwo\n");
  const outline = page.getByRole("region", { name: "Outline" });
  await outline.getByRole("button", { name: "Alpha" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: /Move Section Down/ }).click();
  await expect(page.locator(".markdown-body h2").first()).toHaveText("Beta");
  await expect(outline.getByRole("button", { name: /Alpha|Beta/ }).first()).toHaveText(/Beta/);
});

test("fold and unfold all sections", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("## One\n\nfirst body\n\n## Two\n\nsecond body\n");
  await expect(page.locator(".cm-line", { hasText: "second body" })).toHaveCount(1);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("fold all");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line", { hasText: "second body" })).toHaveCount(0);
  await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(2);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("unfold all");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line", { hasText: "second body" })).toHaveCount(1);
});

test("drag a section in the outline", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("## Alpha\n\none\n\n## Beta\n\ntwo\n\n## Gamma\n\nthree\n");
  const outline = page.getByRole("region", { name: "Outline" });
  const from = await outline.getByRole("button", { name: "Gamma" }).boundingBox();
  const to = await outline.getByRole("button", { name: "Alpha" }).boundingBox();
  await page.mouse.move(from!.x + 20, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + 20, to!.y + to!.height / 2, { steps: 8 });
  await expect(outline.locator(".outline-item.drop-before")).toHaveText(/Alpha/);
  await page.mouse.up();
  await expect(page.locator(".markdown-body h2")).toHaveText(["Gamma", "Alpha", "Beta"]);
  await page.keyboard.press(`${mod}+Z`);
  await expect(page.locator(".markdown-body h2")).toHaveText(["Alpha", "Beta", "Gamma"]);
});

test("long file names fit on one row in the tab", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Spec");
  await page.evaluate(() => {
    window.prompt = () => "/demo/DOCUMENTATION_SITE_SPECIFICATION_WITH_A_VERY_LONG_NAME.md";
  });
  await page.keyboard.press(`${mod}+S`);
  const tab = page.locator(".tab.active");
  await expect(tab).toContainText("DOCUMENTATION_SITE");
  const box = async (sel: string) => (await tab.locator(sel).boundingBox())!;
  const [tabBox, icon, label, close] = [await tab.boundingBox(), await box(".tab-icon"), await box(".tab-label"), await box(".tab-close")];
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  // Icon, name and close button share one row, inside the tab.
  expect(Math.abs(mid(icon) - mid(label))).toBeLessThan(3);
  expect(Math.abs(mid(close) - mid(label))).toBeLessThan(3);
  expect(close.x + close.width).toBeLessThanOrEqual(tabBox!.x + tabBox!.width + 0.5);
  // The long name is shortened with an ellipsis, and a saved tab isn't italic.
  const label$ = tab.locator(".tab-label");
  expect(await label$.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await label$.evaluate((el) => getComputedStyle(el).fontStyle)).toBe("normal");
  // The tabs fill the bar's height; no scrollbar squeezes them.
  const bar = (await page.locator(".tabbar").boundingBox())!;
  expect(tabBox!.height).toBeGreaterThanOrEqual(bar.height - 2);
  // An unsaved tab's name is italic.
  await page.keyboard.insertText(" edited");
  expect(await label$.evaluate((el) => getComputedStyle(el).fontStyle)).toBe("italic");
});

test("display formulas and diagrams are exported to PDF as pictures", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.locator(".tree-row", { hasText: /^docs$/ }).click();
  await openFile(page, "diagrams-and-math.md");
  await expect(page.locator(".markdown-body svg").first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("export as pdf");
  const download = page.waitForEvent("download");
  await page.getByRole("option", { name: /^Export as PDF/ }).click();
  const pdf = Buffer.concat(await (await (await download).createReadStream()).toArray()).toString("latin1");
  // The Mermaid diagram and the $$…$$ integral are images; the inline formula stays LaTeX text.
  // Two pictures, each stored with its alpha mask (a second image object).
  expect(pdf.match(/\/Subtype\s*\/Image/g)?.length).toBe(4);
  expect(pdf.match(/\/SMask\s+\d+\s+0\s+R/g)?.length).toBe(2);
});

test("replace in files across the folder", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.keyboard.press(`${mod}+Shift+F`);
  await page.getByRole("textbox", { name: "Search in files" }).fill("live preview");
  await expect(page.getByRole("status").filter({ hasText: /result/ })).toContainText("1 result");
  await page.getByRole("textbox", { name: "Replace with" }).fill("instant preview");
  await page.getByRole("button", { name: "Replace All" }).click();
  await expect(page.getByRole("dialog")).toContainText("Replace 1 match in 1 file");
  await page.getByRole("dialog").getByRole("button", { name: "Replace All" }).click();
  await expect(page.getByText("Replaced 1 match in 1 file.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /result/ })).toContainText("No results");
  await page.getByRole("textbox", { name: "Search in files" }).fill("instant preview");
  await expect(page.getByRole("status").filter({ hasText: /result/ })).toContainText("1 result");
});

test("go to a file by name", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.keyboard.press(`${mod}+Alt+o`);
  const dialog = page.getByRole("dialog", { name: "Go to file" });
  await expect(dialog).toBeVisible();
  await page.keyboard.type("diagmath");
  await expect(dialog.getByRole("option").first()).toContainText("docs/diagrams-and-math.md");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: /diagrams-and-math\.md/ })).toHaveAttribute("aria-selected", "true");
});

test("duplicate a file from the explorer", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.getByRole("treeitem", { name: /README\.md/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page.getByRole("tab", { name: /README copy\.md/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("treeitem", { name: /README copy\.md/ })).toBeVisible();
  await expect(page.locator(".markdown-body h1")).toHaveText("Welcome to Markdown Studio");
});

test("copy as formatted text puts HTML and Markdown on the clipboard", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Report\n\nSome **bold** text.");
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("copy as formatted");
  await page.getByRole("option", { name: /^Copy as Formatted Text/ }).click();
  await expect(page.getByText(/Formatted text copied/)).toBeVisible();
  const clip = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return { types: item.types, html: await (await item.getType("text/html")).text(), text: await (await item.getType("text/plain")).text() };
  });
  expect(clip.types).toEqual(expect.arrayContaining(["text/html", "text/plain"]));
  expect(clip.html).toMatch(/<h1[^>]*>Report<\/h1>/);
  expect(clip.html).toContain("<strong>bold</strong>");
  // The Windows clipboard stores line breaks as CRLF.
  expect(clip.text.replace(/\r\n/g, "\n")).toBe("# Report\n\nSome **bold** text.");
});
