import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { imageSize, makeImageLoader, markdownToDocx } from "../src/services/convert/toDocx";
import { docxToMarkdown } from "../src/services/convert/docx";
import { exportActiveAsDocx } from "../src/features/exporting";
import { openPath } from "../src/features/documents";
import { setupBackend } from "./helpers";

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const SAMPLE = `# Project Plan

Intro with **bold**, *italic*, ~~old~~ and \`code\` and a [link](https://example.com).

## Tasks

1. First
2. Second
   - nested bullet
3. Third

- [x] done
- [ ] todo

| Name | Qty |
| :--- | --: |
| Pens | 10 |

> Quoted text

\`\`\`js
const x = 1;
\`\`\`

---

![Dot](data:image/png;base64,${PNG_B64})
`;

async function documentXml(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  return zip.file("word/document.xml")!.async("string");
}

describe("Markdown → Word (.docx)", () => {
  it("produces a valid Word package with Word heading styles, lists, tables and images", async () => {
    const bytes = await markdownToDocx(SAMPLE, {
      title: "Project Plan",
      loadImage: makeImageLoader(null, async () => ""),
    });
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    const xml = await documentXml(bytes);
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="Heading2"');
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:strike/>");
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("w:tblHeader");
    expect(xml).toContain("☑ ");
    expect(xml).toContain("<w:drawing>");
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).some((f) => f.startsWith("word/media/"))).toBe(true);
    expect(await zip.file("docProps/core.xml")!.async("string")).toContain("Project Plan");
  }, 20_000);

  it("round-trips through the Word importer", async () => {
    const bytes = await markdownToDocx(SAMPLE, { loadImage: makeImageLoader(null, async () => "") });
    const back = await docxToMarkdown(bytes.buffer as ArrayBuffer, "roundtrip");
    const md = back.markdown;
    expect(md).toContain("# Project Plan");
    expect(md).toContain("## Tasks");
    expect(md).toContain("**bold**");
    expect(md).toContain("*italic*");
    expect(md).toContain("[link](https://example.com)");
    expect(md).toMatch(/1\. +First/);
    expect(md).toMatch(/\| Name +\| Qty +\|/);
    expect(md).toMatch(/\| Pens +\| 10 +\|/);
    expect(md).toContain("const x = 1;");
    expect(back.images).toHaveLength(1);
  }, 20_000);

  it("falls back to alt text for images it can't embed", async () => {
    const bytes = await markdownToDocx("![Remote](https://example.com/a.png)");
    expect(await documentXml(bytes)).toContain("[Remote]");
  });

  it("reads image sizes from headers", () => {
    const png = Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));
    expect(imageSize(png)).toEqual({ width: 1, height: 1 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("exports the active document through the backend", async () => {
    const backend = setupBackend({ "/ws/plan.md": "# Plan\n\nHello" });
    await openPath("/ws/plan.md");
    await exportActiveAsDocx();
    expect(backend.lastExport?.name).toBe("plan.docx");
    expect(atob(backend.lastExport!.content).slice(0, 2)).toBe("PK");
  }, 20_000);
});

describe("alerts in Word export", () => {
  it("writes a coloured label instead of the [!NOTE] marker", async () => {
    const bytes = await markdownToDocx("> [!IMPORTANT]\n> Read this.");
    const xml = await (await JSZip.loadAsync(bytes)).file("word/document.xml")!.async("string");
    expect(xml).toContain(">Important<");
    expect(xml).toContain('w:color w:val="8250DF"');
    expect(xml).toContain("Read this.");
    expect(xml).not.toContain("[!IMPORTANT]");
  });
});

describe("footnotes in Word export", () => {
  it("creates real Word footnotes, numbered in reference order", async () => {
    const md = "First claim[^b] and second[^a], first again[^b].\n\n[^a]: Note A.\n[^b]: Note B with **bold**.\n[^unused]: Never referenced.";
    const zip = await JSZip.loadAsync(await markdownToDocx(md));
    const doc = await zip.file("word/document.xml")!.async("string");
    const notes = await zip.file("word/footnotes.xml")!.async("string");
    const refs = [...doc.matchAll(/<w:footnoteReference w:id="(\d+)"\/>/g)].map((m) => m[1]);
    expect(refs).toEqual(["1", "2", "1"]);
    const byId = Object.fromEntries(
      [...notes.matchAll(/<w:footnote w:id="(\d+)">([\s\S]*?)<\/w:footnote>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, "")]),
    );
    expect(byId["1"]).toContain("Note B with bold.");
    expect(byId["2"]).toContain("Note A.");
    expect(notes).not.toContain("Never referenced");
    expect(doc).not.toContain("Note A.");
  });
});

describe("Mermaid diagrams in Word export", () => {
  const md = "Before\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nAfter";
  const png = () => Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));

  it("embeds the drawn diagram as a picture", async () => {
    const zip = await JSZip.loadAsync(await markdownToDocx(md, { renderDiagram: async () => ({ data: png(), width: 400, height: 200 }) }));
    expect(Object.keys(zip.files).some((f) => /^word\/media\/.+\.png$/.test(f))).toBe(true);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).not.toContain("graph TD");
    expect(xml).toContain("Mermaid diagram");
  });

  it("keeps the code when the diagram can't be drawn", async () => {
    const zip = await JSZip.loadAsync(await markdownToDocx(md, { renderDiagram: async () => { throw new Error("Parse error"); } }));
    expect(await zip.file("word/document.xml")!.async("string")).toContain("graph TD");
  });
});

describe("math in Word export", () => {
  const documentXml = async (md: string, opts = {}) =>
    (await JSZip.loadAsync(await markdownToDocx(md, opts))).file("word/document.xml")!.async("string");

  it("exports formulas as native Word equations", async () => {
    const xml = await documentXml("Inline $\\frac{a}{b}$ here.\n\n$$\n\\sum_{k=1}^{n} k^2\n$$\n\nAnd $\\sqrt{x}$.");
    expect(xml.match(/<m:oMath>/g)?.length).toBe(3);
    expect(xml).toContain("<m:f>"); // fraction
    expect(xml).toContain("<m:nary>"); // sum
    expect(xml).toContain("<m:rad>"); // square root
    expect(xml).not.toContain("\\frac");
    expect(xml).toMatch(/<m:t[^>]*>∑<\/m:t>|m:chr m:val="∑"/);
  });

  it("sets function names such as sin and lim upright", async () => {
    const xml = await documentXml("$\\lim_{x \\to 0} \\frac{\\sin x}{x}$");
    expect(xml).toContain('<m:sty m:val="p"/></m:rPr><m:t>lim</m:t>');
    expect(xml).toContain('<m:sty m:val="p"/></m:rPr><m:t>sin</m:t>');
  });

  it("keeps the LaTeX of formulas it can't convert", async () => {
    const xml = await documentXml("$$\n\\begin{pmatrix} a & b \\end{pmatrix}\n$$\n\nand $x \\unknown y$");
    expect(xml).not.toContain("<m:oMath>");
    expect(xml).toContain("\\begin{pmatrix}");
    expect(xml).toContain("$x \\unknown y$");
  });

  it("leaves dollar signs alone when math is turned off", async () => {
    const xml = await documentXml("Costs $5 and $10.", { math: false });
    expect(xml).not.toContain("<m:oMath>");
    expect(xml).toContain("Costs $5 and $10.");
  });
});

describe("Word export: links within the document", () => {
  it("makes headings bookmarks and #anchor links internal hyperlinks", async () => {
    const md = "# Guide\n\n- [Install](#install)\n- [Use it](#use-it)\n- [Missing](#nowhere)\n\n## Install\n\ntext\n\n## Use it\n\ntext";
    const xml = await documentXml(await markdownToDocx(md));
    expect(xml.match(/<w:bookmarkStart[^>]*w:name="_h\d+"/g)).toHaveLength(3);
    expect(xml).toContain('w:anchor="_h2"');
    expect(xml).toContain('w:anchor="_h3"');
    // A link to a heading that doesn't exist stays plain text.
    expect(xml.match(/w:anchor=/g)).toHaveLength(2);
    expect(xml).toContain("Missing");
  });
});

describe("Word import: links within the document", () => {
  it("turns links to heading bookmarks into Markdown heading anchors (round trip)", async () => {
    const md = "# Guide\n\n- [Install](#install)\n- [Use it](#use-it)\n\n## Install\n\ntext\n\n## Use it\n\ntext";
    const bytes = await markdownToDocx(md);
    const back = await docxToMarkdown(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(back.markdown).toContain("[Install](#install)");
    expect(back.markdown).toContain("[Use it](#use-it)");
    expect(back.markdown).not.toMatch(/_h\d|<a id/);
  });

  it("maps Word's own TOC bookmarks", async () => {
    const { linksToHeadingAnchors } = await import("../src/services/convert/docx");
    const html = '<p><a href="#_Toc1">Setup and install</a></p><h2><a id="_Toc1"></a>Setup and install</h2><p><a href="#elsewhere">x</a></p>';
    const out = linksToHeadingAnchors(html);
    expect(out).toContain('href="#setup-and-install"');
    expect(out).not.toContain('id="_Toc1"');
    expect(out).toContain('href="#elsewhere"');
  });

  it("maps a web page's heading ids when importing HTML", async () => {
    const { htmlFileToMarkdown } = await import("../src/services/convert/docx");
    const page = '<p><a href="#sec-2">Jump</a></p><h2 id="sec-2">Getting Started</h2><p>x</p>';
    expect(htmlFileToMarkdown(page).markdown).toContain("[Jump](#getting-started)");
  });
});

describe("Word export: running title", () => {
  it("puts the title in the header of pages after the first, and page numbers on every page", async () => {
    const zip = await JSZip.loadAsync(await markdownToDocx("# Annual Review\n\ntext", { title: "Annual Review" }));
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("<w:titlePg/>");
    const headers = await Promise.all(Object.keys(zip.files).filter((f) => /word\/header\d+\.xml$/.test(f)).map((f) => zip.file(f)!.async("string")));
    expect(headers.some((h) => h.includes("Annual Review"))).toBe(true);
    expect(Object.keys(zip.files).filter((f) => /word\/footer\d+\.xml$/.test(f))).toHaveLength(2);
    // Without a title, no header and no special first page.
    const plain = await JSZip.loadAsync(await markdownToDocx("text"));
    expect(await plain.file("word/document.xml")!.async("string")).not.toContain("<w:titlePg/>");
  });
});
