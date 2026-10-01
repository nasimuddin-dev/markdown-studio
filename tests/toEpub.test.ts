import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { markdownToEpub } from "../src/services/convert/toEpub";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function book(markdown: string, loadImage = async (_path: string) => PNG) {
  const bytes = await markdownToEpub(markdown, {
    name: "notes.md",
    docPath: "/docs/notes.md",
    loadImage,
    features: { math: true, diagrams: false },
    id: "urn:uuid:test",
    now: new Date("2026-10-01T12:00:00.123Z"),
  });
  const zip = await JSZip.loadAsync(bytes);
  const text = (name: string) => zip.file(name)!.async("string");
  return { bytes, zip, text };
}

const xml = (s: string) => {
  const doc = new DOMParser().parseFromString(s, "application/xhtml+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
};

describe("EPUB export", () => {
  it("starts with an uncompressed mimetype and points to the package document", async () => {
    const { bytes, text } = await book("# Title\n\nText.");
    // The first file's name and content, stored as is, right after its local header.
    const head = new TextDecoder().decode(bytes.slice(30, 58));
    expect(head).toBe("mimetypeapplication/epub+zip");
    expect(await text("META-INF/container.xml")).toContain('full-path="OEBPS/content.opf"');
  });

  it("fills in the title, author, language and modification time", async () => {
    const { text } = await book("---\ntitle: My Book\nauthor: Ada Lovelace\nlang: fr\ndescription: About things\n---\n\n# Chapter\n\nText.");
    const opf = await text("OEBPS/content.opf");
    xml(opf);
    expect(opf).toContain("<dc:title>My Book</dc:title>");
    expect(opf).toContain("<dc:creator>Ada Lovelace</dc:creator>");
    expect(opf).toContain("<dc:language>fr</dc:language>");
    expect(opf).toContain("<dc:description>About things</dc:description>");
    expect(opf).toContain('<meta property="dcterms:modified">2026-10-01T12:00:00Z</meta>');
    expect(opf).toContain('<dc:identifier id="book-id">urn:uuid:test</dc:identifier>');
  });

  it("writes well-formed XHTML, with math as MathML", async () => {
    const { text } = await book("# A & B\n\nLine<br>break, $x^2$ and a tick ✓.\n\n- [x] done\n\n| a | b |\n| - | - |\n| 1 | 2 |\n");
    const content = await text("OEBPS/content.xhtml");
    const doc = xml(content);
    expect(doc.getElementsByTagName("h1")[0].textContent).toBe("A & B");
    expect(content).toContain("<math");
    expect(await text("OEBPS/content.opf")).toContain('href="content.xhtml" media-type="application/xhtml+xml" properties="mathml"');
  });

  it("builds a nested table of contents from the headings", async () => {
    const { text } = await book("# One\n\n## One A\n\n### Deep\n\n## One B\n\n# Two\n");
    const nav = xml(await text("OEBPS/nav.xhtml"));
    const content = xml(await text("OEBPS/content.xhtml"));
    const top = nav.querySelector("nav > ol")!;
    expect([...top.children].map((li) => li.querySelector("a")!.textContent)).toEqual(["One", "Two"]);
    expect([...top.children[0].querySelector("ol")!.children].map((li) => li.querySelector("a")!.textContent)).toEqual(["One A", "One B"]);
    // Every link points at a heading that exists.
    for (const a of nav.querySelectorAll("a")) {
      const id = a.getAttribute("href")!.split("#")[1];
      expect(content.getElementById(id)?.textContent).toBe(a.textContent);
    }
  });

  it("packs local pictures once, and turns web pictures into links", async () => {
    const asked: string[] = [];
    const { zip, text } = await book("![Logo](pic.png) ![Again](pic.png) ![Remote](https://example.com/a.png)", async (path) => {
      asked.push(path);
      return PNG;
    });
    expect(asked).toEqual(["/docs/pic.png", "/docs/pic.png"]);
    expect(Object.keys(zip.files).filter((f) => f.startsWith("OEBPS/images/") && !zip.files[f].dir)).toEqual(["OEBPS/images/image1.png"]);
    const content = await text("OEBPS/content.xhtml");
    expect(content.match(/src="images\/image1\.png"/g)).toHaveLength(2);
    expect(content).toContain('<a href="https://example.com/a.png">Remote</a>');
    expect(await text("OEBPS/content.opf")).toContain('<item id="image1" href="images/image1.png" media-type="image/png" />');
  });

  it("makes the front matter's cover picture the book's cover, on a page before the text", async () => {
    const asked: string[] = [];
    const { zip, text } = await book("---\ntitle: Story\ncover: art/front.png\n---\n\nOnce upon a time.", async (path) => {
      asked.push(path);
      return PNG;
    });
    expect(asked).toEqual(["/docs/art/front.png"]);
    expect(zip.file("OEBPS/images/cover.png")).not.toBeNull();
    const opf = await text("OEBPS/content.opf");
    xml(opf);
    expect(opf).toContain('<item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image" />');
    expect(opf).toMatch(/<itemref idref="cover" \/>\s*<itemref idref="content" \/>/);
    const page = xml(await text("OEBPS/cover.xhtml"));
    expect(page.querySelector("img")!.getAttribute("src")).toBe("images/cover.png");
  });

  it("has no cover when the picture can't be read", async () => {
    const { zip, text } = await book("---\ncover: missing.png\n---\n\nText.", async () => {
      throw new Error("not found");
    });
    expect(zip.file("OEBPS/cover.xhtml")).toBeNull();
    expect(await text("OEBPS/content.opf")).not.toContain("cover");
  });

  it("keeps the description of a picture that can't be read", async () => {
    const { text } = await book("![Missing picture](gone.png)", async () => {
      throw new Error("not found");
    });
    const content = await text("OEBPS/content.xhtml");
    expect(content).not.toContain("<img");
    expect(content).toContain("Missing picture");
  });
});
