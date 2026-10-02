import { expect, test } from "@playwright/test";
import { chooseMenu } from "./menu";

/**
 * An exported e-book, opened in epub.js (the reading engine behind many web
 * and desktop e-readers): the table of contents loads, every chapter in the
 * reading order renders with its text, pictures resolve inside the book, and
 * the contents' links lead to headings that exist. EPUBCheck (CI) checks the
 * format; this checks that a reader shows it. (epubjs is a dev dependency loaded by URL;
 * knip.json lists it in ignoreDependencies because knip cannot see script tags.)
 */

const mod = process.platform === "darwin" ? "Meta" : "Control";

test("an exported e-book opens and renders in epub.js", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("epub-started")) {
      localStorage.clear();
      sessionStorage.setItem("epub-started", "1");
    }
    window.prompt = (_m?: string, d?: string) => d ?? null;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Markpion" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Open Folder" }).first().click();
  await page.locator(".tree-row", { hasText: /^README\.md$/ }).click();
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.press(`${mod}+End`);
  // A footnote and a link to a heading in another chapter, besides the README's own content.
  await page.keyboard.insertText("\n\n# Notes chapter\n\nA claim[^1] and [back to the start](#welcome-to-markpion).\n\n[^1]: The source.\n");
  const download = page.waitForEvent("download");
  await chooseMenu(page, "File", "Export", "EPUB (E-book)…");
  const bytes = Buffer.concat(await (await (await download).createReadStream()).toArray()).toString("base64");

  // A plain page of the dev server (not the app), with epub.js and the JSZip it needs.
  await page.goto("/node_modules/epubjs/package.json");
  await page.addScriptTag({ url: "/node_modules/jszip/dist/jszip.min.js" });
  await page.addScriptTag({ url: "/node_modules/epubjs/dist/epub.min.js" });
  const result = await page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
    // epub.js's global (no types: it's loaded as a script in this page).
    const ePub = (window as unknown as { ePub: (d: ArrayBuffer) => any }).ePub; // eslint-disable-line @typescript-eslint/no-explicit-any
    const book = ePub(data);
    await book.ready;
    const toc = (await book.loaded.navigation).toc.map((t: { label: string }) => t.label.trim());
    const host = document.createElement("div");
    host.style.cssText = "width: 600px; height: 800px";
    document.body.appendChild(host);
    const rendition = book.renderTo(host, { width: 600, height: 800, flow: "scrolled-doc" });
    const chapters: { href: string; text: number; heading: string; images: number; brokenImages: number }[] = [];
    for (const item of book.spine.spineItems) {
      await rendition.display(item.href);
      const doc = (host.querySelector("iframe") as HTMLIFrameElement).contentDocument!;
      const images = [...doc.images];
      await Promise.all(
        images.map((img) =>
          img.complete
            ? null
            : new Promise((done) => {
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
              }),
        ),
      );
      chapters.push({
        href: item.href,
        text: (doc.body.textContent ?? "").trim().length,
        heading: (doc.querySelector("h1, h2")?.textContent ?? "").trim(),
        images: images.length,
        brokenImages: images.filter((img) => !img.naturalWidth).length,
      });
    }
    // Every contents link points at a chapter in the book and, with a fragment, at an element in it.
    const missing: string[] = [];
    for (const entry of (await book.loaded.navigation).toc as { href: string }[]) {
      const [file, id] = entry.href.split("#");
      const section = book.spine.get(file);
      if (!section) {
        missing.push(entry.href);
        continue;
      }
      const root = (await section.load(book.load.bind(book))) as Element;
      if (id && !root.querySelector(`[id="${CSS.escape(decodeURIComponent(id))}"]`)) missing.push(entry.href);
    }
    return { toc, chapters, missing, title: (await book.loaded.metadata).title };
  }, bytes);

  console.log(`epub.js: "${result.title}", ${result.chapters.length} chapters, ${result.toc.length} contents entries, ${result.chapters.reduce((n, c) => n + c.images, 0)} pictures`);
  expect(result.title).toBeTruthy();
  expect(result.toc.length).toBeGreaterThan(1);
  expect(result.chapters.length).toBeGreaterThan(1);
  for (const c of result.chapters) {
    expect(c.text, `${c.href} has text`).toBeGreaterThan(0);
    expect(c.brokenImages, `${c.href}: pictures that didn't load`).toBe(0);
  }
  expect(result.chapters.some((c) => c.images > 0), "a chapter shows the README's picture").toBe(true);
  expect(result.chapters.at(-1)!.heading).toBe("Notes chapter");
  expect(result.missing).toEqual([]);
});
