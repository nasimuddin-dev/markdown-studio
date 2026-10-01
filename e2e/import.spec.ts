import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { chooseMenu } from "./menu";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function start(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("import-started")) {
      localStorage.clear();
      sessionStorage.setItem("import-started", "1");
    }
    window.prompt = (_m?: string, d?: string) => d ?? null;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open Folder" }).first().click();
  await expect(page.getByRole("treeitem", { name: /README\.md/ })).toBeVisible();
}

test("imports a Word document as Markdown with its images", async ({ page }) => {
  await start(page);
  const chooser = page.waitForEvent("filechooser");
  await chooseMenu(page, "File", "Import", "Word Document (.docx)…");
  await (await chooser).setFiles(fixture("report.docx"));

  // Saved as /demo/report.md (the demo's Save As prompt accepts the default).
  await expect(page.getByRole("tab", { name: /report\.md/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("treeitem", { name: /report\.md/ })).toBeVisible();
  const preview = page.locator(".markdown-body");
  await expect(preview.locator("h1")).toHaveText("Imported Report");
  await expect(preview.locator("strong")).toHaveText("Word");
  await expect(preview.locator("li")).toHaveText(["Alpha", "Beta"]);
  await expect(preview.locator("table th")).toHaveText(["Name", "Score"]);
  await expect(preview.locator("table td")).toHaveText(["Ada", "99"]);
  // The embedded image was saved to assets/ and renders.
  const img = preview.locator("img");
  await expect(img).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(page.locator(".toast")).toContainText(/Imported “report\.docx” \(1 image saved to assets\//);
});

test("imports a PDF as Markdown with headings and lists", async ({ page }) => {
  await start(page);
  const chooser = page.waitForEvent("filechooser");
  await chooseMenu(page, "File", "Import", "PDF (.pdf)…");
  await (await chooser).setFiles(fixture("report.pdf"));

  await expect(page.getByRole("tab", { name: /report\.md/ })).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  const preview = page.locator(".markdown-body");
  await expect(preview.locator("h1")).toHaveText("Annual Report");
  await expect(preview.locator("h2")).toHaveText(["Overview", "Outlook"]);
  await expect(preview.locator("h3")).toHaveText("Key results");
  await expect(preview.locator("ul li")).toHaveText(["Revenue up 20%", "Costs down 5%"]);
  await expect(preview.locator("ol li")).toHaveText(["Hire more engineers", "Expand to Asia"]);
  await expect(preview).toContainText("with strong performance overall.");
  await expect(preview).not.toContainText("Confidential");
});

test("pastes rich text from the clipboard as Markdown", async ({ page, context }) => {
  await start(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.keyboard.press(process.platform === "darwin" ? "Meta+N" : "Control+N");
  const editor = page.getByRole("textbox", { name: "Markdown editor" });
  await editor.click();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/html", "<h2>From the web</h2><p>A <a href='https://example.com'>link</a> and <b>bold</b>.</p><ul><li>x</li></ul>");
    dt.setData("text/plain", "From the web A link and bold. x");
    document.querySelector(".cm-content")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator(".cm-content")).toContainText("## From the web");
  await expect(page.locator(".cm-content")).toContainText("[link](https://example.com)");
  await expect(page.locator(".markdown-body h2")).toHaveText("From the web");
});

test("imports an e-book (.epub) as Markdown with its pictures", async ({ page }) => {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file("OPS/book.opf", '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Field Notes</dc:title></metadata><manifest><item id="a" href="one.xhtml" media-type="application/xhtml+xml"/><item id="b" href="two.xhtml" media-type="application/xhtml+xml"/><item id="p" href="pic.png" media-type="image/png"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>');
  const page1 = (body: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;
  zip.file("OPS/one.xhtml", page1('<h1>Morning</h1><p>Birds at <a href="two.xhtml">dusk</a>.</p><p><img src="pic.png" alt="Heron"/></p>'));
  zip.file("OPS/two.xhtml", page1("<h1>Dusk</h1><ul><li>Owl</li><li>Bat</li></ul>"));
  zip.file("OPS/pic.png", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", { base64: true });
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await start(page);
  const chooser = page.waitForEvent("filechooser");
  await chooseMenu(page, "File", "Import", "E-book (.epub)…");
  await (await chooser).setFiles({ name: "notes.epub", mimeType: "application/epub+zip", buffer });

  await expect(page.getByRole("tab", { name: /notes\.md/ })).toHaveAttribute("aria-selected", "true");
  const preview = page.locator(".markdown-body");
  await expect(preview.locator("h1")).toHaveText(["Morning", "Dusk"]);
  await expect(preview.locator("li")).toHaveText(["Owl", "Bat"]);
  await expect(preview.locator("img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(preview.getByRole("link", { name: "dusk" })).toHaveAttribute("href", "#dusk");
  await expect(page.locator(".toast")).toContainText(/Imported “notes\.epub” \(1 image saved to assets\//);
});
