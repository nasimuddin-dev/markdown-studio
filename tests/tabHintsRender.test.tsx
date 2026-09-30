import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabBar } from "../src/components/TabBar";
import { openPath } from "../src/features/documents";
import { setupBackend } from "./helpers";

describe("tabs for files with the same name", () => {
  it("show the folder that tells them apart", async () => {
    setupBackend({ "/ws/docs/README.md": "a", "/ws/notes/README.md": "b", "/ws/other.md": "c" });
    await openPath("/ws/docs/README.md");
    await openPath("/ws/notes/README.md");
    await openPath("/ws/other.md");
    render(<TabBar />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["README.md in docs", "README.md in notes", "other.md"]);
  });
});
