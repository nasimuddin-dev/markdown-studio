import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { chooseMenu } from "./menu";

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
  await expect(page.getByRole("heading", { name: "Markpion" })).toBeVisible();
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

  await page.keyboard.press(`${mod}+S`); // demo "Save As" accepts the suggested /demo/E2E Title.md
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(page.getByRole("treeitem", { name: /E2E Title\.md/ })).toBeVisible();

  await page.keyboard.press(`${mod}+W`);
  await expect(docTabs(page)).toHaveCount(0);
  await openFile(page, "E2E Title.md");
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

  // Files to include / exclude narrow the search.
  await page.keyboard.press(`${mod}+Shift+F`);
  await box.fill("markdown");
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results).toContainText("README.md");
  await page.getByRole("button", { name: "File filters" }).click();
  await page.getByLabel("Files to include").fill("docs");
  await expect(results).not.toContainText("README.md");
  await expect(results).toContainText("diagrams-and-math.md");
  await page.getByLabel("Files to include").fill("");
  await page.getByLabel("Files to exclude").fill("docs, notes");
  await expect(results).toContainText("README.md");
  await expect(results).not.toContainText("diagrams-and-math.md");
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
  await expect(preview.locator("h2", { hasText: "Welcome to Markpion" })).toBeVisible();
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

test("display formulas and diagrams are drawn in the exported PDF", async ({ page }) => {
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
  // The Mermaid diagram is a picture (stored with its alpha mask, a second image
  // object); the $$…$$ integral is a vector drawing, so its LaTeX isn't in the text.
  expect(pdf.match(/\/Subtype\s*\/Image/g)?.length).toBe(2);
  expect(pdf.match(/\/SMask\s+\d+\s+0\s+R/g)?.length).toBe(1);
  expect(pdf).not.toContain("\\int");
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
  await expect(page.locator(".markdown-body h1")).toHaveText("Welcome to Markpion");
});

test("Fix Table repairs a table typed with mistakes", async ({ page }) => {
  // Wide enough for every toolbar control in split view (narrower windows move some into More).
  await page.setViewportSize({ width: 1800, height: 900 });
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("Name | Qty | Price\n| Apples | 3\nPears | 12 | 0.5 | extra");
  // The divider is missing, so this isn't a table yet; the toolbar still offers Table tools.
  await expect(page.locator(".markdown-body table")).toHaveCount(0);
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await toolbar.getByRole("button", { name: "Table tools" }).click();
  await page.getByRole("menuitem", { name: "Fix Table" }).click();
  await expect(page.locator(".markdown-body table")).toHaveCount(1);
  await expect(page.locator(".markdown-body table th")).toHaveText(["Name", "Qty", "Price", "Column 4"]);
  await expect(page.locator(".markdown-body table tbody tr")).toHaveCount(2);

  // Comma-separated text: select it and use Format → Fix Table.
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText("\n\nCity,Country\nParis,France");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Shift+Home");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("menuitem", { name: "Fix Table" }).click();
  await expect(page.locator(".markdown-body table")).toHaveCount(2);
});

test("a lint check can be turned off from the Problems panel and back on in Settings", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# A\n\n#### Deep\n");
  const problems = page.getByRole("button", { name: /Show problems/ });
  await expect(problems).toHaveAccessibleName(/0 warnings, 1 suggestions/);
  await problems.click();
  // Keyboard: with the Problems list focused, the underlined access key runs the action.
  await expect(page.locator(".cm-panel-lint ul")).toBeFocused();
  await page.keyboard.press("d");
  await expect(page.getByText(/“Skipped heading levels” won't be shown/)).toBeVisible();
  await expect(problems).toHaveAccessibleName(/0 warnings, 0 suggestions/);

  await page.keyboard.press(`${mod}+,`);
  await page.getByRole("button", { name: "Show again: Skipped heading levels" }).click();
  await page.keyboard.press("Escape");
  await expect(problems).toHaveAccessibleName(/0 warnings, 1 suggestions/);
});

test("F8 and Shift+F8 move between problems", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Doc\n\nfine line\n\n#Oops\n\nfine\n\n![](pic.png)\n");
  await page.keyboard.press(`${mod}+Home`);
  await expect(page.getByRole("button", { name: /Show problems/ })).toBeVisible();
  // The count can show a moment before the editor has the problems; wait for their underlines.
  await expect(page.locator(".cm-lintRange").first()).toBeVisible();
  const position = page.locator(".status-right").getByTitle(/^Go to Line/);
  await page.keyboard.press("F8");
  await expect(position).toContainText("Ln 5,");
  await page.keyboard.press("F8");
  await expect(position).toContainText("Ln 9,");
  await page.keyboard.press("Shift+F8");
  await expect(position).toContainText("Ln 5,");
});

test("long menus fit a short window and scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 560 });
  await start(page);
  await page.getByRole("button", { name: "File", exact: true }).click();
  const menu = page.getByRole("menu");
  const box = (await menu.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(560);
  // The last item is reachable (scrolled into view) and works.
  await page.getByRole("menuitem", { name: "Settings…" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});

test("speaker notes are hidden from slides and shown with N", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Results\n\nRevenue is up.\n\nNote: Thank the sales team.\n\n---\n\n# Next steps\n");
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("present as slides");
  await page.keyboard.press("Enter");
  const show = page.getByRole("dialog", { name: "Slide show" });
  await expect(show.locator(".slide")).toContainText("Revenue is up.");
  await expect(show.locator(".slide")).not.toContainText("Thank the sales team");
  await page.keyboard.press("n");
  await expect(show.getByRole("complementary", { name: "Speaker notes" })).toContainText("Thank the sales team.");
  await expect(show.getByRole("button", { name: "Notes (N)" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(show.getByRole("complementary", { name: "Speaker notes" })).toContainText("No notes for this slide.");
});

test("typewriter scrolling keeps the current line in the middle", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("typewriter scrolling");
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.insertText(`Line ${i}`);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.type("last");
  const scroller = await page.locator(".cm-scroller").boundingBox();
  const line = await page.locator(".cm-activeLine").boundingBox();
  const middle = scroller!.y + scroller!.height / 2;
  expect(Math.abs(line!.y + line!.height / 2 - middle)).toBeLessThan(scroller!.height * 0.15);
});

test("Alt+Z toggles word wrap", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  const content = page.locator(".cm-content");
  await expect(content).toHaveClass(/cm-lineWrapping/);
  await page.keyboard.press("Alt+Z");
  await expect(content).not.toHaveClass(/cm-lineWrapping/);
  await page.keyboard.press("Alt+Z");
  await expect(content).toHaveClass(/cm-lineWrapping/);
});

test("compare the document with another file", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("compare with file");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Compare with file" })).toBeVisible();
  await page.keyboard.type("guide");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Compare — README.md and guide.md" });
  await expect(dialog.locator(".diff-add").first()).toBeVisible();
  await expect(dialog).toContainText("only in guide.md");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("typing * or ` with text selected wraps it", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("make this bold and that code");
  const line = page.locator(".cm-line").first();
  await page.keyboard.press("Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.type("**");
  await expect(line).toHaveText("make **this** bold and that code");
  // Backticks wrap too.
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.type("`");
  await expect(line).toHaveText("make **this** bold and that `code`");
  // Without a selection, the characters are typed normally.
  await page.keyboard.press("End");
  await page.keyboard.type(" *");
  await expect(line).toHaveText("make **this** bold and that `code` *");
});

test("toolbar table button asks for the table size", async ({ page }) => {
  // Wide enough for every toolbar control in split view (narrower windows move some into More).
  await page.setViewportSize({ width: 1800, height: 900 });
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });

  // Mouse: the grid (4 columns × 3 rows, including the header).
  await toolbar.getByRole("button", { name: "Insert Table" }).click();
  const picker = page.getByRole("dialog", { name: "Insert table" });
  await picker.locator(".table-picker-cell").nth(2 * 8 + 3).click();
  await expect(picker).toBeHidden();
  await expect(page.locator(".cm-line").first()).toHaveText("| Column 1 | Column 2 | Column 3 | Column 4 |");
  await expect(page.locator(".cm-line").filter({ hasText: /^\| Cell/ })).toHaveCount(2);

  // Keyboard: the fields.
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.press("Enter");
  await toolbar.getByRole("button", { name: "Insert Table" }).click();
  await expect(picker.getByLabel("Columns")).toBeFocused();
  await page.keyboard.type("2");
  await picker.getByLabel("Rows").fill("5");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line").filter({ hasText: /^\| Cell     \| Cell     \|$/ })).toHaveCount(4);
});

test("lint quick fixes in the Problems panel", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("| a | b |\n| - | - |\nText right after\n\nSee[^1].");
  await page.getByRole("button", { name: /Show problems/ }).click();
  const panel = page.locator(".cm-panel-lint");
  await panel.locator('[data-action="Add Blank Line"]').click();
  await expect(page.locator(".cm-line").nth(3)).toHaveText("Text right after");
  await page.getByRole("button", { name: /Show problems/ }).click();
  await panel.locator('[data-action="Add Definition"]').click();
  await expect(page.locator(".cm-line").last()).toHaveText("[^1]: ");
  await expect(page.getByRole("button", { name: /^0 warnings/ })).toBeVisible();
});

test("code blocks in the preview have a Copy button", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("Intro\n\n```js\nconst answer = 42;\nconsole.log(answer);\n```\n");
  const block = page.locator(".markdown-body .code-block");
  await block.hover();
  await block.getByRole("button", { name: "Copy code" }).click();
  await expect(page.getByText("Code copied.")).toBeVisible();
  // The system clipboard may use CRLF line endings.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, "\n")).toBe("const answer = 42;\nconsole.log(answer);");
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

test("emoji shortcode completion inserts a shortcode the preview shows as emoji", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.type("Launch :rock");
  await page.getByRole("option", { name: /🚀\s+:rocket:/ }).click();
  await expect(page.locator(".cm-content")).toContainText("Launch :rocket:");
  await expect(page.locator(".markdown-body p")).toHaveText("Launch 🚀");
});

test("Tab moves between table cells and adds a row at the end", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("|a|b|\n|-|-|\n|1|2|");
  await page.keyboard.press("Tab");
  await page.keyboard.type("new");
  const text = () => page.locator(".cm-content").innerText();
  // Typing doesn't reformat; the next Tab does.
  await expect.poll(async () => (await text()).replace(/\u00a0/g, " ")).toMatch(/\| 1 +\| 2 +\|\n\| new +\| +\|/);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("two");
  await expect.poll(async () => (await text()).replace(/\u00a0/g, " ")).toMatch(/\| 1 +\| two +\|\n\| new \| +\|/);
  // Outside a table, Tab still indents.
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("x");
  await page.keyboard.press("Home");
  await page.keyboard.press("Tab");
  await expect.poll(text).toMatch(/\n\s+x$/);
});

test("drag a file onto a folder in the explorer to move it", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const readme = page.locator(".tree-row", { hasText: /^README\.md$/ });
  const notes = page.locator(".tree-row", { hasText: /^notes$/ });
  const from = (await readme.boundingBox())!;
  const to = (await notes.boundingBox())!;
  await page.mouse.move(from.x + 30, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 20, { steps: 3 });
  await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 5 });
  await expect(notes).toHaveClass(/drop-target/);
  await page.mouse.up();
  await expect(page.getByText(/Moved “README\.md” to “notes”/)).toBeVisible();
  // The folder opens to show it; the open tab now points to the new place.
  await expect(page.getByRole("treeitem", { name: /notes/ }).getByRole("treeitem", { name: /README\.md/ })).toBeVisible();
  await expect(page.locator('.tree-row.active[data-path$="notes/README.md"]')).toBeVisible();
  // README links to docs/guide.md and assets/logo.svg, and the guide links back: all three are offered for updating.
  const dialog = page.getByRole("dialog", { name: "Update links?" });
  await expect(dialog).toContainText("3 links in 2 files");
  await dialog.getByRole("button", { name: "Update Links" }).click();
  await expect(page.getByText("Updated links in 2 files.")).toBeVisible();
  await expect(page.locator(".preview").getByRole("link", { name: "guide" })).toHaveAttribute("href", /\.\.\/docs\/guide\.md$/);
});

test("long documents render in chunks; the outline, anchors and tasks still work", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  const sections = Array.from({ length: 120 }, (_, i) => `## Section ${i}\n\nParagraph ${i}.`).join("\n\n");
  await page.keyboard.insertText(`[Jump](#section-110)\n\n${sections}\n\n- [ ] last task\n`);
  await page.keyboard.press(`${mod}+Home`);
  const preview = page.locator(".preview");
  await expect(preview.locator(".preview-chunk").first()).toBeVisible();
  // Chunks far below the visible area are placeholders until needed.
  await expect(preview.locator(".preview-chunk.pending").first()).toBeAttached();

  // The outline builds the rest of the preview before scrolling to the heading.
  await page.getByRole("region", { name: "Outline" }).getByRole("button", { name: "Section 115" }).click();
  await expect(preview.getByRole("heading", { name: "Section 115" })).toBeInViewport();
  await expect(preview.locator(".preview-chunk.pending")).toHaveCount(0);

  // Back to the top of the preview, then follow an anchor link.
  await preview.evaluate((el) => el.scrollTo({ top: 0 }));
  await expect(preview.getByRole("link", { name: "Jump" })).toBeInViewport();
  await preview.getByRole("link", { name: "Jump" }).click();
  await expect(preview.getByRole("heading", { name: "Section 110" })).toBeInViewport();

  await preview.getByRole("checkbox", { name: "Open task" }).click();
  await expect(page.locator(".cm-line").filter({ hasText: "- [x] last task" })).toHaveCount(1);
});

test("present a document as slides", async ({ page }) => {
  // Record links opened outside the app instead of loading a real page in a popup.
  await page.addInitScript(() => {
    (window as unknown as { opened: string[] }).opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { opened: string[] }).opened.push(String(url));
      return null;
    };
  });
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Welcome\n\nFirst slide\n\n---\n\n## Agenda\n\n- one\n- two\n\n---\n\nThanks, see [the site](https://example.com)\n");
  await chooseMenu(page, "View", "Slides", "Present as Slides");
  const show = page.getByRole("dialog", { name: "Slide show" });
  await expect(show.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(show).toContainText("Slide 1 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(show.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await show.locator(".slide").click();
  await expect(show).toContainText("Slide 3 of 3");
  await page.keyboard.press("Home");
  await expect(show).toContainText("Slide 1 of 3");
  await page.keyboard.press("End");
  // Links open outside the app, never inside the window.
  await show.getByRole("link", { name: "the site" }).click();
  await expect(show).toContainText("Slide 3 of 3");
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(["https://example.com"]);
  await page.keyboard.press("Escape");
  await expect(show).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Markdown editor" })).toBeFocused();
});

test("a slow first-use dialog still gives focus back to the editor when it closes", async ({ page }) => {
  // Delay the on-demand modules, as on a busy machine: the menu has closed before they mount.
  await page.route(/\/src\/components\/(SlideShow|SettingsDialog)\.tsx/, async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  const editor = page.getByRole("textbox", { name: "Markdown editor" });
  await editor.click();
  await page.keyboard.insertText("# One\n\n---\n\n# Two\n");
  await chooseMenu(page, "View", "Slides", "Present as Slides");
  const show = page.getByRole("dialog", { name: "Slide show" });
  await expect(show).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(show).toBeHidden();
  await expect(editor).toBeFocused();

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings…" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(editor).toBeFocused();
});

test("Reflow Paragraph wraps at the line length, and Unwrap Paragraph joins it again", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
  await page.keyboard.insertText(`- ${words}\n`);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Alt+Q");
  const lines = page.locator(".cm-line");
  await expect(lines.nth(1)).toHaveText(/^ {2}word\d+/);
  const texts = await lines.allTextContents();
  expect(Math.max(...texts.map((t) => t.length))).toBeLessThanOrEqual(80);
  await chooseMenu(page, "Edit", "Lines", "Unwrap Paragraph");
  await expect(lines.first()).toHaveText(`- ${words}`);
});

test("resize the outline against the explorer, and close the folder from the explorer", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const outline = page.getByRole("region", { name: "Outline" });
  const before = (await outline.boundingBox())!.height;
  const handle = page.getByRole("separator", { name: "Resize file explorer and outline" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await outline.boundingBox())!.height).toBeGreaterThan(before + 60);

  await page.getByRole("button", { name: "Close folder" }).click();
  await expect(page.getByRole("tree")).toHaveCount(0);
  // The open document stays open; only the folder left the Explorer.
  await expect(page.getByRole("tab", { name: /README\.md/ })).toBeVisible();
});

test("Git change bars: see the committed lines and revert a change", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.getByRole("treeitem", { name: /README\.md/ }).click();
  const firstLine = page.locator(".cm-line").first();
  const original = await firstLine.textContent();
  await firstLine.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" (edited)");
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.type("\nA new last line");
  await expect(page.locator(".cm-git-modified")).toHaveCount(1);
  await expect(page.locator(".cm-git-added")).toHaveCount(1);
  // The status bar sums them up.
  await expect(page.getByRole("button", { name: /^Lines since the last commit: 1 added, 1 changed/ })).toHaveText("+1 ~1");

  // Alt+F5 goes to the next change (wrapping to the first), then the pop-up reverts it.
  await page.keyboard.press("Alt+F5");
  await chooseMenu(page, "Edit", "Git Changes", "Show Change Since Last Commit");
  const peek = page.getByRole("dialog", { name: "Change since the last commit" });
  await expect(peek.locator("pre")).toHaveText(original!);
  await expect(peek.getByRole("button", { name: "Revert Change" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(peek).toBeHidden();
  await expect(firstLine).toHaveText(original!);
  await expect(page.locator(".cm-git-modified")).toHaveCount(0);

  // Clicking a bar opens the pop-up too; Escape closes it.
  await page.locator(".cm-git-added").click();
  await expect(peek).toContainText("1 line added since the last commit.");
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
});

test("custom CSS styles the document, not the app", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.getByRole("treeitem", { name: /README\.md/ }).click();
  await page.keyboard.press(`${mod}+,`);
  await page.getByLabel("Custom CSS for documents").fill("h1 { color: rgb(200, 0, 0) } button { visibility: hidden } } body { display: none }");
  await page.keyboard.press("Escape");
  await expect(page.locator(".markdown-body h1").first()).toHaveCSS("color", "rgb(200, 0, 0)");
  // The app's own buttons and layout are untouched, even by the stray brace.
  await expect(page.getByRole("button", { name: "File", exact: true })).toBeVisible();
  await expect(page.locator(".markdown-body")).toBeVisible();
});

test("formatting toolbar reflects and applies formatting", async ({ page }) => {
  // Wide enough for every toolbar control in split view (narrower windows move some into More).
  await page.setViewportSize({ width: 1800, height: 900 });
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  const editor = page.getByRole("textbox", { name: "Markdown editor" });
  await editor.click();
  await page.keyboard.insertText("Some **bold** words\nplain line");
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  const bold = toolbar.getByRole("button", { name: "Bold" });

  // The pressed state follows the cursor.
  await page.locator(".cm-line").filter({ hasText: "bold" }).click();
  await page.keyboard.press("Home");
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight");
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("End");
  await expect(bold).toHaveAttribute("aria-pressed", "false");

  // Buttons format the selection and keep the editor focused.
  await page.locator(".cm-line").filter({ hasText: "plain line" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Home");
  await toolbar.getByRole("button", { name: "Italic" }).click();
  await expect(page.locator(".cm-line").filter({ hasText: "*plain line*" })).toHaveCount(1);
  await expect(editor).toBeFocused();

  // The paragraph style list sets headings and shows the current one.
  await toolbar.getByRole("combobox", { name: "Paragraph style" }).selectOption("Heading 2");
  await expect(page.locator(".cm-line").filter({ hasText: "## *plain line*" })).toHaveCount(1);
  await expect(toolbar.getByRole("combobox", { name: "Paragraph style" })).toHaveValue("heading2");
  await toolbar.getByRole("combobox", { name: "Paragraph style" }).selectOption("Heading 5");
  await expect(page.locator(".cm-line").filter({ hasText: "##### *plain line*" })).toHaveCount(1);
  await expect(toolbar.getByRole("combobox", { name: "Paragraph style" })).toHaveValue("heading5");

  // Inside a table, the table button opens the table tools.
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText("\n\n| A | B |\n| - | - |\n| 1 | 2 |");
  await toolbar.getByRole("button", { name: "Table tools" }).click();
  await page.getByRole("menuitem", { name: "Insert Row Below" }).click();
  await expect(page.locator(".cm-line").filter({ hasText: /^\|\s*\|\s*\|$/ })).toHaveCount(1);

  // One tab stop; arrow keys move between the controls.
  await toolbar.getByRole("button", { name: "Undo" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(toolbar.getByRole("button", { name: "Redo" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(toolbar.getByRole("button", { name: /Table of Contents/ })).toBeFocused();

  await chooseMenu(page, "View", "Formatting Toolbar");
  await expect(toolbar).toBeHidden();
});

test("a long document is previewed section by section, and jumps reach the end", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  const filler = "Some more words to make this a long document, the kind that took seconds to appear. ".repeat(3);
  const sections = Array.from({ length: 400 }, (_, i) => `## Part ${i}\n\nParagraph ${i} with a [link to the end](#the-end). ${filler}\n\n- [ ] Task ${i}\n`);
  const doc = `# Long\n\n${sections.join("\n")}\n## The end\n\nLast words.\n`;
  // Over the 100 KB at which the preview parses section by section.
  expect(doc.length).toBeGreaterThan(100_000);
  // Set straight into the document: typing 120 KB through simulated key input is too slow for a test.
  await page.evaluate(async (text) => {
    const modulePath = "/src/stores/documentsStore.ts"; // the dev server's module (a variable, so TypeScript leaves it)
    const { useDocuments } = await import(/* @vite-ignore */ modulePath);
    const { activeId, setContent } = useDocuments.getState();
    setContent(activeId, text);
  }, doc);
  const preview = page.locator(".markdown-body");
  await expect(preview.locator("h1")).toHaveText("Long");
  // Later sections wait as placeholders until they come near the visible area.
  await expect(preview.locator(".preview-chunk.pending").first()).toBeAttached();
  await expect(preview.locator("#the-end")).toHaveCount(0);
  // The outline jumps to a heading in a section that wasn't rendered yet.
  await page.getByRole("region", { name: "Outline" }).getByRole("button", { name: "The end" }).click();
  await expect(preview.locator("#the-end")).toBeInViewport();
  // Task checkboxes in later sections still toggle the right line.
  await preview.locator("li", { hasText: "Task 399" }).locator("input").click();
  await expect(page.locator(".cm-line", { hasText: "Task 399" })).toHaveText("- [x] Task 399");
});

test("breadcrumbs show the cursor's headings and jump to others", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".cm-line", { hasText: "Create a document" }).click();
  const crumbs = page.getByRole("navigation", { name: "Breadcrumbs" }).getByRole("button");
  await expect(crumbs).toHaveText(["README.md", "Welcome to Markpion", "GitHub Flavored Markdown", "Task list"]);
  await crumbs.last().click();
  await page.getByRole("menu", { name: "Headings at this level" }).getByRole("menuitem", { name: "Code" }).click();
  // The editor moved to the Code heading, and the breadcrumbs followed.
  await expect(page.locator(".cm-activeLine")).toHaveText("### Code");
  await expect(crumbs.last()).toHaveText("Code");
  await expect(page.getByRole("textbox", { name: "Markdown editor" })).toBeFocused();
  // Hidden from the View menu.
  await chooseMenu(page, "View", "Breadcrumbs");
  await expect(page.getByRole("navigation", { name: "Breadcrumbs" })).toBeHidden();
});

test("the formatting toolbar stays on one row and moves what doesn't fit into More", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  const editor = page.getByRole("textbox", { name: "Markdown editor" });
  await editor.click();
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  const more = toolbar.getByRole("button", { name: "More formatting tools" });
  await expect(more).toBeVisible();
  // One row: every visible control is centred on the same line.
  const middles = await toolbar.locator("[data-toolbar-item]:visible").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    }),
  );
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(2);
  await expect(toolbar.getByRole("button", { name: "Bold" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Table of Contents/ })).toBeHidden();

  // The More menu runs the hidden commands.
  await more.click();
  await page.getByRole("menuitem", { name: /Horizontal Rule/ }).click();
  await expect(page.locator(".cm-line").filter({ hasText: "---" })).toHaveCount(1);

  // Keyboard: End reaches the More button; hidden controls are skipped.
  await toolbar.getByRole("button", { name: "Undo" }).focus();
  await page.keyboard.press("End");
  await expect(more).toBeFocused();

  // With room for everything (editor only), there's no More button.
  await page.keyboard.press(`${mod}+1`);
  await expect(more).toBeHidden();
  await expect(toolbar.getByRole("button", { name: /Table of Contents/ })).toBeVisible();
  await page.keyboard.press(`${mod}+2`);
  await expect(more).toBeVisible();
});

test("editor and preview scroll to the same source line; double-click in the preview shows the source", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  // Paragraphs of many short source lines: tall in the editor, short in the preview, so proportional scrolling would drift.
  const sections = Array.from({ length: 40 }, (_, i) => `## Section ${i}\n\n` + Array.from({ length: 15 }, (_, j) => `Section ${i} line ${j}`).join("\n"));
  await page.keyboard.insertText(sections.join("\n\n") + "\n");
  const preview = page.locator(".preview");
  await expect(preview.locator("h2")).toHaveCount(40);

  /** Scrolls `pane` so `target` is at its top. */
  const scrollToTop = (pane: string, target: string) =>
    page.evaluate(
      ([pane, target]) => {
        const el = document.querySelector<HTMLElement>(pane)!;
        const found = [...el.querySelectorAll<HTMLElement>(target.split("|")[0])].find((e) => e.textContent === target.split("|")[1])!;
        el.scrollTop += found.getBoundingClientRect().top - el.getBoundingClientRect().top;
      },
      [pane, target],
    );
  /** How far `target` is below the top of `pane`. */
  const offset = (pane: string, target: string) =>
    page.evaluate(
      ([pane, target]) => {
        const el = document.querySelector<HTMLElement>(pane)!;
        const found = [...el.querySelectorAll<HTMLElement>(target.split("|")[0])].find((e) => e.textContent === target.split("|")[1]);
        return found ? found.getBoundingClientRect().top - el.getBoundingClientRect().top : null;
      },
      [pane, target],
    );

  // Editor → preview: the heading at the top of the editor is at the top of the preview.
  await page.locator(".cm-scroller").evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
  await page.waitForTimeout(300);
  await scrollToTop(".cm-scroller", ".cm-line|## Section 20");
  await expect.poll(async () => Math.abs((await offset(".preview", "h2|Section 20")) ?? 999)).toBeLessThan(4);

  // Preview → editor.
  await page.waitForTimeout(300);
  await scrollToTop(".preview", "h2|Section 30");
  await expect.poll(async () => Math.abs((await offset(".cm-scroller", ".cm-line|## Section 30")) ?? 999)).toBeLessThan(4);

  // Double-clicking a paragraph puts the cursor on its first source line, at the same height.
  await page.waitForTimeout(300);
  const paragraph = preview.locator("p", { hasText: "Section 31 line 0" });
  await paragraph.dblclick({ position: { x: 5, y: 5 } });
  await expect(page.locator(".cm-activeLine")).toHaveText("Section 31 line 0");
  await expect(page.getByRole("textbox", { name: "Markdown editor" })).toBeFocused();
  const [inPreview, inEditor] = [await offset(".preview", "p|" + (await paragraph.textContent())), await offset(".cm-scroller", ".cm-line|Section 31 line 0")];
  expect(Math.abs(inPreview! - inEditor!)).toBeLessThan(30);
});

test("completes reference link labels the document defines", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("\n\n[Install guide]: docs/install.md\n");
  await page.keyboard.press(`${mod}+Home`);
  await page.keyboard.type("Read the [guide][");
  const list = page.locator(".cm-tooltip-autocomplete");
  await expect(list).toContainText("Install guide");
  await expect(list).toContainText("docs/install.md");
  // CodeMirror ignores Enter for a moment after the list opens.
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line").first()).toHaveText("Read the [guide][Install guide]");
  // With a ] already there, it is not doubled.
  await page.keyboard.type(" and [notes][]");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type("I");
  await expect(list).toContainText("Install guide");
  // CodeMirror ignores Enter for a moment after the list opens.
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line").first()).toHaveText("Read the [guide][Install guide] and [notes][Install guide]");
  // The reference is defined, so the lint has nothing to report about it.
  await expect(page.locator(".cm-lintRange")).toHaveCount(0);
});

test("converts links to reference style and back from the Format menu", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("See [one](a.md) and [two](https://example.com).");
  const format = (item: string) => chooseMenu(page, "Format", "Link Style", item);
  await format("Reference Links");
  await expect(page.locator(".cm-content")).toHaveText("See [one][1] and [two][2].[1]: a.md[2]: https://example.com");
  await expect(page.locator(".markdown-body a")).toHaveCount(2);
  await format("Inline Links");
  await expect(page.locator(".cm-line")).toHaveText(["See [one](a.md) and [two](https://example.com).", ""]);
  await page.keyboard.press(`${mod}+Z`);
  await expect(page.locator(".cm-line").first()).toHaveText("See [one][1] and [two][2].");
});

test("Ctrl+click and Alt+Enter follow links in the editor", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const editor = page.getByRole("textbox", { name: "Markdown editor" });
  await editor.click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText("\n\nJump [up](#welcome-to-markpion), see [notes][n] or [math](docs/diagrams-and-math.md#latex-math).\n\n[n]: notes/todo.md\n");
  const activeLine = page.locator(".cm-activeLine");
  const word = (text: string) => page.locator(".cm-line span", { hasText: new RegExp(`^${text}$`) }).first();

  // Holding the key underlines links.
  await page.keyboard.down(mod);
  await expect(page.locator(".cm-editor.cm-follow-links")).toHaveCount(1);
  await word("up").click();
  await page.keyboard.up(mod);
  await expect(activeLine).toHaveText("# Welcome to Markpion");
  await expect(page.locator(".cm-editor.cm-follow-links")).toHaveCount(0);

  // A reference goes to its definition.
  await word("notes").click({ modifiers: [mod] });
  await expect(activeLine).toHaveText("[n]: notes/todo.md");

  // From the keyboard: Alt+Enter opens another document at the heading.
  await word("math").click();
  await page.keyboard.press("Alt+Enter");
  await expect(page.getByRole("tab", { name: /diagrams-and-math\.md/ })).toHaveAttribute("aria-selected", "true");
  await expect(activeLine).toHaveText("## LaTeX math");
});

test("F2 renames the heading at the cursor and updates links to it", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Title\n\n## Set Up\n\nSee [setup](#set-up).");
  await page.locator(".cm-line", { hasText: "## Set Up" }).click();
  await page.keyboard.press("F2");
  const dialog = page.getByRole("dialog", { name: "Rename Heading" });
  await expect(dialog.getByRole("textbox")).toHaveValue("Set Up");
  await dialog.getByRole("textbox").fill("Installation");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line")).toHaveText(["# Title", "", "## Installation", "", "See [setup](#installation)."]);
  await expect(page.locator(".cm-lintRange")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Markdown editor" })).toBeFocused();
});

test("the Links tab lists the files that link to the open document", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.getByRole("tab", { name: "Links" }).click();
  const incoming = page.getByRole("list", { name: "Links to this document" });
  await expect(incoming.getByRole("button", { name: /Links to README\.md/ })).toContainText("1");
  await incoming.getByRole("button", { name: /guide\.md Back to README/ }).click();
  await expect(page.getByRole("tab", { name: /guide\.md/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".cm-activeLine")).toContainText("[Back to README](../README.md)");
  // guide.md is linked from README.md.
  await expect(incoming.getByRole("button", { name: /Links to guide\.md/ })).toBeVisible();
  await expect(incoming.getByRole("button", { name: /README\.md guide/ })).toBeVisible();
});

test("Go to Heading in Folder opens another document at the heading", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.keyboard.press(`${mod}+Shift+Alt+H`);
  const palette = page.getByRole("dialog", { name: "Go to heading in folder" });
  await palette.getByRole("combobox").fill("latex");
  await expect(palette.getByRole("option").first()).toContainText("docs/diagrams-and-math.md");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: /diagrams-and-math\.md/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".cm-activeLine")).toHaveText("## LaTeX math");
});

test("Go to Tag lists the folder's tags and opens the file at the tag", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.type("\n\nFiled under #zebra-notes");
  await page.keyboard.press(`${mod}+Home`);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("go to tag");
  await page.keyboard.press("Enter");
  const palette = page.getByRole("dialog", { name: "Go to tag" });
  await palette.getByRole("combobox").fill("zebra");
  await expect(palette.getByRole("option").first()).toContainText("#zebra-notes");
  await expect(palette.getByRole("option").first()).toContainText("README.md");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-activeLine")).toHaveText("Filed under #zebra-notes");
  // Clicking the tag in the preview opens Go to Tag with it typed in.
  await page.locator(".preview .md-tag", { hasText: "#zebra-notes" }).click();
  await expect(page.getByRole("dialog", { name: "Go to tag" }).getByRole("combobox")).toHaveValue("#zebra-notes");
  await expect(page.getByRole("dialog", { name: "Go to tag" }).getByRole("option")).toHaveCount(1);
});

test("the Tags tab lists the folder's tags and opens a file at its tag", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.type("\n\nSee #giraffe-facts");
  await page.keyboard.press(`${mod}+Home`);
  await page.getByRole("tab", { name: "Tags" }).click();
  const panel = page.getByRole("region", { name: "Tags" });
  const tag = panel.getByRole("button", { name: /#giraffe-facts/ });
  await expect(tag).toContainText("1");
  await tag.click();
  await panel.getByRole("button", { name: /README\.md/ }).click();
  await expect(page.locator(".cm-activeLine")).toHaveText("See #giraffe-facts");
  // Saving a new tag adds it to the list.
  await page.keyboard.press("End");
  await page.keyboard.type(" #okapi");
  await page.keyboard.press(`${mod}+S`);
  await expect(panel.getByRole("button", { name: /#okapi/ })).toBeVisible();
});

test("the Explorer's filter lists matching files and opens one", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  const filter = page.getByRole("searchbox", { name: "Filter files by name" });
  await filter.fill("diagrams");
  const results = page.getByRole("list", { name: "Matching files" });
  await expect(results.getByRole("button")).toHaveCount(1);
  await expect(results.getByRole("button")).toContainText("docs");
  await filter.press("Enter");
  await expect(page.getByRole("tab", { name: /diagrams-and-math\.md/ })).toHaveAttribute("aria-selected", "true");
  await filter.fill("zzz-nothing");
  await expect(page.getByText("No matching files.")).toBeVisible();
  await filter.press("Escape");
  await expect(filter).toHaveValue("");
  await expect(page.getByRole("tree")).toBeVisible();
});

test("File History marks the words that changed within a line", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  // The line wraps onto two rows, and End goes to the end of a row, not the line: clicking its
  // middle (between the rows) made the text land mid-line on some runs. Click past the end of
  // its last row instead, which always puts the cursor at the end of the line.
  const line = page.locator(".cm-line", { hasText: "Markpion is a" });
  const box = (await line.boundingBox())!;
  await line.click({ position: { x: box.width - 40, y: box.height - 4 } }); // clear of the pane divider
  await page.keyboard.type(" Really.");
  await expect(line).toHaveText(/live preview\. Really\.$/);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("file history");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /History/ });
  await expect(dialog.locator(".diff-del .diff-word")).toHaveCount(0);
  await expect(dialog.locator(".diff-add .diff-word")).toHaveText([" Really."]);
  await expect(dialog.locator(".diff-del")).toContainText("editor with live preview.");
});

test("Find in the preview when it's shown alone", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.getByRole("button", { name: "Preview only" }).click();
  await page.keyboard.press(`${mod}+F`);
  const bar = page.getByRole("search", { name: "Find in preview" });
  const field = bar.getByRole("searchbox", { name: "Find in preview" });
  await expect(field).toBeFocused();
  await field.fill("preview");
  await expect(bar.getByRole("status")).toHaveText(/^1 of \d+$/);
  await page.keyboard.press("Enter");
  await expect(bar.getByRole("status")).toHaveText(/^2 of \d+$/);
  await page.keyboard.press("Shift+Enter");
  await expect(bar.getByRole("status")).toHaveText(/^1 of \d+$/);
  expect(await page.evaluate(() => (CSS as unknown as { highlights: Map<string, unknown> }).highlights.has("preview-find-current"))).toBe(true);
  await field.fill("no such words");
  await expect(bar.getByRole("status")).toHaveText("No results");
  await page.keyboard.press("Escape");
  await expect(bar).toBeHidden();
  await expect(page.getByRole("document", { name: "Markdown preview" })).toBeFocused();
  expect(await page.evaluate(() => (CSS as unknown as { highlights: Map<string, unknown> }).highlights.size)).toBe(0);
});

test("View > Fold to Level 2 leaves the top two heading levels showing", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await chooseMenu(page, "View", "Fold", "Fold to Level 2");
  await expect(page.locator(".cm-line", { hasText: "## GitHub Flavored Markdown" })).toBeVisible();
  await expect(page.locator(".cm-line", { hasText: "### Task list" })).toHaveCount(0);
  await expect(page.locator(".cm-foldPlaceholder").first()).toBeVisible();
  await chooseMenu(page, "View", "Fold", "Unfold All");
  await expect(page.locator(".cm-line", { hasText: "### Task list" })).toHaveCount(1);
});

test("dragging a file from the Explorer into the editor inserts a link to it", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".tree-row", { hasText: /^docs$/ }).click();
  const source = page.locator(".tree-row", { hasText: /^guide\.md$/ });
  const target = page.locator(".cm-line", { hasText: /^# Welcome to Markpion$/ });
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x + to.width - 20, to.y + to.height / 2, { steps: 8 });
  await expect(page.locator("body.dragging-into-editor")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator(".cm-line").first()).toHaveText("# Welcome to Markpion[guide](docs/guide.md)");
  // The file stayed where it was.
  await expect(page.locator(".tree-row", { hasText: /^guide\.md$/ })).toBeVisible();
});

test("View > Toggle Dim Other Paragraphs dims all but the paragraph being written", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("First paragraph.\n\nSecond one,\nstill second.\n\nThird.");
  const toggle = async () => {
    await chooseMenu(page, "View", "Editor", "Dim Other Paragraphs");
  };
  await toggle();
  await page.locator(".cm-line", { hasText: "still second." }).click();
  await expect(page.locator(".cm-line.cm-dimmed")).toHaveCount(4);
  await expect(page.locator(".cm-line", { hasText: "Second one," })).not.toHaveClass(/cm-dimmed/);
  await page.locator(".cm-line", { hasText: "Third." }).click();
  await expect(page.locator(".cm-line", { hasText: "Second one," })).toHaveClass(/cm-dimmed/);
  await toggle();
  await expect(page.locator(".cm-line.cm-dimmed")).toHaveCount(0);
});

test("hovering an image link in the editor shows the picture", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod}+End`);
  const line = page.locator(".cm-line", { hasText: "![Logo](assets/logo.svg)" });
  await line.scrollIntoViewIfNeeded();
  await line.hover({ position: { x: 30, y: 8 } });
  await expect(page.locator(".cm-image-preview img")).toBeVisible();
  expect(await page.locator(".cm-image-preview img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("the status bar shows task progress and goes to the next open task", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Plan\n\n- [x] done\n- [ ] first open\n- [ ] second open\n");
  const progress = page.getByRole("button", { name: /1 of 3 tasks done/ });
  await expect(progress).toHaveText("1/3 tasks");
  await progress.click();
  await expect(page.locator(".cm-activeLine")).toHaveText("- [ ] first open");
  await progress.click();
  await expect(page.locator(".cm-activeLine")).toHaveText("- [ ] second open");
});

test("clicking the line and column in the status bar opens Go to Line", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("one\ntwo\nthree\n");
  await page.locator(".status-right").getByRole("button", { name: /^Ln 4, Col 1/ }).click();
  const field = page.locator(".cm-panel input[name=line]");
  await expect(field).toBeFocused();
  await field.fill("2");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-activeLine")).toHaveText("two");
});

test("hovering a heading in the preview offers to copy a link to it", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permission");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const heading = page.locator(".preview h2", { hasText: "GitHub Flavored Markdown" });
  await expect(heading).toHaveAccessibleName("GitHub Flavored Markdown");
  await heading.hover();
  await heading.locator(".heading-anchor").click();
  await expect(page.getByText("Link copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#github-flavored-markdown");
});

test("the diagram starters in the Format menu render in the preview", async ({ page }) => {
  test.setTimeout(60_000);
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  for (const item of ["Flowchart", "Sequence Diagram", "Gantt Chart", "Pie Chart"]) {
    await page.keyboard.press(`${mod}+End`);
    await chooseMenu(page, "Format", "Diagram", item);
  }
  await expect(page.locator(".preview .mermaid-diagram svg")).toHaveCount(4, { timeout: 20_000 });
  await expect(page.locator(".preview .mermaid-error")).toHaveCount(0);
});

test("File > Export as Markdown with Images makes a .zip with the pictures", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const download = page.waitForEvent("download");
  await chooseMenu(page, "File", "Export", "Markdown with Images (.zip)…");
  const file = await download;
  expect(file.suggestedFilename()).toBe("README.zip");
  const zip = await JSZip.loadAsync(Buffer.concat(await (await file.createReadStream()).toArray()));
  expect(Object.keys(zip.files).sort()).toEqual(["README.md", "images/", "images/logo.svg"]);
  expect(await zip.file("README.md")!.async("string")).toContain("![Logo](images/logo.svg)");
  expect(await zip.file("images/logo.svg")!.async("string")).toContain("<svg");
});

test("File > Export > EPUB makes an e-book with its pictures, math and diagrams", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText("\n\n## Diagram\n\n```mermaid\nflowchart LR\n  A[Start<br>here] --> B{Done?}\n```\n\nEuler: $e^{i\\pi} + 1 = 0$\n");
  const download = page.waitForEvent("download");
  await chooseMenu(page, "File", "Export", "EPUB (E-book)…");
  const file = await download;
  expect(file.suggestedFilename()).toBe("README.epub");
  const zip = await JSZip.loadAsync(Buffer.concat(await (await file.createReadStream()).toArray()));
  expect(Object.keys(zip.files)[0]).toBe("mimetype");
  expect(zip.file("OEBPS/images/image1.svg")).not.toBeNull();
  const opf = await zip.file("OEBPS/content.opf")!.async("string");
  expect(opf).toContain('properties="mathml svg"');
  // Every document in the book is well-formed XML (as e-readers require).
  for (const name of ["OEBPS/content.xhtml", "OEBPS/nav.xhtml", "OEBPS/content.opf", "META-INF/container.xml"]) {
    const text = await zip.file(name)!.async("string");
    const errors = await page.evaluate((s) => new DOMParser().parseFromString(s, "application/xml").getElementsByTagName("parsererror").length, text);
    expect(errors, name).toBe(0);
  }
  const content = await zip.file("OEBPS/content.xhtml")!.async("string");
  expect(content).toContain("<svg");
  expect(content).toContain("<math");
});

test("File > Export > LaTeX makes a .tex document", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Notes\n\n## Result\n\nIt costs 50% of $x^2$.\n");
  const download = page.waitForEvent("download");
  await chooseMenu(page, "File", "Export", "LaTeX (.tex)…");
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.tex$/);
  const tex = Buffer.concat(await (await file.createReadStream()).toArray()).toString("utf8");
  expect(tex).toContain("\\title{Notes}");
  expect(tex).toContain("\\section{Result}\\label{result}");
  expect(tex).toContain("It costs 50\\% of $x^2$.");
});

test("Export Folder as One E-book puts every document in the book", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  const files = await page.getByRole("treeitem").filter({ hasText: /\.md$/ }).count();
  const download = page.waitForEvent("download");
  await chooseMenu(page, "File", "Export", "Export Folder as One E-book (EPUB)…");
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.epub$/);
  const zip = await JSZip.loadAsync(Buffer.concat(await (await file.createReadStream()).toArray()));
  const nav = await zip.file("OEBPS/nav.xhtml")!.async("string");
  // The folder's title, with a chapter (a level-2 entry) for each top-level document.
  expect((nav.match(/<li>/g) ?? []).length).toBeGreaterThanOrEqual(files);
  const content = await zip.file("OEBPS/content.xhtml")!.async("string");
  expect(content).toContain("<h1");
});

test("Move Selection to New File creates the file and links to it", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".cm-line", { hasText: /^### Task list$/ }).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("move selection to new file");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Move to New File" });
  await expect(dialog.getByRole("textbox")).toHaveValue("Task list.md");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line", { hasText: "[Task list](Task%20list.md)" })).toHaveCount(1);
  await expect(page.getByRole("treeitem", { name: /Task list\.md/ })).toBeVisible();
});

test("Copy as Plain Text copies the selection without Markdown syntax", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Title\n\nSome **bold** and [a link](x.md).\n\nNot copied.");
  await page.keyboard.press(`${mod}+Home`);
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowDown");
  await chooseMenu(page, "File", "Copy As", "Plain Text");
  await expect(page.getByText("Selection copied as plain text.")).toBeVisible();
  // The Windows clipboard uses CRLF line breaks.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe("Title\n\nSome bold and a link.\n");
});

test("F2 on a footnote renames its label everywhere", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("Claim[^1] and again[^1].\n\n[^1]: Source.");
  await page.keyboard.press(`${mod}+Home`);
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("F2");
  const dialog = page.getByRole("dialog", { name: "Rename Footnote" });
  await dialog.getByRole("textbox").fill("src");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line")).toHaveText(["Claim[^src] and again[^src].", "", "[^src]: Source."]);
});

test("pictures in the Explorer: preview, insert a link, or drag into the editor", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".tree-row", { hasText: /^assets$/ }).click();
  const picture = page.locator(".tree-row", { hasText: /^logo\.svg$/ });
  await expect(picture).toBeVisible();
  // Opening it shows the picture instead of loading it as text.
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod}+Home`);
  await picture.click();
  const dialog = page.getByRole("dialog", { name: "logo.svg" });
  await expect(dialog.locator("img")).toBeVisible();
  await dialog.getByRole("button", { name: "Insert Link in Document" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".cm-line").first()).toHaveText("![logo](assets/logo.svg)# Welcome to Markpion");
  await expect(page.getByRole("tab", { name: /logo\.svg/ })).toHaveCount(0);
  // Dragging it into the editor inserts an image link where it's dropped.
  const from = (await picture.boundingBox())!;
  const to = (await page.locator(".cm-line").nth(2).boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x + 5, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".cm-line").nth(2)).toContainText("![logo](assets/logo.svg)");
});

test("Outline sections collapse and expand, with the mouse or Left/Right", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const outline = page.getByRole("region", { name: "Outline" });
  const parent = outline.getByRole("button", { name: /GitHub Flavored Markdown/ });
  await expect(parent).toHaveAttribute("aria-expanded", "true");
  await parent.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(parent).toHaveAttribute("aria-expanded", "false");
  await expect(outline.getByRole("button", { name: /Task list/ })).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(outline.getByRole("button", { name: /Task list/ })).toBeVisible();
  await parent.locator(".outline-toggle").click();
  await expect(outline.getByRole("button", { name: /Code/ })).toHaveCount(0);
  // Clicking the chevron doesn't jump to the heading.
  await expect(page.locator(".cm-activeLine")).not.toHaveText("## GitHub Flavored Markdown");
});

test("F6 and Shift+F6 move focus between the sidebar, editor and preview", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  // Which pane has focus, from document.activeElement (toBeFocused also needs the window to be
  // focused, which tests running side by side take from each other).
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return el?.closest(".cm-editor") ? "editor" : el?.closest(".preview") ? "preview" : el?.closest(".tree-row") ? `tree:${el.textContent}` : el?.tagName;
    });
  // The preview is loaded on demand; until then its placeholder can't take focus.
  await expect(page.locator(".preview[tabindex] h1")).toBeVisible();
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await expect.poll(focused).toBe("editor");
  await page.keyboard.press("F6");
  await expect.poll(focused).toBe("preview");
  await page.keyboard.press("F6");
  await expect.poll(focused).toBe("tree:README.md");
  await page.keyboard.press("F6");
  await expect.poll(focused).toBe("editor");
  await page.keyboard.press("Shift+F6");
  await expect.poll(focused).toBe("tree:README.md");
});

test("clicking a picture in the preview opens it at full size", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const picture = page.locator(".preview img.preview-local-image").first();
  await picture.scrollIntoViewIfNeeded();
  await picture.click();
  const dialog = page.getByRole("dialog", { name: "logo.svg" });
  await expect(dialog.locator("img")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Insert Link in Document" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("File > Close All Tabs asks about unsaved tabs, then closes them all", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("draft");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Close All Tabs" }).click();
  await page.getByRole("button", { name: "Don't Save" }).click();
  await expect(docTabs(page)).toHaveCount(0);
});

test("Show in Explorer expands the folders down to the file and selects it", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.locator(".tree-row", { hasText: /^docs$/ }).click();
  await page.locator(".tree-row", { hasText: /^guide\.md$/ }).click();
  // Collapse the folder again, then find the file from its tab.
  await page.locator(".tree-row", { hasText: /^docs$/ }).click();
  await expect(page.locator(".tree-row", { hasText: /^guide\.md$/ })).toHaveCount(0);
  await docTabs(page).filter({ hasText: "guide.md" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show in Explorer" }).click();
  const row = page.locator(".tree-row", { hasText: /^guide\.md$/ });
  await expect(row).toBeFocused();
  await expect(row).toHaveClass(/selected/);
});

test("the Explorer's Recent list can forget an entry", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.getByRole("button", { name: "Close folder" }).click();
  await page.keyboard.press(`${mod}+W`);
  const recent = page.getByRole("region", { name: "Recent" });
  await expect(recent.getByRole("button", { name: "demo", exact: true })).toBeVisible();
  await recent.getByRole("button", { name: "Remove demo from Recent" }).click();
  await expect(recent).toHaveCount(0);
});

test("Copy Link to Current Heading copies the section's #anchor", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Doc\n\n## Getting Started!\n\nSome text here.");
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("copy link to current heading");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Link copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#getting-started");
});

test("the Explorer's Collapse Folders button closes every folder", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await page.locator(".tree-row", { hasText: /^docs$/ }).click();
  await page.locator(".tree-row", { hasText: /^notes$/ }).click();
  await expect(page.locator(".tree-row", { hasText: /^guide\.md$/ })).toBeVisible();
  await page.getByRole("button", { name: "Collapse all folders" }).click();
  await expect(page.locator(".tree-row", { hasText: /^guide\.md$/ })).toHaveCount(0);
  await expect(page.locator(".tree-row", { hasText: /^todo\.md$/ })).toHaveCount(0);
});

test("a word count goal shows its progress in the status bar", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  const count = page.locator(".status-right").getByRole("button", { name: /words/ });
  await expect(count).toHaveText(/^\d+ words$/);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("set word count goal");
  await page.keyboard.press("Enter");
  const field = page.getByRole("dialog", { name: "Word Count Goal" }).getByRole("textbox");
  await field.fill("2,000");
  await page.keyboard.press("Enter");
  await expect(count).toHaveText(/^\d+ \/ 2\D?000 words$/);
  await page.keyboard.press(`${mod}+Shift+P`);
  await page.keyboard.type("set word count goal");
  await page.keyboard.press("Enter");
  await field.fill("0");
  await page.keyboard.press("Enter");
  await expect(count).toHaveText(/^\d+ words$/);
});

test("Select Section from the Outline selects the heading's whole section", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.getByRole("region", { name: "Outline" }).getByRole("button", { name: /Task list/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Select Section" }).click();
  await expect(page.locator(".status-right")).toContainText(/selected/);
  const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  expect(selected.startsWith("### Task list")).toBe(true);
  expect(selected).toContain("Save it with");
  expect(selected).not.toContain("### Code");
});

test("Close brackets automatically (Settings) closes ( [ { and backticks, not quotes", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+,`);
  await page.getByLabel("Close brackets and backticks automatically").check();
  await page.keyboard.press("Escape");
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.type("see [link");
  await expect(page.locator(".cm-line").first()).toHaveText("see [link]");
  await page.keyboard.press("End");
  await page.keyboard.type(" it's (x");
  await expect(page.locator(".cm-line").first()).toHaveText("see [link] it's (x)");
});

test("Format > Insert Snippet inserts a snippet at the cursor", async ({ page }) => {
  await start(page);
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await chooseMenu(page, "Format", "Insert", "Snippet…");
  const palette = page.getByRole("dialog", { name: "Insert snippet" });
  await palette.getByRole("combobox").fill("task list");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-line").first()).toHaveText("- [ ] ");
  await page.keyboard.type("First");
  await expect(page.locator(".cm-line")).toHaveText(["- [ ] First", "- [ ] ", "- [ ] ", ""]);
});

test("wiki links in the preview open the page", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.insertText("\n\nSee [[docs/guide|the guide]].\n");
  const link = page.locator(".preview a", { hasText: "the guide" });
  await expect(link).toHaveAttribute("href", "docs/guide.md");
  await link.click();
  await expect(page.getByRole("tab", { name: /guide\.md/ })).toHaveAttribute("aria-selected", "true");
});

test("hovering a link to another document shows the start of it", async ({ page }) => {
  await start(page);
  await openDemoFolder(page);
  await openFile(page, "README.md");
  await page.locator(".cm-content").click();
  await page.keyboard.press(`${mod}+End`);
  const line = page.locator(".cm-line", { hasText: "[guide](docs/guide.md)" });
  await line.scrollIntoViewIfNeeded();
  const box = (await line.locator("span", { hasText: "docs/guide.md" }).first().boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await expect(page.locator(".cm-link-preview")).toContainText("Guide");
});
