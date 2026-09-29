import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { frontMatterMetadata } from "../src/services/frontMatter";
import { markdownToDocx } from "../src/services/convert/toDocx";
import { markdownToPdf } from "../src/services/convert/toPdf";
import { buildHtmlDocument } from "../src/services/exportHtml";

const DOC = `---
title: Quarterly Report
authors: [Ada Lovelace, Grace Hopper]
summary: "Results & plans for Q3"
tags:
  - finance
  - q3
---

# Quarterly Report
`;

describe("document properties from front matter", () => {
  it("reads author, description and keywords (with aliases and lists)", () => {
    expect(frontMatterMetadata(DOC)).toEqual({
      author: "Ada Lovelace, Grace Hopper",
      description: "Results & plans for Q3",
      keywords: "finance, q3",
    });
    expect(frontMatterMetadata("# No front matter")).toEqual({});
    expect(frontMatterMetadata("---\nauthor: \"\"\n---\n")).toEqual({});
  });

  it("writes them to the Word core properties", async () => {
    const bytes = await markdownToDocx(DOC, { title: "Quarterly Report", ...frontMatterMetadata(DOC) });
    const core = await (await JSZip.loadAsync(bytes)).file("docProps/core.xml")!.async("string");
    expect(core).toContain("<dc:creator>Ada Lovelace, Grace Hopper</dc:creator>");
    expect(core).toContain("<dc:description>Results &amp; plans for Q3</dc:description>");
    expect(core).toContain("<cp:keywords>finance, q3</cp:keywords>");
  });

  it("writes them to the PDF document information", async () => {
    const bytes = await markdownToPdf(DOC, { title: "Quarterly Report", ...frontMatterMetadata(DOC) });
    const pdf = new TextDecoder("latin1").decode(bytes);
    // The info dictionary points to string objects: /Author 17 0 R … 17 0 obj (Ada…) endobj.
    for (const key of ["Author", "Subject", "Keywords"]) expect(pdf).toMatch(new RegExp(`/${key}\\s+\\d+ 0 R`));
    expect(pdf).toContain("(Ada Lovelace, Grace Hopper)");
    expect(pdf).toContain("(Results & plans for Q3)");
    expect(pdf).toContain("(finance, q3)");
  }, 30_000);

  it("writes them as escaped meta tags in HTML", async () => {
    const html = await buildHtmlDocument({ markdown: DOC, name: "report.md", docPath: null });
    expect(html).toContain('<meta name="author" content="Ada Lovelace, Grace Hopper">');
    expect(html).toContain('<meta name="description" content="Results &amp; plans for Q3">');
    expect(html).toContain('<meta name="keywords" content="finance, q3">');
  });
});
