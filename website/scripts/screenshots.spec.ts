/**
 * Captures real screenshots of the Markpion UI for the website
 * (run: npm run docs:screenshots from the repository root). It drives the
 * browser build of the app (the same React UI as the desktop app, with the
 * in-memory demo workspace) and saves optimized WebP images to
 * website/docs/images/ (and the social preview to docs/public/images/).
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "website", "docs", "images");
const PUBLIC = join(process.cwd(), "website", "docs", "public", "images");
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function start(page: Page, theme: "light" | "dark" = "light") {
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

/** Saves a WebP screenshot, encoded by the browser's canvas (no extra tools needed). */
async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0);
  const png = await page.screenshot({ type: "png" });
  const dataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/webp", 0.86);
  }, png.toString("base64"));
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(join(OUT, `${name}.webp`), bytes);
  // The social-sharing preview needs a stable URL, so it lives in public/.
  if (name === "markpion-editor") writeFileSync(join(PUBLIC, "social-preview.webp"), bytes);
}

async function openFolder(page: Page) {
  await page.getByRole("button", { name: "Open Folder" }).first().click();
  await expect(page.getByRole("treeitem", { name: /README\.md/ })).toBeVisible();
}

async function openFile(page: Page, name: RegExp) {
  await page.locator(".tree-row", { hasText: name }).first().click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

test("welcome screen", async ({ page }) => {
  await start(page);
  await shot(page, "markpion-home");
});

test("editor, explorer, outline and preview", async ({ page }) => {
  await start(page);
  await openFolder(page);
  await openFile(page, /^README\.md/);
  await expect(page.locator(".markdown-body h1")).toBeVisible();
  await shot(page, "markpion-editor");
});

test("preview only", async ({ page }) => {
  await start(page);
  await openFolder(page);
  await openFile(page, /^README\.md/);
  await page.keyboard.press(`${mod}+3`);
  await expect(page.locator(".markdown-body h1")).toBeVisible();
  await shot(page, "markpion-preview");
});

test("mermaid diagrams and math", async ({ page }) => {
  await start(page);
  await openFolder(page);
  const folder = page.locator(".tree-row", { hasText: /^docs$/ });
  if (await folder.count()) await folder.first().click();
  await openFile(page, /^diagrams-and-math\.md/);
  await expect(page.locator(".markdown-body svg").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".markdown-body math, .markdown-body .katex").first()).toBeVisible();
  await shot(page, "markpion-mermaid");
});

test("dark theme", async ({ page }) => {
  await start(page, "dark");
  await openFolder(page);
  const folder = page.locator(".tree-row", { hasText: /^docs$/ });
  if (await folder.count()) await folder.first().click();
  await openFile(page, /^guide\.md/);
  await expect(page.locator(".markdown-body h1")).toBeVisible();
  await shot(page, "markpion-dark");
});
