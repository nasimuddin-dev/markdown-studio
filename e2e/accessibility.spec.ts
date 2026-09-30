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

/** WCAG 2.1 A/AA checks (SRS §15). CodeMirror's editable text is excluded (its internals are managed by the library); its gutters are checked. */
async function audit(page: Page, label: string, disableRules: string[] = []) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".cm-content")
    .disableRules(disableRules)
    .analyze();
  // The editor's scroller is reachable through its text (excluded above), which axe can't see.
  const violations = results.violations
    .map((v) => (v.id === "scrollable-region-focusable" ? { ...v, nodes: v.nodes.filter((n) => n.target.join(" ") !== ".cm-scroller") } : v))
    .filter((v) => v.nodes.length);
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(" ")} — ${v.help}`);
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

    test("Git change bars and pop-up", async ({ page }) => {
      await start(page, theme);
      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
      await page.locator(".cm-line").first().click();
      await page.keyboard.press("End");
      await page.keyboard.type(" (edited)");
      await expect(page.locator(".cm-git-modified")).toHaveCount(1);
      await page.locator(".cm-git-modified").click();
      await expect(page.getByRole("dialog", { name: "Change since the last commit" })).toBeVisible();
      await audit(page, "git change pop-up");
    });

    test("slide show", async ({ page }) => {
      await start(page, theme);
      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
      await page.keyboard.press(`${mod}+Shift+P`);
      await page.keyboard.type("present as slides");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "Slide show" })).toBeVisible();
      await audit(page, "slide show");
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

    test("menus, panels and dialogs", async ({ page }) => {
      const palette = async (command: string) => {
        await page.keyboard.press(`${mod}+Shift+P`);
        await page.keyboard.type(command);
        await page.keyboard.press("Enter");
      };
      await start(page, theme);
      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
      await expect(page.locator(".markdown-body h1")).toBeVisible();

      await page.getByRole("button", { name: "File", exact: true }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      await audit(page, "file menu");
      await page.keyboard.press("Escape");
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click({ button: "right" });
      await expect(page.getByRole("menu")).toBeVisible();
      await audit(page, "explorer context menu");
      await page.keyboard.press("Escape");
      await page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: "Insert Table" }).click();
      await expect(page.getByRole("dialog", { name: "Insert table" })).toBeVisible();
      await audit(page, "table picker");
      await page.keyboard.press("Escape");
      await palette("go to file");
      await page.keyboard.type("guide");
      await audit(page, "go to file");
      await page.keyboard.press("Escape");

      // Editing: find and replace, lint problems, an unsaved document.
      await page.locator(".cm-line").first().click();
      await page.keyboard.press(`${mod}+End`);
      await page.keyboard.type("\n\n# Welcome to Markpion\n");
      await page.keyboard.press(`${mod}+H`);
      await expect(page.locator(".cm-search")).toBeVisible();
      await audit(page, "find and replace");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Show problems/ }).click();
      await expect(page.locator(".cm-panel-lint")).toBeVisible();
      await audit(page, "problems");

      await palette("check links in folder");
      await expect(page.getByRole("tab", { name: "Links", selected: true })).toBeVisible();
      await audit(page, "link check");

      await palette("close tab");
      await expect(page.getByRole("alertdialog").or(page.getByRole("dialog"))).toBeVisible();
      await audit(page, "unsaved changes");
      await page.keyboard.press("Escape");

      await palette("toggle read-only");
      await expect(page.getByRole("button", { name: "Allow Editing" })).toBeVisible();
      await audit(page, "read-only banner");
      await page.getByRole("button", { name: "Allow Editing" }).click();

      await palette("new from template");
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, "templates");
      await page.keyboard.press("Escape");

      await palette("about markpion");
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, "about");
      await page.keyboard.press("Escape");

      await page.keyboard.press(`${mod}+S`);
      await palette("file history");
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, "file history");
      await page.keyboard.press("Escape");

      await palette("compare with file");
      await page.keyboard.type("guide");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: /^Compare — / })).toBeVisible();
      await audit(page, "compare");
    });

    test("search view with results", async ({ page }) => {
      await start(page, theme);
      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.keyboard.press(`${mod}+Shift+F`);
      await page.getByRole("textbox", { name: "Search in files" }).fill("markdown");
      await expect(page.locator(".search-match").first()).toBeVisible();
      await page.getByRole("button", { name: "File filters" }).click();
      await expect(page.getByLabel("Files to include")).toBeVisible();
      await audit(page, "search");
    });
  });
}

test("Windows High Contrast (forced colors): selection, active tab and focus stay visible", async ({ page }) => {
  await start(page, "light");
  await page.emulateMedia({ forcedColors: "active" });
  await page.getByRole("button", { name: "Open Folder" }).first().click();
  await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
  const outline = (selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
  // Shown only by a background colour normally; the system replaces that colour, so they need an outline.
  expect(await outline(".tree-row.selected")).toEqual({ style: "solid", width: 2 });
  expect(await outline(".tab.active")).toEqual({ style: "solid", width: 2 });
  await page.keyboard.press("Tab");
  // Keyboard focus lands in the editor, whose frame shows it.
  expect(await outline(".cm-editor.cm-focused")).toEqual({ style: "solid", width: 2 });
  // In forced colors the operating system chooses every colour, so axe's contrast
  // rule (which reads the page's own colours) doesn't apply; the other rules do.
  await audit(page, "forced colors", ["color-contrast"]);
});
