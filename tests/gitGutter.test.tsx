import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { Editor } from "../src/components/Editor";
import { openPath } from "../src/features/documents";
import { getEditorView } from "../src/features/editorBridge";
import { changeMarkers, gitBaseOf, refreshGitBase } from "../src/features/gitGutter";
import { setBackend } from "../src/services";
import { MemoryBackend } from "../src/services/memoryBackend";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

const kinds = (base: string, current: string) => Object.fromEntries(changeMarkers(base, current) ?? []);

describe("Git change markers", () => {
  it("marks added, changed and deleted lines", () => {
    expect(kinds("a\nb\nc", "a\nb\nc")).toEqual({});
    expect(kinds("a\nb\nc", "a\nnew\nb\nc")).toEqual({ 2: "added" });
    expect(kinds("a\nb\nc", "a\nB\nc")).toEqual({ 2: "modified" });
    // A deletion shows on the line after it, or on the last line at the end.
    expect(kinds("a\nb\nc", "a\nc")).toEqual({ 2: "deleted" });
    expect(kinds("a\nb\nc", "a\nb")).toEqual({ 2: "deleted" });
    // Replacing one line with two: one changed, one added; two with one: one changed.
    expect(kinds("a\nb\nc", "a\nx\ny\nc")).toEqual({ 2: "modified", 3: "added" });
    expect(kinds("a\nb\nc\nd", "a\nx\nd")).toEqual({ 2: "modified" });
    expect(kinds("", "one\ntwo")).toEqual({ 1: "modified", 2: "added" });
  });

  it("gives up on texts too different to compare quickly", () => {
    const many = (p: string) => Array.from({ length: 1500 }, (_, i) => `${p}${i}`).join("\n");
    expect(changeMarkers(many("a"), many("b"))).toBeNull();
  });

  it("loads the committed text for the document in the editor and draws the markers", async () => {
    setupBackend();
    setBackend(new MemoryBackend({ files: { "/ws/a.md": "# A\nchanged\nnew\n", "/ws/b.md": "b" }, approved: ["/ws"], gitHead: { "/ws/a.md": "# A\nold\n" } }));
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
    const { container } = render(<Editor />);
    await act(async () => {
      await openPath("/ws/a.md");
      await refreshGitBase();
    });
    expect(gitBaseOf(getEditorView()!.state)).toBe("# A\nold\n");
    expect(container.querySelectorAll(".cm-git-modified")).toHaveLength(1);
    expect(container.querySelectorAll(".cm-git-added")).toHaveLength(1);
    expect(container.querySelector(".cm-git-added")).toHaveAttribute("title", "Added since the last commit");

    // Untracked files have no markers; neither does anything with Git status turned off.
    await act(async () => {
      await openPath("/ws/b.md");
      await refreshGitBase();
    });
    expect(gitBaseOf(getEditorView()!.state)).toBeNull();
    expect(container.querySelector(".cm-git-change")).toBeNull();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, showGitStatus: false } });
    await act(async () => {
      await openPath("/ws/a.md");
      await refreshGitBase();
    });
    expect(gitBaseOf(getEditorView()!.state)).toBeNull();
  });
});
