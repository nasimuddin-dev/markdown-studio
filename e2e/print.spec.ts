import { expect, test } from "@playwright/test";

const mod = process.platform === "darwin" ? "Meta" : "Control";

test("printing adds the document title and page numbers to each page", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    // The print dialog can't be driven; the page is rendered to PDF below instead.
    window.print = () => {};
  });
  await page.goto("/");
  await page.keyboard.press(`${mod}+N`);
  await page.getByRole("textbox", { name: "Markdown editor" }).click();
  await page.keyboard.insertText("# Quarterly Report\n\n" + "Some text.\n\n".repeat(120));
  // Control time so the print styles (removed a second after printing) are still there for the PDF.
  await page.clock.install();
  await page.keyboard.press(`${mod}+P`);
  await page.clock.runFor(200);
  await expect(page.locator("#print-root")).toHaveCount(1);

  const pdf = await page.pdf({ format: "A4" });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  expect(doc.numPages).toBeGreaterThan(1);
  // The title at the top of every page, "page / pages" at the bottom.
  for (const text of pages) expect(text).toContain("Quarterly Report");
  expect(pages[1]).toContain(`2 / ${doc.numPages}`);
});
