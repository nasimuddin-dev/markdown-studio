import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { newDocument } from "../src/features/documents";
import { useDocuments } from "../src/stores/documentsStore";
import { setupBackend } from "./helpers";

describe("App shell", () => {
  it("shows the welcome screen with core actions when nothing is open", () => {
    setupBackend();
    render(<App />);
    expect(screen.getByRole("heading", { name: "Markpion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New File/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open File/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open Folder/ }).length).toBeGreaterThan(0);
  });

  it("marks dirty tabs with text, not colour alone (§15)", async () => {
    setupBackend();
    render(<App />);
    let id = "";
    act(() => {
      id = newDocument();
    });
    const tab = screen.getByRole("tab", { name: /Untitled-1\.md/ });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).not.toHaveTextContent("(unsaved)");
    act(() => useDocuments.getState().setContent(id, "# changed"));
    expect(screen.getByRole("tab", { name: /Untitled-1\.md/ })).toHaveTextContent("(unsaved)");
    expect(screen.getByRole("status")).toHaveTextContent("Not saved");
  });

  it("opens menus from the keyboard-accessible menu bar", async () => {
    setupBackend();
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "File" }));
    const menu = screen.getByRole("menu", { name: "File" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Save As/ })).toBeDisabled();
  });
});
