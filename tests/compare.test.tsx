import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompareDialog } from "../src/components/CompareDialog";
import { openPath } from "../src/features/documents";
import { useDocuments } from "../src/stores/documentsStore";
import { useUi } from "../src/stores/uiStore";
import { docs, setupBackend } from "./helpers";

describe("compare with file", () => {
  it("shows the differences between the document and another file", async () => {
    setupBackend({ "/ws/v1.md": "# Plan\n\nold step\nsame\n", "/ws/v2.md": "# Plan\n\nnew step\nsame\n" });
    const id = (await openPath("/ws/v2.md"))!;
    render(<CompareDialog />);
    act(() => useUi.getState().setCompare({ docId: id, path: "/ws/v1.md" }));
    expect(await screen.findByRole("dialog", { name: "Compare — v2.md and v1.md" })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".diff-del")?.textContent).toContain("old step"));
    expect(document.querySelector(".diff-add")?.textContent).toContain("new step");
    expect(screen.getByText(/1 only in v1\.md/)).toBeInTheDocument();

    // Unsaved edits in the document count.
    act(() => useDocuments.getState().setContent(id, "# Plan\n\nold step\nsame\n"));
    expect(await screen.findByText("The two documents are identical.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open v1.md" }));
    expect(useUi.getState().compare).toBeNull();
    await waitFor(() => expect(docs().map((d) => d.name)).toContain("v1.md"));
  });
});
