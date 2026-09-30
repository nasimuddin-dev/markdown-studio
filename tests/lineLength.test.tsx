import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Editor } from "../src/components/Editor";
import { newDocument } from "../src/features/documents";
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

describe("editor line length", () => {
  it("keeps only the offered lengths", () => {
    expect(sanitizeSettings({ editorLineLength: 100 }).editorLineLength).toBe(100);
    expect(sanitizeSettings({ editorLineLength: 90 }).editorLineLength).toBe(0);
    expect(sanitizeSettings({ editorLineLength: "80" }).editorLineLength).toBe(0);
    expect(DEFAULT_SETTINGS.editorLineLength).toBe(0);
  });

  it("centers the text when set, and uses the full width when not", async () => {
    setupBackend();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
    const { container } = render(<Editor />);
    act(() => {
      newDocument("text");
    });
    await screen.findByRole("textbox", { name: "Markdown editor" });
    // jsdom can't compute calc(), so look for the rule CodeMirror adds.
    const styles = () => [...document.querySelectorAll("style")].map((el) => el.textContent).join(" ");
    expect(container.querySelector(".cm-scroller")).toBeTruthy();
    expect(styles()).not.toContain("88ch");
    act(() => useSettings.getState().update({ editorLineLength: 80 }));
    expect(styles()).toContain("padding-inline: max(0px, calc((100% - 88ch) / 2))");
  });
});
