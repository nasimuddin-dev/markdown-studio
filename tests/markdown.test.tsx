import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import { renderToStaticMarkup } from "react-dom/server";
import rehypeRaw from "rehype-raw";
import { classifyLink, countWords, markdownPlugins, rehypePlugins, remarkPlugins } from "../src/services/markdown";

function renderMd(md: string) {
  const { container } = render(
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {md}
    </ReactMarkdown>,
  );
  return container;
}

describe("GitHub Flavored Markdown rendering (FR-032, §17.2)", () => {
  it("renders headings, lists, tables, task lists, links, images and code", () => {
    const el = renderMd(
      [
        "# Title",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "",
        "| a | b |",
        "|---|:-:|",
        "| 1 | 2 |",
        "",
        "- [x] done",
        "- [ ] todo",
        "",
        "~~gone~~ https://example.com [link](https://tauri.app)",
        "",
        "![alt](https://example.com/a.png)",
        "",
        "```js",
        "const x = 1;",
        "```",
      ].join("\n"),
    );
    expect(el.querySelector("h1")?.id).toBe("title");
    expect(el.querySelectorAll("ul li").length).toBeGreaterThanOrEqual(4);
    expect(el.querySelector("ol li")?.textContent).toBe("first");
    expect(el.querySelectorAll("table td")).toHaveLength(2);
    const boxes = el.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect([...boxes].map((b) => b.checked)).toEqual([true, false]);
    expect([...boxes].every((b) => b.disabled)).toBe(true);
    expect(el.querySelector("del")?.textContent).toBe("gone");
    expect([...el.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "https://example.com",
      "https://tauri.app",
    ]);
    expect(el.querySelector("img")?.getAttribute("src")).toBe("https://example.com/a.png");
    // Syntax highlighting (FR-033)
    expect(el.querySelector("pre code.hljs .hljs-keyword")?.textContent).toBe("const");
  });

  it("keeps Unicode intact (FR-026)", () => {
    expect(renderMd("héllo 世界 🚀").textContent).toBe("héllo 世界 🚀");
  });
});

describe("preview sanitization (FR-034, SEC-004)", () => {
  it.each([
    ["script tags", "<script>window.pwned = 1</script>", "script"],
    ["iframes", '<iframe src="https://evil.example"></iframe>', "iframe"],
    ["objects", '<object data="x.swf"></object>', "object"],
    ["forms", '<form action="https://evil.example"><input name="x"></form>', "form"],
    ["style tags", "<style>body{display:none}</style>", "style"],
  ])("removes %s", (_name, html, tag) => {
    const el = renderMd(`text\n\n${html}\n`);
    expect(el.querySelector(tag)).toBeNull();
  });

  it("removes event handler attributes", () => {
    const el = renderMd('<img src="https://x.test/a.png" onerror="alert(1)"><div onclick="alert(1)">x</div>');
    const withHandlers = [...el.querySelectorAll("*")].filter((n) =>
      [...n.attributes].some((a) => a.name.toLowerCase().startsWith("on")),
    );
    expect(withHandlers).toHaveLength(0);
  });

  it("strips javascript: and data: links", () => {
    const el = renderMd("[a](javascript:alert(1)) [b](data:text/html,<script>alert(1)</script>) <a href=\"javascript:alert(1)\">c</a>");
    for (const a of el.querySelectorAll("a")) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/^(javascript|data):/i);
    }
  });

  it("keeps safe HTML such as details and kbd", () => {
    const el = renderMd("<details><summary>More</summary>\n\nPress <kbd>Ctrl</kbd>\n\n</details>");
    expect(el.querySelector("details summary")?.textContent).toBe("More");
    expect(el.querySelector("kbd")?.textContent).toBe("Ctrl");
  });
});

describe("link handling (SEC-005)", () => {
  it("classifies links", () => {
    expect(classifyLink("#intro")).toEqual({ type: "anchor", id: "intro" });
    expect(classifyLink("https://a.b")).toEqual({ type: "external", url: "https://a.b" });
    expect(classifyLink("mailto:x@y.z")).toEqual({ type: "external", url: "mailto:x@y.z" });
    expect(classifyLink("docs/guide.md")).toEqual({ type: "document", href: "docs/guide.md" });
    expect(classifyLink("C:\\notes\\a.md")).toEqual({ type: "document", href: "C:\\notes\\a.md" });
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "vscode://x", "data:text/html,x", "", null]) {
      expect(classifyLink(bad).type).toBe("blocked");
    }
  });
});

describe("countWords", () => {
  it("counts words across scripts", () => {
    expect(countWords("Hello, world! It's 2026 — café")).toBe(5);
    expect(countWords("")).toBe(0);
  });
});

describe("raw HTML parsing is skipped when there's no HTML (performance)", () => {
  const html = (md: string, plugins: { remarkPlugins: unknown[]; rehypePlugins: unknown[] }) =>
    renderToStaticMarkup(<ReactMarkdown remarkPlugins={plugins.remarkPlugins as never} rehypePlugins={plugins.rehypePlugins as never}>{md}</ReactMarkdown>);
  const withRaw = () => {
    const p = markdownPlugins({ math: true });
    return { remarkPlugins: p.remarkPlugins, rehypePlugins: [rehypeRaw, ...p.rehypePlugins.slice(1)] };
  };

  it("renders the same HTML as with rehype-raw for documents without HTML", () => {
    const md = [
      "# Title", "", "Some **bold**, *italic*, `code`, ~~gone~~ and a [link](https://example.com) or https://auto.link.", "",
      "> [!NOTE]", "> An alert.", "", "- [x] done", "- [ ] open", "", "| a | b |", "|---|---:|", "| 1 | 2 |", "",
      "```js", "const x = 1 < 2;", "```", "", "Math $x^2$ and", "", "$$", String.raw`\int_0^1 x`, "$$", "", "Footnote[^1].", "", "[^1]: The note.",
    ].join("\n");
    // Only insignificant differences are allowed: blank text between blocks,
    // and boolean data attributes written as "" instead of "true".
    const normalize = (h: string) => h.replace(/>\s+</g, "><").replace(/(data-footnote[\w-]*)="(?:true)?"/g, "$1");
    expect(normalize(html(md, markdownPlugins({ math: true })))).toBe(normalize(html(md, withRaw())));
  });

  it("still parses inline and block HTML, and still sanitizes it", () => {
    const out = html("Press <kbd>Ctrl</kbd>.\n\n<details><summary>More</summary>\n\nHidden\n\n</details>\n\n<script>alert(1)</script>", markdownPlugins({ math: true }));
    expect(out).toContain("<kbd>Ctrl</kbd>");
    expect(out).toContain("<details>");
    expect(out).not.toContain("<script");
  });
});
