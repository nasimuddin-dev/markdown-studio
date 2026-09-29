/**
 * Browser checks of the built website (npm run docs:test): pages render on
 * desktop and mobile, in light and dark themes, and pass an automated
 * WCAG 2.1 AA audit. Serve the build first: npm --prefix website run preview.
 */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SITE = process.env.SITE_URL ?? "http://localhost:4173/markpion/";
const PAGES = ["", "download", "features", "getting-started/first-document", "guide/editor", "markdown/tables", "reference/keyboard-shortcuts", "troubleshooting/opening-and-saving", "faq", "changelog", "blog/what-is-markdown"];
const SHOTS = process.env.SHOTS_DIR;

for (const theme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`${theme}: /${path} passes WCAG 2.1 AA`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(SITE + path);
      await expect(page.locator("h1").first()).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
    });
  }
}

test("mobile layout: navigation menu, no horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["", "download", "reference/keyboard-shortcuts", "guide/settings"]) {
    await page.goto(SITE + path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `/${path} scrolls horizontally`).toBeLessThanOrEqual(0);
  }
  await page.goto(SITE + "guide/editor");
  await page.getByRole("button", { name: "mobile navigation" }).click();
  await expect(page.locator(".VPNavScreen").getByRole("link", { name: "Download" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/mobile-menu.png` });
});

test("screens for review", async ({ page }) => {
  test.skip(!SHOTS, "set SHOTS_DIR to save screenshots");
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(SITE);
  await page.screenshot({ path: `${SHOTS}/home.png`, fullPage: true });
  await page.goto(SITE + "download");
  await page.screenshot({ path: `${SHOTS}/download.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(SITE + "reference/keyboard-shortcuts");
  await page.screenshot({ path: `${SHOTS}/shortcuts-dark.png` });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(SITE);
  await page.screenshot({ path: `${SHOTS}/home-mobile.png`, fullPage: true });
});
