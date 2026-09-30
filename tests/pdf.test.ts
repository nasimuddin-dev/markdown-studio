import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { linesToMarkdown, pdfToMarkdown, setPdfJsLoader, stripRunningText, type Line } from "../src/services/convert/pdf";
import { makePdf, sampleReportPdf } from "./pdfFixture";

beforeAll(() => {
  // In Node tooling pdf.js runs its legacy build with an in-process worker.
  const require = createRequire(import.meta.url);
  setPdfJsLoader(async () => {
    const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    lib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
    const root = require.resolve("pdfjs-dist/package.json").replace(/package\.json$/, "");
    return {
      lib: lib as unknown as typeof import("pdfjs-dist"),
      cMapUrl: root + "cmaps/",
      standardFontDataUrl: root + "standard_fonts/",
    };
  });
});

const buf = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

describe("PDF → Markdown", () => {
  it("reconstructs headings, paragraphs, lists and drops running headers/footers", async () => {
    const { markdown, warnings } = await pdfToMarkdown(buf(sampleReportPdf()));
    expect(warnings).toEqual([]);
    expect(markdown).toBe(
      [
        "# Annual Report",
        "",
        "## Overview",
        "",
        "This year the company grew in every region and opened two new offices in Europe, with strong performance overall.",
        "",
        "### Key results",
        "",
        "- Revenue up 20%",
        "- Costs down 5%",
        "",
        "1. Hire more engineers",
        "2. Expand to Asia",
        "",
        "## Outlook",
        "",
        "Next year looks bright.",
        "",
      ].join("\n"),
    );
  }, 30_000);

  it("reports PDFs without text (e.g. scans)", async () => {
    const empty = makePdf([[]]);
    const r = await pdfToMarkdown(buf(empty));
    expect(r.markdown).toBe("");
    expect(r.warnings[0]).toMatch(/no selectable text/);
  }, 30_000);

  it("rejects files that aren't PDFs", async () => {
    await expect(pdfToMarkdown(buf(new TextEncoder().encode("hello")))).rejects.toThrow();
  }, 30_000);
});

describe("running text detection", () => {
  it("removes repeated edge lines and page numbers, keeps body text", () => {
    const line = (text: string, page: number, y: number): Line => ({ text, page, y, x: 0, size: 10, bold: false, pageHeight: 792 });
    const pages = [1, 2, 3].map((p) => [line("Report 2026", p, 780), line(`Body ${p}`, p, 500), line(`${p} / 3`, p, 20)]);
    expect(stripRunningText(pages).map((p) => p.map((l) => l.text))).toEqual([["Body 1"], ["Body 2"], ["Body 3"]]);
  });

  describe("bullet lists", () => {
    /** Lines 14 pt apart from the top of page 1; `x` defaults to the left margin. */
    const lines = (...specs: Array<string | [string, number] | [string, number, number]>): Line[][] => {
      let y = 700;
      return [
        specs.map((s) => {
          const [text, x = 72, dy = 14] = typeof s === "string" ? [s] : s;
          y -= dy;
          return { text, x, y, size: 11, bold: false, page: 1, pageHeight: 792 };
        }),
      ];
    };

    it("recognises Word's Symbol and Wingdings bullets and joins wrapped items", () => {
      const md = linesToMarkdown(lines("Summary of the work.", " First point that wraps", ["onto a second line", 90], " Second point", "Third point", "After the list."));
      expect(md).toBe("Summary of the work.\n\n- First point that wraps onto a second line\n- Second point\n- Third point\n\nAfter the list.\n");
    });

    it("accepts bullets without a space and bullets on a separate baseline", () => {
      expect(linesToMarkdown(lines("•Alpha", "·Beta"))).toBe("- Alpha\n- Beta\n");
      // The glyph sits 2 pt off the text's baseline, so it becomes a line of its own.
      expect(linesToMarkdown(lines(["", 72], ["Gamma item", 90, 2], ["", 72, 12], ["Delta item", 90, 2]))).toBe("- Gamma item\n- Delta item\n");
    });

    it("nests items by indentation, including Word's “o” sub-bullets", () => {
      const md = linesToMarkdown(lines("• Fruit", ["o Apple", 90], ["o Pear", 90], ["▪ Deeper", 108], "• Vegetables", "1. Numbered", ["• Under it", 90]));
      expect(md).toBe("- Fruit\n  - Apple\n  - Pear\n    - Deeper\n- Vegetables\n\n1. Numbered\n   - Under it\n");
    });

    it("keeps text that only looks like a bullet", () => {
      expect(linesToMarkdown(lines("-5 degrees overnight", "open the door"))).toBe("-5 degrees overnight open the door\n");
      expect(linesToMarkdown(lines("o no, not a list"))).toBe("o no, not a list\n");
    });
  });
});
