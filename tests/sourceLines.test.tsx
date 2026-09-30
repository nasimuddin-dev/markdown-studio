import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Preview } from "../src/components/Preview";
import { newDocument } from "../src/features/documents";
import { lineForTop, topForLine, type LineAnchor } from "../src/services/sourceLines";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

const anchors: LineAnchor[] = [
  { line: 3, top: 100 },
  { line: 5, top: 300 },
  { line: 10, top: 400 },
  { line: 21, top: 1000 }, // the end of the document
];
const at = (i: number) => anchors[i];

describe("mapping source lines to preview positions", () => {
  it("interpolates between the blocks around a line", () => {
    expect(topForLine(anchors.length, at, 3)).toBe(100);
    expect(topForLine(anchors.length, at, 4)).toBe(200);
    expect(topForLine(anchors.length, at, 7.5)).toBe(350);
    // Before the first block: between the top of the document and it.
    expect(topForLine(anchors.length, at, 2)).toBe(50);
    // At or past the end.
    expect(topForLine(anchors.length, at, 30)).toBe(1000);
  });

  it("maps positions back to lines", () => {
    expect(lineForTop(anchors.length, at, 200)).toBe(4);
    expect(lineForTop(anchors.length, at, 350)).toBe(7.5);
    expect(lineForTop(anchors.length, at, 50)).toBe(2);
    expect(lineForTop(anchors.length, at, 5000)).toBe(21);
    for (const line of [1.5, 3, 6.25, 12]) expect(lineForTop(anchors.length, at, topForLine(anchors.length, at, line)!)).toBeCloseTo(line);
  });

  it("has nothing to map without blocks", () => {
    expect(topForLine(0, at, 3)).toBeNull();
    expect(lineForTop(0, at, 3)).toBeNull();
  });
});

describe("source lines in the preview", () => {
  it("marks each top-level block with the line it starts on, after front matter too", async () => {
    setupBackend();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, previewDebounceMs: 0 } });
    const { container } = render(<Preview />);
    act(() => {
      newDocument("---\ntitle: T\n---\n# Title\n\nText.\n\n```js\nlet x;\n```\n\n- a\n- b\n");
    });
    await screen.findByText("Text.");
    const lines = [...container.querySelectorAll<HTMLElement>("article > [data-line]")].map((el) => `${el.tagName.toLowerCase()}${el.className ? "." + el.className : ""}:${el.dataset.line}`);
    expect(lines).toEqual(["h1:4", "p:6", "div.code-block:8", "ul:12"]);
    // Nested elements aren't marked, and the article knows the document's length.
    expect(container.querySelectorAll("li[data-line], pre[data-line]")).toHaveLength(0);
    expect(container.querySelector<HTMLElement>("article")!.dataset.lines).toBe("14");
  });
});
