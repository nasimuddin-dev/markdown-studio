import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { epubToMarkdown } from "../src/services/convert/epub";
import { markdownToEpub } from "../src/services/convert/toEpub";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const page = (body: string) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink"><head><title>t</title></head><body>${body}</body></html>`;

/** A hand-made book: chapters in the spine in the order given, files under OEBPS/. */
async function makeBook(files: Record<string, string>, spine: string[], extra: Record<string, string | Uint8Array> = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  const items = Object.keys(files).map((f, i) => `<item id="c${i}" href="${f}" media-type="application/xhtml+xml"/>`).join("");
  const refs = spine.map((f) => `<itemref idref="c${Object.keys(files).indexOf(f)}"/>`).join("");
  zip.file("OEBPS/book.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>The Book</dc:title><dc:creator>A. Writer</dc:creator><dc:language>de</dc:language></metadata><manifest>${items}<item id="img" href="images/pic.png" media-type="image/png"/></manifest><spine>${refs}</spine></package>`);
  for (const [name, body] of Object.entries(files)) zip.file(`OEBPS/${name}`, page(body));
  zip.file("OEBPS/images/pic.png", PNG, { base64: true });
  for (const [name, content] of Object.entries(extra)) zip.file(name, content);
  return (await zip.generateAsync({ type: "uint8array" })).buffer as ArrayBuffer;
}

describe("EPUB import", () => {
  it("reads the chapters in reading order, with the book's details as front matter", async () => {
    const data = await makeBook({ "b.xhtml": "<h1>Two</h1><p>Second.</p>", "a.xhtml": "<h1>One</h1><p>First <em>chapter</em>.</p>" }, ["a.xhtml", "b.xhtml"]);
    const { markdown, warnings } = await epubToMarkdown(data, "book");
    expect(warnings).toEqual([]);
    expect(markdown.startsWith("---\ntitle: The Book\nauthor: A. Writer\nlang: de\n---\n\n# One")).toBe(true);
    expect(markdown.indexOf("# One")).toBeLessThan(markdown.indexOf("# Two"));
    expect(markdown).toContain("First *chapter*.");
  });

  it("saves pictures as assets, including an SVG cover page's", async () => {
    const data = await makeBook(
      {
        "cover.xhtml": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image xlink:href="images/pic.png" width="10" height="10"/></svg>',
        "text/ch1.xhtml": '<h1>Story</h1><p><img src="../images/pic.png" alt="A picture"/></p>',
      },
      ["cover.xhtml", "text/ch1.xhtml"],
    );
    const { markdown, images } = await epubToMarkdown(data, "My Book");
    // The same picture twice is saved once.
    expect(images).toEqual([{ name: "My-Book-1.png", base64: PNG, contentType: "image/png" }]);
    expect(markdown).toContain("![A picture](assets/My-Book-1.png)");
    expect(markdown.match(/assets\/My-Book-1\.png/g)).toHaveLength(2);
  });

  it("turns links between chapters into links within the document", async () => {
    const data = await makeBook(
      {
        "a.xhtml": '<h1>Start</h1><p>See <a href="b.xhtml#details">the details</a> and <a href="b.xhtml">chapter two</a>, or <a href="https://example.com">the web</a>.</p>',
        "b.xhtml": '<h1>Chapter Two</h1><h2 id="details">More Details</h2><p>Text.</p>',
      },
      ["a.xhtml", "b.xhtml"],
    );
    const { markdown } = await epubToMarkdown(data);
    expect(markdown).toContain("[the details](#more-details)");
    expect(markdown).toContain("[chapter two](#chapter-two)");
    expect(markdown).toContain("[the web](https://example.com)");
  });

  it("refuses a book protected with DRM, but not one with obfuscated fonts", async () => {
    const encryption = (uri: string) => `<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:CipherData><enc:CipherReference URI="${uri}"/></enc:CipherData></enc:EncryptedData></encryption>`;
    const drm = await makeBook({ "a.xhtml": "<p>Secret</p>" }, ["a.xhtml"], { "META-INF/encryption.xml": encryption("OEBPS/a.xhtml") });
    const locked = await epubToMarkdown(drm);
    expect(locked.markdown).toBe("");
    expect(locked.warnings[0]).toMatch(/DRM/);
    const fonts = await makeBook({ "a.xhtml": "<p>Open</p>" }, ["a.xhtml"], { "META-INF/encryption.xml": encryption("OEBPS/fonts/serif.otf") });
    expect((await epubToMarkdown(fonts)).markdown).toContain("Open");
  });

  it("throws for a zip that isn't a book", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "hi");
    await expect(epubToMarkdown((await zip.generateAsync({ type: "uint8array" })).buffer as ArrayBuffer)).rejects.toThrow(/Not an EPUB/);
  });

  it("brings back what Export as EPUB wrote", async () => {
    const source = "---\ntitle: Round Trip\nauthor: Ada\n---\n\n# Heading\n\nSome **bold** text and a [link](#more).\n\n## More\n\n- one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n";
    const bytes = await markdownToEpub(source, { name: "rt.md", docPath: null, features: { math: false, diagrams: false } });
    const { markdown } = await epubToMarkdown(bytes.buffer as ArrayBuffer);
    expect(markdown).toContain("title: Round Trip");
    expect(markdown).toContain("author: Ada");
    expect(markdown).toContain("# Heading");
    expect(markdown).toContain("**bold**");
    expect(markdown).toContain("[link](#more)");
    expect(markdown).toMatch(/-\s+one/);
    expect(markdown).toMatch(/\|\s*a\s*\|\s*b\s*\|/);
  });
});
