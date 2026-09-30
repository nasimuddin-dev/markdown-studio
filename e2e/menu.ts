import type { Page } from "@playwright/test";

/**
 * Chooses an item from the in-app menu bar, through any submenus:
 * chooseMenu(page, "File", "Export", "PDF…"). A string matches the whole
 * accessible name, a RegExp any part of it.
 */
export async function chooseMenu(page: Page, menu: string, ...path: Array<string | RegExp>) {
  await page.getByRole("navigation", { name: "Application menu" }).getByRole("button", { name: menu, exact: true }).click();
  for (const name of path) {
    const exact = typeof name === "string";
    // Checkable items (View › Editor › Word Wrap…) have the menuitemcheckbox role.
    const item = page.getByRole("menuitem", { name, exact }).or(page.getByRole("menuitemcheckbox", { name, exact }));
    await item.first().click();
  }
}
