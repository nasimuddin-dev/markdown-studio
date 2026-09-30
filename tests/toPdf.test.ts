import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { markdownToPdf, pdfExportUnsupportedText } from "../src/services/convert/toPdf";
import { makeImageLoader } from "../src/services/convert/toDocx";
import { pdfToMarkdown, setPdfJsLoader } from "../src/services/convert/pdf";
import { exportActiveAsPdf } from "../src/features/exporting";
import { openPath } from "../src/features/documents";
import { autoAnswer, setupBackend } from "./helpers";

const require = createRequire(import.meta.url);
async function pdfjs() {
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  lib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
  return lib;
}
beforeAll(() => {
  const root = require.resolve("pdfjs-dist/package.json").replace(/package\.json$/, "");
  setPdfJsLoader(async () => ({
    lib: (await pdfjs()) as unknown as typeof import("pdfjs-dist"),
    cMapUrl: root + "cmaps/",
    standardFontDataUrl: root + "standard_fonts/",
  }));
});

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const SAMPLE = `# Handbook

Welcome to the **team**. Visit [our site](https://example.com).

## Getting started

1. Read this
2. Ask questions

### Tools

- [x] Laptop
- [ ] Badge

| Item | Owner |
| --- | --- |
| Laptop | IT |

\`\`\`
npm install
\`\`\`

> Remember to rest.

![Logo](data:image/png;base64,${PNG_B64})
`;

const buf = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

describe("Markdown → PDF", () => {
  it("produces a PDF with selectable text, links, an image and a heading bookmark tree", async () => {
    const bytes = await markdownToPdf(SAMPLE, { title: "Handbook", loadImage: makeImageLoader(null, async () => "") });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const lib = await pdfjs();
    const task = lib.getDocument({ data: bytes.slice() });
    const pdf = await task.promise;
    const meta = await pdf.getMetadata();
    expect((meta.info as { Title?: string }).Title).toBe("Handbook");
    const outline = await pdf.getOutline();
    expect(outline.map((o) => o.title)).toEqual(["Handbook"]);
    expect(outline[0].items.map((o) => o.title)).toEqual(["Getting started"]);
    expect(outline[0].items[0].items.map((o: { title: string }) => o.title)).toEqual(["Tools"]);

    const page = await pdf.getPage(1);
    const annotations = await page.getAnnotations();
    expect(annotations.some((a: { url?: string }) => a.url === "https://example.com/" || a.url === "https://example.com")).toBe(true);
    const ops = await page.getOperatorList();
    expect(ops.fnArray).toContain(lib.OPS.paintImageXObject);
    await task.destroy();
  }, 30_000);

  it("round-trips through the PDF importer", async () => {
    const bytes = await markdownToPdf(SAMPLE, { loadImage: makeImageLoader(null, async () => "") });
    const { markdown } = await pdfToMarkdown(buf(bytes));
    expect(markdown).toContain("# Handbook");
    expect(markdown).toContain("## Getting started");
    expect(markdown).toContain("Welcome to the team. Visit our site.");
    expect(markdown).toMatch(/Laptop/);
    expect(markdown).toContain("npm install");
  }, 30_000);

  it("flags characters the built-in font can't display", () => {
    expect(pdfExportUnsupportedText("Hello Ωμέγα Привет café — “quotes” ™ €")).toEqual([]);
    expect(pdfExportUnsupportedText("你 م 🚀 ✓")).toEqual(expect.arrayContaining(["你", "م", "🚀", "✓"]));
  });

  it("offers Print → Save as PDF for unsupported scripts, otherwise exports", async () => {
    const backend = setupBackend({ "/ws/zh.md": "# 你好", "/ws/en.md": "# Hello" });
    await openPath("/ws/zh.md");
    const answers = autoAnswer("cancel");
    await exportActiveAsPdf();
    answers.stop();
    expect(answers.titles).toEqual(["Some characters need a different PDF method"]);
    expect(backend.lastExport).toBeNull();

    await openPath("/ws/en.md");
    await exportActiveAsPdf();
    expect(backend.lastExport?.name).toBe("en.pdf");
    expect(atob(backend.lastExport!.content).slice(0, 5)).toBe("%PDF-");
  }, 30_000);
});

describe("alerts in PDF export", () => {
  it("writes the label instead of the [!WARNING] marker", async () => {
    const md = (await pdfToMarkdown((await markdownToPdf("> [!WARNING]\n> Mind the gap.")).buffer as ArrayBuffer)).markdown;
    expect(md).toContain("Warning");
    expect(md).toContain("Mind the gap.");
    expect(md).not.toContain("[!WARNING]");
  }, 20000);
});

describe("export a folder as one document", () => {
  it("combines the folder in memory and exports one PDF without writing a .md", async () => {
    const { useWorkspace } = await import("../src/stores/workspaceStore");
    const { exportFolder } = await import("../src/features/exporting");
    const backend = setupBackend({
      "/ws/README.md": "# Home\n\nStart with [the guide](guide.md).",
      "/ws/guide.md": "# Guide\n\nFollow these steps.",
    });
    useWorkspace.getState().setRoot("/ws");
    await exportFolder("pdf");
    expect(backend.lastExport?.name).toBe("ws.pdf");
    const bytes = Uint8Array.from(atob(backend.lastExport!.content), (c) => c.charCodeAt(0));
    const md = (await pdfToMarkdown(bytes.buffer as ArrayBuffer)).markdown;
    expect(md).toContain("Start with");
    expect(md).toContain("Follow these steps.");
    expect(md.indexOf("Home")).toBeLessThan(md.indexOf("Follow these steps."));
    expect(await backend.listWorkspaceFiles("/ws")).toEqual(expect.not.arrayContaining(["/ws/ws (combined).md"]));
  }, 30_000);

  it("doesn't offer Print for a folder with characters the PDF font lacks", async () => {
    const { useWorkspace } = await import("../src/stores/workspaceStore");
    const { useUi } = await import("../src/stores/uiStore");
    const { exportFolder } = await import("../src/features/exporting");
    const backend = setupBackend({ "/ws/a.md": "# 你好", "/ws/b.md": "# B" });
    useWorkspace.getState().setRoot("/ws");
    let buttons: string[] = [];
    const unsub = useUi.subscribe((s) => {
      const d = s.dialogs.at(-1);
      if (d && "buttons" in d && Array.isArray(d.buttons)) buttons = d.buttons.map((b: { id: string }) => b.id);
    });
    const answers = autoAnswer("cancel");
    await exportFolder("pdf");
    answers.stop();
    unsub();
    expect(answers.titles).toEqual(["Some characters need a different PDF method"]);
    expect(buttons).toEqual(["cancel", "anyway"]);
    expect(backend.lastExport).toBeNull();
  });
});

describe("footnotes in PDF export", () => {
  it("adds superscript numbers and a Footnotes section", async () => {
    const md = "A claim[^src] here.\n\n[^src]: The source of the claim.\n[^unused]: Not referenced.";
    const text = (await pdfToMarkdown((await markdownToPdf(md)).buffer as ArrayBuffer)).markdown;
    expect(text).toMatch(/claim\s*1\s*here/);
    expect(text).toContain("Footnotes");
    expect(text).toContain("The source of the claim.");
    expect(text).not.toContain("Not referenced");
    expect(text.indexOf("here")).toBeLessThan(text.indexOf("The source of the claim."));
  }, 30_000);
});

describe("Mermaid diagrams in PDF export", () => {
  it("draws diagrams as images, or keeps the code if they fail", async () => {
    const md = "```mermaid\ngraph TD\n  A --> B\n```";
    const png = Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));
    const withImage = await markdownToPdf(md, { renderDiagram: async () => ({ data: png, width: 300, height: 150 }) });
    expect(new TextDecoder("latin1").decode(withImage)).toMatch(/\/Subtype\s*\/Image/);
    expect((await pdfToMarkdown(withImage.buffer as ArrayBuffer)).markdown).not.toContain("graph TD");
    const fallback = await markdownToPdf(md, { renderDiagram: async () => null });
    expect((await pdfToMarkdown(fallback.buffer as ArrayBuffer)).markdown).toContain("graph TD");
  }, 30_000);
});

describe("SVG size", () => {
  it("reads the viewBox, or width and height", async () => {
    const { svgSize } = await import("../src/services/mermaid");
    expect(svgSize('<svg width="100%" viewBox="-8 -8 452.5 190" style="max-width: 452px;">')).toEqual({ width: 452.5, height: 190 });
    expect(svgSize('<svg width="120px" height="80">')).toEqual({ width: 120, height: 80 });
    expect(svgSize("<svg>")).toBeNull();
  });
});

describe("math in PDF export", () => {
  const md = "Inline $e^{i\\pi}$ and $A \\subset B$ here.\n\n$$\n\\int_0^1 x^2 \\, dx\n$$";

  it("draws display formulas as images and sets inline ones as text", async () => {
    const png = Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));
    const bytes = await markdownToPdf(md, { renderMath: async () => ({ data: png, width: 90, height: 40 }) });
    expect(new TextDecoder("latin1").decode(bytes)).toMatch(/\/Subtype\s*\/Image/);
    const text = (await pdfToMarkdown(bytes.buffer as ArrayBuffer)).markdown;
    expect(text).toContain("π");
    expect(text).not.toContain("$e^{i\\pi}$");
    // The font has no ⊂, so that formula keeps its source.
    expect(text).toContain("$A \\subset B$");
    expect(text).not.toContain("\\int_0^1");
  }, 30_000);

  it("keeps the LaTeX when a formula can't be drawn", async () => {
    const bytes = await markdownToPdf(md, { renderMath: async () => { throw new Error("SecurityError"); } });
    expect((await pdfToMarkdown(bytes.buffer as ArrayBuffer)).markdown).toContain("\\int_0^1");
  }, 30_000);
});

describe("emoji shortcodes in PDF export", () => {
  it("stay as text, because the PDF font has no emoji", async () => {
    const bytes = await markdownToPdf("Ship it :rocket:");
    expect((await pdfToMarkdown(bytes.buffer as ArrayBuffer)).markdown).toContain(":rocket:");
  }, 30_000);
});

describe("PDF export: links within the document", () => {
  it("makes #anchor links jump to the heading", async () => {
    const bytes = await markdownToPdf("# Guide\n\n- [Install](#install)\n- [Missing](#nowhere)\n\n## Install\n\ntext");
    const raw = Buffer.from(bytes).toString("latin1");
    // One internal link (to an existing heading), and the heading is a named destination.
    expect(raw.match(/\/GoTo/g)).toHaveLength(1);
    expect(raw).toContain("h-install");
  });
});
