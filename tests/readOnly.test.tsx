import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "../src/components/Editor";
import { ChangeBanner } from "../src/components/ChangeBanner";
import { commands } from "../src/features/commands";
import { openPath, reloadDocument, saveDocument } from "../src/features/documents";
import { getEditorView } from "../src/features/editorBridge";
import { setBackend } from "../src/services";
import { MemoryBackend } from "../src/services/memoryBackend";
import { useDocuments } from "../src/stores/documentsStore";
import { autoAnswer, docs, setupBackend } from "./helpers";

function setup() {
  setupBackend();
  const backend = new MemoryBackend({ files: { "/ws/locked.md": "locked text", "/ws/free.md": "free text" }, approved: ["/ws"], readOnly: ["/ws/locked.md"] });
  setBackend(backend);
  return backend;
}

describe("read-only documents", () => {
  it("opens a read-only file locked, with a banner to edit anyway", async () => {
    setup();
    render(
      <>
        <ChangeBanner />
        <Editor />
      </>,
    );
    const id = (await act(() => openPath("/ws/locked.md")))!;
    expect(docs()[0].readOnly).toBe("file");
    expect(screen.getByRole("status")).toHaveTextContent("is read-only on disk");

    // Commands can't change the text, and neither can other features writing to the store.
    const view = getEditorView()!;
    act(() => {
      view.dispatch({ selection: { anchor: 0, head: 6 } });
      void commands.bold.run();
    });
    expect(view.state.doc.toString()).toBe("locked text");
    act(() => useDocuments.getState().setContent(id, "changed"));
    expect(docs()[0].content).toBe("locked text");

    await userEvent.click(screen.getByRole("button", { name: "Edit Anyway" }));
    expect(docs()[0].readOnly).toBeUndefined();
    expect(screen.queryByRole("status")).toBeNull();
    act(() => {
      view.dispatch({ selection: { anchor: 0, head: 6 } });
      void commands.bold.run();
    });
    expect(docs()[0].content).toBe("**locked** text");

    // Saving still fails (the file is read-only) and offers Save As; reloading locks it again.
    const answered = autoAnswer("cancel");
    expect(await act(() => saveDocument(id))).toBe(false);
    answered.stop();
    expect(answered.titles).toEqual(["Couldn't save"]);
    await act(() => reloadDocument(id));
    expect(docs()[0].readOnly).toBe("file");
  });

  it("toggles read-only for any document", async () => {
    setup();
    render(<ChangeBanner />);
    await act(() => openPath("/ws/free.md"));
    expect(docs()[0].readOnly).toBeUndefined();
    act(() => void commands.toggleReadOnly.run());
    expect(docs()[0].readOnly).toBe("user");
    expect(screen.getByRole("status")).toHaveTextContent("Toggle Read-Only");
    await userEvent.click(screen.getByRole("button", { name: "Allow Editing" }));
    expect(docs()[0].readOnly).toBeUndefined();
  });
});
