import { afterEach, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import { registerEditorView, rememberFocus } from "../src/features/editorBridge";

describe("rememberFocus", () => {
  let view: EditorView;
  const setup = () => {
    document.body.innerHTML = "";
    view = new EditorView({ doc: "text", parent: document.body });
    registerEditorView(view);
  };
  afterEach(() => {
    view?.destroy();
    registerEditorView(null);
  });

  it("gives focus back to what had it", () => {
    setup();
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    const restore = rememberFocus();
    document.body.appendChild(document.createElement("input")).focus();
    restore();
    expect(document.activeElement).toBe(button);
  });

  it("returns to the editor when nothing had focus (a menu closed before a dialog loaded)", () => {
    setup();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    const restore = rememberFocus();
    restore();
    expect(view.hasFocus).toBe(true);
  });

  it("returns to the editor when the element that had focus has gone", () => {
    setup();
    const item = document.body.appendChild(document.createElement("button"));
    item.focus();
    const restore = rememberFocus();
    item.remove();
    restore();
    expect(view.hasFocus).toBe(true);
  });
});
