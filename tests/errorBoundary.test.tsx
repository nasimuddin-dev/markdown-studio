import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { setupBackend } from "./helpers";

// A preview that fails for documents containing "boom".
vi.mock("../src/components/Preview", async () => {
  const { useDocuments } = await import("../src/stores/documentsStore");
  return {
    Preview: () => {
      const doc = useDocuments((s) => s.docs.find((d) => d.id === s.activeId));
      if (doc?.content.includes("boom")) throw new Error("preview exploded");
      return <div>preview ok</div>;
    },
  };
});

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error("kaboom");
  return <p>fine</p>;
}

describe("ErrorBoundary", () => {
  it("shows a message instead of the failed area, logs it, and retries", async () => {
    const backend = setupBackend();
    const log = vi.spyOn(backend, "log");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    let setExplode: (v: boolean) => void = () => {};
    function Host() {
      const [explode, set] = useState(true);
      setExplode = set;
      return (
        <ErrorBoundary area="outline">
          <Bomb explode={explode} />
        </ErrorBoundary>
      );
    }
    render(<Host />);
    expect(screen.getByRole("alert")).toHaveTextContent("The outline couldn't be shown");
    expect(screen.getByRole("alert")).toHaveTextContent("kaboom");
    expect(log).toHaveBeenCalledWith("error", "ui.crash.outline", expect.stringContaining("kaboom"));
    act(() => setExplode(false));
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.getByText("fine")).toBeInTheDocument();
    quiet.mockRestore();
  });

  it("tries again by itself when its reset key changes", () => {
    setupBackend();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary area="preview" resetKey="a">
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(
      <ErrorBoundary area="preview" resetKey="b">
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
    quiet.mockRestore();
  });
});

describe("a failing preview doesn't take down the window", () => {
  it("keeps the editor and tabs working, and recovers when the text changes", async () => {
    setupBackend();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: App } = await import("../src/App");
    const { newDocument } = await import("../src/features/documents");
    const { useDocuments } = await import("../src/stores/documentsStore");
    render(<App />);
    let id = "";
    act(() => {
      id = newDocument("# boom");
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The preview couldn't be shown");
    expect(alert).toHaveTextContent("preview exploded");
    expect(screen.getByRole("textbox", { name: "Markdown editor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Untitled-1\.md/ })).toBeInTheDocument();
    act(() => useDocuments.getState().setContent(id, "# fixed"));
    expect(await screen.findByText("preview ok")).toBeInTheDocument();
    quiet.mockRestore();
  });
});
