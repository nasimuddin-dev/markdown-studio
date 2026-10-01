import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownView } from "../src/components/Preview";
import { previewBlockLine } from "../src/components/PreviewChunks";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

/** A long document with the things a section can't see on its own. */
function longDoc(): string {
  const parts = ["Intro with a [reference link][docs] before any heading.\n"];
  for (let i = 0; i < 60; i++) {
    parts.push(`# Chapter ${i % 7}

Text with [link ${i}][docs], a [missing][nowhere] one, **bold**, \`code\` and :tada:.

## Install

- [${i % 2 ? "x" : " "}] Task ${i}
- Item with [inline](https://example.com/${i})

\`\`\`md
# Not a heading in chapter ${i}
\`\`\`

<!-- a comment
# not a heading either
-->

| A | B |
| - | - |
| ${i} | x |

$$
x_${i} = 1
$$
`);
  }
  parts.push("[docs]: https://example.com/docs \"The docs\"\n");
  return parts.join("\n");
}

/** What matters in the rendered preview, independent of the chunk wrappers. */
function snapshot(root: HTMLElement) {
  const q = <T extends Element>(sel: string) => [...root.querySelectorAll<T>(sel)];
  return {
    headings: q<HTMLElement>("h1, h2, h3, h4, h5, h6").map((h) => `${h.tagName} #${h.id} ${h.textContent}`),
    links: q<HTMLAnchorElement>("a").map((a) => `${a.getAttribute("href")} ${a.textContent}`),
    lines: q<HTMLElement>("[data-line]:not(.pending)").map((e) => `${e.tagName}:${previewBlockLine(e)}`),
    tasks: q<HTMLInputElement>('input[type="checkbox"]').map((c) => c.defaultChecked),
    code: q<HTMLElement>("pre").map((p) => p.textContent),
    tables: q("table").length,
    math: q("math").length,
    // Whitespace aside (the section wrappers add a line break between sections).
    text: (root.textContent ?? "").replace(/\s+/g, ""),
  };
}

describe("sectioned preview of long documents", () => {
  it("renders exactly what the whole-document preview renders", () => {
    setupBackend();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
    const doc = longDoc();
    const whole = render(<MarkdownView text={doc} docPath={null} sectionAt={Infinity} />).container;
    // jsdom has no IntersectionObserver, so every section mounts right away.
    const sectioned = render(<MarkdownView text={doc} docPath={null} sectionAt={1000} />).container;
    expect(sectioned.querySelectorAll(".preview-chunk").length).toBeGreaterThan(1);
    const a = snapshot(whole);
    const b = snapshot(sectioned);
    expect(b.headings).toEqual(a.headings);
    // Ids are numbered across the document, as GitHub does.
    expect(a.headings).toContain("H2 #install-59 Install");
    expect(b.links).toEqual(a.links);
    expect(a.links.filter((l) => l.startsWith("https://example.com/docs ")).length).toBe(61);
    expect(b.tasks).toEqual(a.tasks);
    expect(b.code).toEqual(a.code);
    expect(b.tables).toBe(a.tables);
    expect(b.math).toBe(a.math);
    expect(b.text).toBe(a.text);
    // Source lines for scroll sync: the same blocks start on the same lines.
    expect(b.lines).toEqual(a.lines);
  });

  it("keeps the single pass for documents with footnotes", () => {
    setupBackend();
    const doc = longDoc() + "\nA note.[^1]\n\n[^1]: The footnote.\n";
    const view = render(<MarkdownView text={doc} docPath={null} sectionAt={1000} />).container;
    expect(view.querySelectorAll("section[data-footnotes]").length).toBe(1);
  });
});

describe("editing a long document", () => {
  it("re-parses only the section that changed, and later sections still report the right lines", async () => {
    vi.resetModules();
    let parses = 0;
    vi.doMock("../src/services/sourceLines", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/services/sourceLines")>();
      return {
        ...actual,
        rehypeSourceLines: (options?: { offset?: number }) => {
          parses++;
          return actual.rehypeSourceLines(options);
        },
      };
    });
    const { MarkdownView: View } = await import("../src/components/Preview");
    const { previewBlockLine: lineOf } = await import("../src/components/PreviewChunks");
    setupBackend();
    const doc = longDoc();
    const { container, rerender } = render(<View text={doc} docPath={null} sectionAt={1000} />);
    const sections = container.querySelectorAll(".preview-chunk").length;
    expect(parses).toBe(sections);
    const lastHeading = () => [...container.querySelectorAll<HTMLElement>("h1")].at(-1)!;
    const before = lineOf(lastHeading());

    // A line added at the top: only the first section is parsed again.
    parses = 0;
    rerender(<View text={"An added first line.\n" + doc} docPath={null} sectionAt={1000} />);
    expect(parses).toBe(1);
    expect(lineOf(lastHeading())).toBe(before + 1);
    vi.doUnmock("../src/services/sourceLines");
  });
});
