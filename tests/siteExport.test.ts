import { describe, expect, it } from "vitest";
import { addSiteNav, exportFolderAsHtmlSite, planSite, rewriteMarkdownLinks, siteIndexMarkdown } from "../src/features/siteExport";
import { useWorkspace } from "../src/stores/workspaceStore";
import { useUi } from "../src/stores/uiStore";
import { autoAnswer, setupBackend } from "./helpers";

describe("HTML site plan", () => {
  it("mirrors the folder, README first, and skips other files", () => {
    const pages = planSite(["/ws/guide/setup.md", "/ws/README.md", "/ws/notes.markdown", "/ws/img/logo.png", "/other/x.md"], "/ws");
    expect(pages.map((p) => p.href)).toEqual(["README.html", "notes.html", "guide/setup.html"]);
  });

  it("points links to Markdown files at the HTML pages", () => {
    const html = [
      '<a href="guide/setup.md#install">a</a>',
      '<a href="../README.md">b</a>',
      '<a href="notes.markdown?x=1">c</a>',
      '<a href="https://github.com/x/README.md">d</a>',
      '<a href="#readme.md">e</a>',
      '<a href="data.csv">f</a>',
      '<a title="t" href="My%20Doc.MD">g</a>',
    ].join("");
    expect(rewriteMarkdownLinks(html)).toBe(
      [
        '<a href="guide/setup.html#install">a</a>',
        '<a href="../README.html">b</a>',
        '<a href="notes.html?x=1">c</a>',
        '<a href="https://github.com/x/README.md">d</a>',
        '<a href="#readme.md">e</a>',
        '<a href="data.csv">f</a>',
        '<a title="t" href="My%20Doc.html">g</a>',
      ].join(""),
    );
  });

  it("links each page back to the contents at the right depth", () => {
    expect(addSiteNav("<body>\n<p>x</p>", 0)).toContain('<a href="index.html">← Contents</a>');
    expect(addSiteNav("<body>\n<p>x</p>", 2)).toContain('<a href="../../index.html">← Contents</a>');
  });

  it("lists pages by folder on the contents page", () => {
    const md = siteIndexMarkdown("Handbook", [
      { source: "/ws/README.md", href: "README.html", title: "Welcome" },
      { source: "/ws/guide/a b.md", href: "guide/a b.html", title: "Setup [beta]" },
    ]);
    expect(md).toBe("# Handbook\n\n- [Welcome](README.html)\n\n## guide\n\n- [Setup \\[beta\\]](guide/a%20b.html)\n");
  });
});

describe("Export Folder as HTML Site", () => {
  it("writes a page per document, an index and working links", async () => {
    const backend = setupBackend(
      {
        "/ws/README.md": "# Handbook\n\nSee [setup](guide/setup.md#install).",
        "/ws/guide/setup.md": "# Setup\n\n## Install\n\nBack to [home](../README.md).",
      },
      ["/site"],
    );
    useWorkspace.getState().setRoot("/ws");
    await exportFolderAsHtmlSite();
    const readme = (await backend.readTextFile("/site/README.html")).content;
    expect(readme).toContain('href="guide/setup.html#install"');
    expect(readme).toContain('<a href="index.html">← Contents</a>');
    const setup = (await backend.readTextFile("/site/guide/setup.html")).content;
    expect(setup).toContain('href="../README.html"');
    expect(setup).toContain('<a href="../index.html">← Contents</a>');
    const index = (await backend.readTextFile("/site/index.html")).content;
    expect(index).toContain('<a href="README.html">Handbook</a>');
    expect(index).toContain('<a href="guide/setup.html">Setup</a>');
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/Exported 2 pages/);
  });

  it("asks before replacing existing files, and stops on Cancel", async () => {
    const backend = setupBackend({ "/ws/a.md": "# A", "/site/a.html": "old" }, ["/site"]);
    useWorkspace.getState().setRoot("/ws");
    const answered = autoAnswer("cancel");
    await exportFolderAsHtmlSite();
    answered.stop();
    expect(answered.titles).toEqual(["Replace existing files?"]);
    expect((await backend.readTextFile("/site/a.html")).content).toBe("old");
  });
});
