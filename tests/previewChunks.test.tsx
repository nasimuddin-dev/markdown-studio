import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Preview } from "../src/components/Preview";
import { CHUNK_MIN_BLOCKS, estimateHeight } from "../src/components/PreviewChunks";
import { newDocument } from "../src/features/documents";
import { activeDoc } from "../src/stores/documentsStore";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

/** A document with `n` sections (two top-level blocks each) and a task list at the start and the end. */
function longDocument(n: number) {
  const sections = Array.from({ length: n }, (_, i) => `## Section ${i}\n\nParagraph ${i}.`);
  return `- [ ] first\n- [ ] second\n\n${sections.join("\n\n")}\n\n- [ ] last one\n`;
}

describe("chunked preview for long documents", () => {
  it("estimates placeholder heights from the source", () => {
    expect(estimateHeight("one line", 1)).toBe(30);
    expect(estimateHeight("x".repeat(250), 1)).toBe(3 * 18 + 12);
  });

  it("splits a long document into chunks, and a task in a later chunk toggles the right line", async () => {
    setupBackend();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, previewDebounceMs: 0 } });
    const { container } = render(<Preview />);
    act(() => {
      newDocument(longDocument(200));
    });
    await screen.findByText("Section 199");
    const chunks = [...container.querySelectorAll<HTMLElement>(".preview-chunk")];
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].dataset.tasksBefore).toBe("0");
    expect(chunks.at(-1)!.dataset.tasksBefore).toBe("2");
    fireEvent.click(screen.getAllByRole("checkbox").at(-1)!);
    expect(activeDoc()!.content).toContain("- [x] last one");
    expect(activeDoc()!.content).toContain("- [ ] first\n- [ ] second");
  });

  it("renders short documents without chunks", async () => {
    setupBackend();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, previewDebounceMs: 0 } });
    const { container } = render(<Preview />);
    act(() => {
      newDocument(longDocument(CHUNK_MIN_BLOCKS / 4));
    });
    await screen.findByText("Section 0");
    expect(container.querySelector(".preview-chunk")).toBeNull();
  });
});
