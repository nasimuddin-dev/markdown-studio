import { expect, test, type Page } from "@playwright/test";
import { chooseMenu } from "./menu";
import { openAiReview, turnOnAi, withStandInAi } from "./ai";

/**
 * Layout checks at the window sizes people use, down to the app's minimum
 * (720×480, set in src-tauri/src/lib.rs): nothing makes the window scroll
 * sideways, dialogs and menus fit, nothing in the window's controls overlaps,
 * and no label is cut off without an ellipsis. Pixel comparisons
 * (e2e-shots/visual.spec.ts) cover one size; these cover all of them.
 */

const mod = process.platform === "darwin" ? "Meta" : "Control";
const SIZES = [
  { width: 720, height: 480 },
  { width: 1024, height: 640 },
  { width: 1366, height: 768 },
];

/** The window's controls, where clipped or overlapping labels are bugs (not the document). */
const CHROME = ".menubar, .toolbar, .format-toolbar, .tabbar, .breadcrumbs, .statusbar, .sidebar, .cm-panels, .modal, [role=menu], .toasts, .slideshow-bar, .table-picker";

async function layoutProblems(page: Page, where: string): Promise<string[]> {
  const problems = await page.evaluate((chrome) => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    if (doc.scrollWidth > vw + 1) out.push(`the window scrolls sideways (${doc.scrollWidth}px wide in ${vw}px)`);
    /** Shown on screen: has a size, isn't hidden, and isn't scrolled out of a scrolling ancestor. */
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width <= 1 || r.height <= 1 || s.visibility === "hidden" || s.display === "none") return false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (!/(auto|scroll|hidden|clip)/.test(ps.overflowX + ps.overflowY)) continue;
        const pr = p.getBoundingClientRect();
        if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1 || r.right <= pr.left + 1 || r.left >= pr.right - 1) return false;
      }
      return true;
    };
    /** The part of an element that's on screen: its box cut by every clipping or scrolling ancestor. */
    const shownRect = (el: Element) => {
      const r = el.getBoundingClientRect();
      let [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (!/(auto|scroll|hidden|clip)/.test(ps.overflowX + ps.overflowY)) continue;
        const pr = p.getBoundingClientRect();
        [left, top, right, bottom] = [Math.max(left, pr.left), Math.max(top, pr.top), Math.min(right, pr.right), Math.min(bottom, pr.bottom)];
      }
      return { left, top, right, bottom };
    };
    /** Text for screen readers only (clipped to 1px on purpose). */
    const screenReaderOnly = (el: Element) => el.clientWidth <= 1 || el.clientHeight <= 1;
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} "${(el.textContent ?? "").trim().slice(0, 40)}"`;

    // Dialogs and menus are entirely on screen.
    for (const el of document.querySelectorAll(".modal, [role=menu], .palette, [role=dialog], .table-picker")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.push(`off screen: ${name(el)} (${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)})`);
    }

    // The sidebar's content fits it (focusing something wider would scroll the whole sidebar sideways).
    for (const el of document.querySelectorAll(".sidebar, .sidebar-tabs")) {
      if (visible(el) && el.scrollWidth > el.clientWidth + 1) out.push(`wider than the sidebar: ${name(el)} (${el.scrollWidth}px in ${el.clientWidth}px)`);
    }

    // Panels in the sidebar never scroll sideways (their content shrinks or wraps instead).
    for (const panel of document.querySelectorAll(".sidebar *")) {
      const s = getComputedStyle(panel);
      if (!/(auto|scroll)/.test(s.overflowX) || !visible(panel)) continue;
      if (panel.scrollWidth > panel.clientWidth + 1) out.push(`scrolls sideways: ${name(panel)} (${panel.scrollWidth}px of content in ${panel.clientWidth}px)`);
    }

    // A dialog's buttons (Close, Done…) are on screen without scrolling the dialog.
    for (const buttons of document.querySelectorAll(".modal .modal-buttons")) {
      const dialog = buttons.closest(".modal")!;
      if (getComputedStyle(dialog).display === "none") continue;
      const shown = shownRect(buttons);
      const box = buttons.getBoundingClientRect();
      if (shown.bottom - shown.top < box.height - 1 || box.bottom > window.innerHeight + 1) {
        out.push(`dialog buttons need scrolling: ${name(dialog.querySelector(".modal-title") ?? dialog)}`);
      }
    }

    for (const region of document.querySelectorAll(chrome)) {
      if (!visible(region)) continue;
      // Labels cut off without an ellipsis (text wider than its box, clipped).
      for (const el of region.querySelectorAll("button, a, label, [role=tab], [role=menuitem], h1, h2, h3, legend, p, span, kbd")) {
        if (!visible(el) || screenReaderOnly(el) || !el.textContent?.trim()) continue;
        const s = getComputedStyle(el);
        const clips = ["hidden", "clip"].includes(s.overflowX) && s.textOverflow !== "ellipsis";
        if (clips && el.scrollWidth > el.clientWidth + 1) out.push(`cut off: ${name(el)} (${el.scrollWidth}px of text in ${el.clientWidth}px)`);
      }
      // Controls side by side don't overlap.
      const controls = [...region.querySelectorAll("button, select, input, [role=tab]")].filter(visible);
      for (let i = 0; i < controls.length; i++) {
        for (let j = i + 1; j < controls.length; j++) {
          const a = shownRect(controls[i]);
          const b = shownRect(controls[j]);
          if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
          // Buttons placed inside a text box's reserved padding (search options) are by design.
          const [input, other] = controls[i].tagName === "INPUT" ? [controls[i], controls[j]] : controls[j].tagName === "INPUT" ? [controls[j], controls[i]] : [null, null];
          if (input && other) {
            const ir = input.getBoundingClientRect();
            const textEnd = ir.right - parseFloat(getComputedStyle(input).paddingRight);
            if (other.getBoundingClientRect().left >= textEnd - 1) continue;
          }
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 2 && overlapY > 2) out.push(`overlap: ${name(controls[i])} and ${name(controls[j])}`);
        }
      }
    }
    return [...new Set(out)];
  }, CHROME);
  return problems.map((p) => `${where}: ${p}`);
}

async function start(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("layout-started")) {
      localStorage.clear();
      sessionStorage.setItem("layout-started", "1");
    }
    window.prompt = (_m?: string, d?: string) => d ?? null;
  });
  await page.goto("/");
  // The first load can be slow while the dev server compiles the app for a busy test run.
  await expect(page.getByRole("heading", { name: "Markpion" })).toBeVisible({ timeout: 20_000 });
}

for (const theme of ["light", "dark"] as const) {
  for (const size of SIZES) {
    test(`layout at ${size.width}×${size.height} (${theme})`, async ({ page }) => {
      test.slow();
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });
      await start(page);
      const problems: string[] = [];
      problems.push(...(await layoutProblems(page, "welcome")));

      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
      await expect(page.locator(".markdown-body h1")).toBeVisible();
      problems.push(...(await layoutProblems(page, "editor")));

      await page.keyboard.press(`${mod}+N`);
      await page.keyboard.press(`${mod}+N`);
      problems.push(...(await layoutProblems(page, "three tabs")));

      await page.getByRole("navigation", { name: "Application menu" }).getByRole("button", { name: "File", exact: true }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      problems.push(...(await layoutProblems(page, "File menu")));
      await page.keyboard.press("Escape");

      await page.keyboard.press(`${mod}+Shift+P`);
      await expect(page.getByRole("dialog", { name: "Command palette" }).getByRole("combobox")).toBeFocused();
      problems.push(...(await layoutProblems(page, "command palette")));
      await page.keyboard.press("Escape");

      await page.keyboard.press(`${mod}+,`);
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
      problems.push(...(await layoutProblems(page, "Settings")));
      await page.keyboard.press("Escape");

      await chooseMenu(page, "Help", "Report a Problem…");
      await expect(page.getByRole("dialog", { name: "Report a Problem" })).toBeVisible();
      problems.push(...(await layoutProblems(page, "Report a Problem")));
      await page.keyboard.press("Escape");

      await chooseMenu(page, "Help", "Keyboard Shortcuts");
      await expect(page.getByRole("dialog", { name: "Keyboard Shortcuts" })).toBeVisible();
      problems.push(...(await layoutProblems(page, "Keyboard Shortcuts")));

      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const size of SIZES) {
    test(`panels and dialogs at ${size.width}×${size.height} (${theme})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });
      await start(page);
      const problems: string[] = [];
      const palette = async (command: string) => {
        await page.keyboard.press(`${mod}+Shift+P`);
        await page.keyboard.type(command);
        await page.keyboard.press("Enter");
      };
      await page.getByRole("button", { name: "Open Folder" }).first().click();
      await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
      await expect(page.locator(".markdown-body h1")).toBeVisible();

      await page.keyboard.press(`${mod}+Shift+F`);
      await page.getByRole("textbox", { name: "Search in files" }).fill("markdown");
      await expect(page.locator(".search-match").first()).toBeVisible();
      problems.push(...(await layoutProblems(page, "Search")));

      await palette("check links in folder");
      await expect(page.getByRole("tab", { name: "Links", selected: true })).toBeVisible();
      problems.push(...(await layoutProblems(page, "Links")));
      await page.getByRole("tab", { name: "Tags" }).click();
      await expect(page.getByRole("region", { name: "Tags" }).getByRole("status")).not.toHaveText("Finding tags…");
      problems.push(...(await layoutProblems(page, "Tags")));
      await page.getByRole("tab", { name: "Explorer" }).click();

      await page.locator(".cm-line").first().click();
      await page.keyboard.press(`${mod}+End`);
      await page.keyboard.type("\n\n# Welcome to Markpion\n");
      await page.keyboard.press(`${mod}+H`);
      await expect(page.locator(".cm-search")).toBeVisible();
      problems.push(...(await layoutProblems(page, "find and replace")));
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Show problems/ }).click();
      await expect(page.locator(".cm-panel-lint")).toBeVisible();
      problems.push(...(await layoutProblems(page, "problems panel")));

      // Source Control, with the edit above saved: a change, then a staged one.
      await page.keyboard.press(`${mod}+S`);
      await page.getByRole("tab", { name: /Git/ }).click();
      const scm = page.getByRole("region", { name: "Source Control" });
      await expect(scm.getByRole("list", { name: "Changes", exact: true })).toBeVisible();
      problems.push(...(await layoutProblems(page, "Source Control")));
      await scm.getByRole("button", { name: "Stage README.md" }).click();
      await expect(scm.getByRole("list", { name: "Staged Changes" })).toBeVisible();
      problems.push(...(await layoutProblems(page, "Source Control, staged")));
      await page.getByRole("tab", { name: "Explorer" }).click();
      // Unsaved again, for the unsaved-changes dialog below.
      await page.locator(".cm-line").first().click();
      await page.keyboard.type("!");

      await page.locator(".tree-row", { hasText: /^assets$/ }).click();
      await page.locator(".tree-row", { hasText: /^logo\.svg$/ }).click();
      await expect(page.getByRole("dialog", { name: "logo.svg" }).locator("img")).toBeVisible();
      problems.push(...(await layoutProblems(page, "picture preview")));
      await page.keyboard.press("Escape");

      await palette("close tab");
      await expect(page.getByRole("alertdialog").or(page.getByRole("dialog"))).toBeVisible();
      problems.push(...(await layoutProblems(page, "unsaved changes")));
      await page.keyboard.press("Escape");

      await palette("new from template");
      await expect(page.getByRole("dialog")).toBeVisible();
      problems.push(...(await layoutProblems(page, "templates")));
      await page.keyboard.press("Escape");

      await palette("about markpion");
      await expect(page.getByRole("dialog", { name: "About Markpion" })).toBeVisible();
      problems.push(...(await layoutProblems(page, "About")));
      await page.keyboard.press("Escape");

      await page.keyboard.press(`${mod}+S`);
      await palette("file history");
      await expect(page.getByRole("dialog")).toBeVisible();
      problems.push(...(await layoutProblems(page, "File History")));
      await page.keyboard.press("Escape");

      await palette("compare with file");
      const picker = page.getByRole("dialog", { name: "Compare with file" });
      await expect(picker).toBeVisible();
      await page.keyboard.type("guide");
      await expect(picker.getByRole("option").first()).toContainText(/guide/i);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: /^Compare — / })).toBeVisible();
      problems.push(...(await layoutProblems(page, "Compare")));

      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const size of SIZES) {
    test(`slide show and table picker at ${size.width}×${size.height} (${theme})`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });
      await start(page);
      const problems: string[] = [];
      await page.keyboard.press(`${mod}+N`);
      await page.getByRole("textbox", { name: "Markdown editor" }).click();
      await page.keyboard.insertText("# A slide with a fairly long title for a small window\n\n- one\n- two\n\nNote: speaker notes\n\n---\n\n# Second\n");

      // The table picker opens from its toolbar button, which only wide windows show (narrower ones
      // move it into the More menu, without the picker): widen the window for it, at this height.
      await page.setViewportSize({ width: 1920, height: size.height });
      await page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: "Insert Table" }).click();
      await expect(page.getByRole("dialog", { name: "Insert table" })).toBeVisible();
      problems.push(...(await layoutProblems(page, `table picker (1920×${size.height})`)));
      await page.keyboard.press("Escape");
      await page.setViewportSize(size);

      await chooseMenu(page, "View", "Slides", "Present as Slides");
      const show = page.getByRole("dialog", { name: "Slide show" });
      await expect(show).toBeVisible();
      problems.push(...(await layoutProblems(page, "slide show")));
      await page.keyboard.press("n");
      await expect(page.getByRole("complementary", { name: "Speaker notes" })).toBeVisible();
      problems.push(...(await layoutProblems(page, "slide show with notes")));
      await page.keyboard.press("Escape");

      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const size of SIZES) {
    test(`AI review at ${size.width}×${size.height} (${theme})`, async ({ page }) => {
      await withStandInAi(page);
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });
      await start(page);
      await turnOnAi(page);
      await openAiReview(page);
      const problems = await layoutProblems(page, "AI review");
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}
