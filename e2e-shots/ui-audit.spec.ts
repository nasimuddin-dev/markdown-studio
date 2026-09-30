/**
 * UI audit screenshots (not part of the e2e suite): npx playwright test -c e2e-shots/playwright.config.ts
 * Saves PNGs to e2e-shots/out/ (git-ignored).
 */
import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

const OUT = join(process.cwd(), "e2e-shots", "out", process.env.SHOT_TAG ?? "now");

async function start(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("shots-started")) {
      localStorage.clear();
      sessionStorage.setItem("shots-started", "1");
    }
    window.prompt = (_m?: string, d?: string) => d ?? null;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Markpion" })).toBeVisible();
}

const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT, `${name}.png`) });

for (const theme of ["light", "dark"] as const) {
  test(`ui ${theme}`, async ({ page }) => {
    test.setTimeout(60_000);
    await start(page, theme);
    await shot(page, `${theme}-1-welcome`);
    await page.getByRole("button", { name: "Open Folder" }).first().click();
    await expect(page.getByRole("treeitem", { name: /README\.md/ })).toBeVisible();
    await page.locator(".tree-row", { hasText: /README\.md/ }).first().click();
    await page.waitForTimeout(800);
    await shot(page, `${theme}-2-editor`);
    await page.keyboard.press("Control+Shift+P");
    await page.waitForTimeout(300);
    await shot(page, `${theme}-3-palette`);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+,");
    await page.waitForTimeout(400);
    await shot(page, `${theme}-4-settings`);
    await page.keyboard.press("Escape");
    await page.getByRole("navigation", { name: "Application menu" }).getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Export", exact: true }).hover();
    await page.waitForTimeout(400);
    await shot(page, `${theme}-5-menu`);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.getByRole("navigation", { name: "Application menu" }).getByRole("button", { name: "View", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editor", exact: true }).hover();
    await page.waitForTimeout(400);
    await shot(page, `${theme}-5b-view-menu`);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 820, height: 640 });
    await page.waitForTimeout(400);
    await shot(page, `${theme}-6-narrow`);
  });
}
