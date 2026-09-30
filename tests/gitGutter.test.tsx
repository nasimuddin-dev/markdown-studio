import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorState } from "@codemirror/state";
import { Editor } from "../src/components/Editor";
import { commands } from "../src/features/commands";
import { openPath } from "../src/features/documents";
import { getEditorView } from "../src/features/editorBridge";
import {
  changeHunks, changeMarkers, gitBaseOf, gitChangeGutter, nextChange, previousChange, refreshGitBase, revertChangeAtCursor, setGitBase,
} from "../src/features/gitGutter";
import { setBackend } from "../src/services";
import { MemoryBackend } from "../src/services/memoryBackend";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

const kinds = (base: string, current: string) => Object.fromEntries(changeMarkers(base, current) ?? []);

/** An editor state comparing `current` with `base`, the cursor on `line`. */
function stateFor(base: string, current: string, line = 1) {
  const state = EditorState.create({ doc: current, extensions: gitChangeGutter() });
  return state.update({ effects: setGitBase.of(base), selection: { anchor: state.doc.line(line).from } }).state;
}

function run(command: typeof nextChange, state: EditorState) {
  let next = state;
  const ok = command({ state, dispatch: (tr) => (next = tr.state) });
  return { ok, state: next, line: next.doc.lineAt(next.selection.main.head).number, text: next.doc.toString() };
}

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
    expect(changeHunks("a\nb\nc\nd", "a\nx\nd\ne")).toEqual([
      { start: 2, count: 1, old: ["b", "c"] },
      { start: 4, count: 1, old: [] },
    ]);
  });

  it("gives up on texts too different to compare quickly", () => {
    const many = (p: string) => Array.from({ length: 1500 }, (_, i) => `${p}${i}`).join("\n");
    expect(changeMarkers(many("a"), many("b"))).toBeNull();
  });

  it("reverts the change at the cursor to the committed lines", () => {
    const base = "a\nb\nc\nd";
    expect(run(revertChangeAtCursor, stateFor(base, "a\nB\nc\nd", 2)).text).toBe(base);
    expect(run(revertChangeAtCursor, stateFor(base, "a\nnew\nb\nc\nd", 2)).text).toBe(base);
    expect(run(revertChangeAtCursor, stateFor(base, "a\nb\nc\nd\nend", 5)).text).toBe(base);
    expect(run(revertChangeAtCursor, stateFor(base, "a\nd", 2)).text).toBe(base);
    expect(run(revertChangeAtCursor, stateFor(base, "a\nb\nc", 3)).text).toBe(base);
    // Only the change at the cursor; nothing on an unchanged line.
    expect(run(revertChangeAtCursor, stateFor(base, "A\nb\nc\nD", 4)).text).toBe("A\nb\nc\nd");
    expect(run(revertChangeAtCursor, stateFor(base, "A\nb\nc\nD", 2)).ok).toBe(false);
  });

  it("moves between changes, wrapping around", () => {
    const state = stateFor("a\nb\nc\nd\ne", "A\nb\nc\nD\ne", 1);
    expect(run(nextChange, state).line).toBe(4);
    expect(run(nextChange, run(nextChange, state).state).line).toBe(1);
    expect(run(previousChange, state).line).toBe(4);
    expect(run(nextChange, stateFor("a", "a")).ok).toBe(false);
  });

  it("loads the committed text for the document in the editor, draws the bars and reverts from the pop-up", async () => {
    setupBackend();
    setBackend(new MemoryBackend({ files: { "/ws/a.md": "# A\nchanged\nnew\n", "/ws/b.md": "b" }, approved: ["/ws"], gitHead: { "/ws/a.md": "# A\nold\n" } }));
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
    const { container } = render(<Editor />);
    await act(async () => {
      await openPath("/ws/a.md");
      await refreshGitBase();
    });
    const view = getEditorView()!;
    expect(gitBaseOf(view.state)).toBe("# A\nold\n");
    expect(container.querySelectorAll(".cm-git-modified")).toHaveLength(1);
    expect(container.querySelectorAll(".cm-git-added")).toHaveLength(1);
    expect(container.querySelector(".cm-git-added")?.getAttribute("title")).toMatch(/^Added since the last commit/);

    // Show Change at the cursor, then revert from the pop-up.
    act(() => view.dispatch({ selection: { anchor: view.state.doc.line(2).from } }));
    await act(async () => void commands.gitShowChange.run());
    const peek = await screen.findByRole("dialog", { name: "Change since the last commit" });
    expect(peek).toHaveTextContent("Before (1 line):");
    expect(peek.querySelector("pre")).toHaveTextContent("old");
    await userEvent.click(screen.getByRole("button", { name: "Revert Change" }));
    expect(view.state.doc.toString()).toBe("# A\nold\n");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector(".cm-git-change")).toBeNull();

    // Untracked files have no bars; neither does anything with Git status turned off.
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
