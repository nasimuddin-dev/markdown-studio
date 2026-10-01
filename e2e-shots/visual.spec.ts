/**
 * Pixel-exact visual regression for CSS refactoring (local tool, not CI):
 *   npx playwright test -c e2e-shots/playwright.config.ts visual --update-snapshots   (record)
 *   npx playwright test -c e2e-shots/playwright.config.ts visual                      (compare)
 * Baselines live in e2e-shots/out/ (git-ignored): they depend on the OS fonts.
 */
import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const mod = process.platform === "darwin" ? "Meta" : "Control";
const exact = { maxDiffPixels: 0, animations: "disabled", caret: "hide" } as const;

async function start(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("visual-started")) {
      localStorage.clear();
      sessionStorage.setItem("visual-started", "1");
    }
    window.prompt = (_m?: string, d?: string) => d ?? null;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Markpion" })).toBeVisible();
}

async function openReadme(page: Page) {
  await page.getByRole("button", { name: "Open Folder" }).first().click();
  await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
  await expect(page.locator(".markdown-body h1")).toBeVisible();
  await page.mouse.move(0, 0);
}

const snap = async (page: Page, name: string) => {
  await page.waitForTimeout(250);
  // Soft: one run reports every screen that changed, not just the first.
  await expect.soft(page).toHaveScreenshot(`${name}.png`, exact);
};

for (const theme of ["light", "dark"] as const) {
  test.describe(theme, () => {
    test("welcome and editor", async ({ page }) => {
      await start(page, theme);
      await snap(page, `${theme}-welcome`);
      await openReadme(page);
      await snap(page, `${theme}-editor`);
      await page.keyboard.press(`${mod}+1`);
      await snap(page, `${theme}-editor-only`);
      await page.keyboard.press(`${mod}+3`);
      await snap(page, `${theme}-preview-only`);
    });

    test("menus and palette", async ({ page }) => {
      await start(page, theme);
      await openReadme(page);
      const nav = page.getByRole("navigation", { name: "Application menu" });
      await nav.getByRole("button", { name: "File", exact: true }).click();
      await page.getByRole("menuitem", { name: "Export", exact: true }).click();
      await snap(page, `${theme}-file-export`);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await nav.getByRole("button", { name: "View", exact: true }).click();
      await snap(page, `${theme}-view-menu`);
      await page.keyboard.press("Escape");
      await page.keyboard.press(`${mod}+Shift+P`);
      await snap(page, `${theme}-palette`);
      await page.keyboard.press("Escape");
      await page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: "More formatting tools" }).click();
      await snap(page, `${theme}-toolbar-more`);
      await page.keyboard.press("Escape");
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click({ button: "right" });
      await snap(page, `${theme}-context-menu`);
      await page.keyboard.press("Escape");
    });

    test("dialogs and panels", async ({ page }) => {
      await start(page, theme);
      await openReadme(page);
      await page.keyboard.press(`${mod}+,`);
      await snap(page, `${theme}-settings`);
      await page.keyboard.press("Escape");
      await page.keyboard.press(`${mod}+Shift+F`);
      await page.keyboard.insertText("Markdown");
      await page.waitForTimeout(500);
      await snap(page, `${theme}-search`);
      await page.getByRole("tab", { name: "Tags" }).click();
      await snap(page, `${theme}-tags`);
      await page.getByRole("tab", { name: "Explorer" }).click();
      await page.locator(".cm-line").nth(2).click();
      await page.keyboard.press(`${mod}+F`);
      await page.keyboard.insertText("preview");
      await page.waitForTimeout(300);
      await snap(page, `${theme}-find`);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /words/ }).first().click();
      await snap(page, `${theme}-stats`);
      await page.keyboard.press("Escape");
    });
  });
}
