import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function start(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("a11y-started")) {
      localStorage.clear();
      sessionStorage.setItem("a11y-started", "1");
    }
    window.prompt = (_m?: string, d?: string) => d ?? null;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Markpion" })).toBeVisible();
}

/** WCAG 2.1 A/AA checks (SRS §15). CodeMirror's editable surface is excluded: its internals are managed by the library. */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".cm-scroller")
    .analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(" ")} — ${v.help}`);
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

// Each test runs one or more full-page axe audits; allow for a cold dev server under parallel load.
test.slow();

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test("welcome screen", async ({ page }) => {
      await start(page, theme);
      await audit(page, "welcome");
    });

    test("editor with explorer, outline and preview", async ({ page }) => {
      await start(page, theme);
      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
      await expect(page.locator(".markdown-body h1")).toBeVisible();
      await audit(page, "editor");
    });

    test("settings dialog and command palette", async ({ page }) => {
      await start(page, theme);
      await page.keyboard.press(`${mod}+,`);
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
      await audit(page, "settings");
      await page.keyboard.press("Escape");
      await page.keyboard.press(`${mod}+Shift+P`);
      await expect(page.getByRole("combobox")).toBeFocused();
      await audit(page, "palette");
      await page.keyboard.type("keyboard shortcuts");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "Keyboard Shortcuts" })).toBeVisible();
      await audit(page, "shortcuts");
    });

    test("search view with results", async ({ page }) => {
      await start(page, theme);
      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.keyboard.press(`${mod}+Shift+F`);
      await page.getByRole("textbox", { name: "Search in files" }).fill("markdown");
      await expect(page.locator(".search-match").first()).toBeVisible();
      await audit(page, "search");
    });
  });
}
