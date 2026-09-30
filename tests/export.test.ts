import { describe, expect, it } from "vitest";
import { buildHtmlDocument, documentTitle, exportFileName, renderHtml } from "../src/services/exportHtml";
import { exportActiveAsHtml } from "../src/features/exporting";
import { openPath } from "../src/features/documents";
import { setupBackend } from "./helpers";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";

describe("HTML export", () => {
  it("renders GFM with highlighting and heading ids", async () => {
    const html = await renderHtml("# Hi\n\n| a |\n|---|\n| 1 |\n\n- [x] done\n\n```js\nconst a = 1;\n```");
    expect(html).toContain('<h1 id="hi">Hi</h1>');
    expect(html).toContain("<table>");
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
    expect(html).toContain('<span class="hljs-keyword">const</span>');
  });

  it("applies the same sanitization as the preview", async () => {
    const html = await renderHtml(
      ['<script>alert(1)</script>', '<img src="x.png" onerror="alert(1)">', "[x](javascript:alert(1))", "<iframe></iframe>"].join("\n\n"),
    );
    expect(html).not.toMatch(/<script|onerror|javascript:|<iframe/i);
  });

  it("inlines local images relative to the document", async () => {
    const seen: string[] = [];
    const html = await renderHtml("![logo](../img/logo.png) ![remote](https://x.y/a.png)", "/ws/docs/a.md", async (p) => {
      seen.push(p);
      return "data:image/png;base64,AAAA";
    });
    expect(seen).toEqual(["/ws/img/logo.png"]);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('src="https://x.y/a.png"');
  });

  it("builds a standalone document with title, styles and a restrictive CSP", async () => {
    const doc = await buildHtmlDocument({ markdown: "# My <Doc>\n\ntext", name: "notes.md", docPath: null });
    expect(doc).toMatch(/^<!doctype html>/);
    expect(doc).toContain("<title>My &lt;Doc&gt;</title>");
    expect(doc).toContain(".markdown-body");
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toMatch(/<script/i);
  });

  it("derives titles and file names", () => {
    expect(documentTitle("intro\n\n# Real Title #\n", "a.md")).toBe("Real Title");
    expect(documentTitle("no heading", "My Notes.md")).toBe("My Notes");
    expect(exportFileName("README.md", "html")).toBe("README.html");
    expect(exportFileName("notes.markdown", "html")).toBe("notes.html");
  });

  it("exports the active document through the backend", async () => {
    const backend = setupBackend({ "/ws/readme.md": "# Readme\n\nHello" });
    await openPath("/ws/readme.md");
    await exportActiveAsHtml();
    expect(backend.lastExport?.name).toBe("readme.html");
    expect(backend.lastExport?.content).toContain("<h1 id=\"readme\">Readme</h1>");
  });

  it("adds the custom CSS, scoped to the document, and can't end the style element", async () => {
    const backend = setupBackend({ "/ws/readme.md": "# Readme" });
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, customCss: 'h1 { color: rebeccapurple } p::after { content: "</style><script>x</script>" }' } });
    await openPath("/ws/readme.md");
    await exportActiveAsHtml();
    const html = backend.lastExport!.content;
    expect(html).toContain(".markdown-body h1 { color: rebeccapurple; }");
    expect(html).toContain("<\\/style><script>"); // inert text inside the CSS string
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
  });
});
