import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiPanel } from "../src/components/AiPanel";
import { useAi } from "../src/stores/aiStore";

describe("AI review: what would change", () => {
  it("shows the changed words for a replacement, and the original on request", async () => {
    render(<AiPanel />);
    act(() =>
      useAi.getState().setReview({ docId: "d", label: "Fix Grammar", original: "Their going home tomorow.", suggestion: "They're going home tomorrow.", from: 0, to: 25, placement: "replace" }),
    );
    const changes = await screen.findByRole("region", { name: "Changes" });
    expect([...changes.querySelectorAll(".diff-word")].map((m) => m.textContent)).toEqual(["Their", "tomorow", "They're", "tomorrow"]);
    await userEvent.click(screen.getByRole("button", { name: "Original" }));
    expect(screen.queryByRole("region", { name: "Changes" })).toBeNull();
    expect(screen.getByText("Their going home tomorow.")).toBeTruthy();
    act(() => useAi.getState().setReview(null));
  });

  it("shows only the original for text that goes below it", async () => {
    render(<AiPanel />);
    act(() => useAi.getState().setReview({ docId: "d", label: "Summarize", original: "Long text.", suggestion: "Short.", from: 0, to: 10, placement: "below" }));
    expect(await screen.findByText("Long text.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Changes" })).toBeNull();
    act(() => useAi.getState().setReview(null));
  });
});
