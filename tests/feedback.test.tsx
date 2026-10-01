import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emailUrl, feedbackReport, issueUrl, technicalDetails } from "../src/services/feedback";
import { clearRecentErrors, recentErrors, recordError } from "../src/features/errorReports";
import { FeedbackDialog } from "../src/components/FeedbackDialog";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { Toasts } from "../src/components/Dialogs";
import { useUi } from "../src/stores/uiStore";
import { backend } from "../src/services";

afterEach(() => {
  useUi.setState({ feedback: null, toasts: [] });
  clearRecentErrors();
  vi.restoreAllMocks();
});

describe("feedback reports", () => {
  it("builds a titled report with technical details only when included", () => {
    const report = feedbackReport({ kind: "design", summary: " Menus are too long ", details: "Export has 11 items.", technical: "Markpion 0.25.0" });
    expect(report.title).toBe("[Design] Menus are too long");
    expect(report.body).toContain("Export has 11 items.");
    expect(report.body).toContain("### Technical details\n\n```text\nMarkpion 0.25.0\n```");
    expect(feedbackReport({ kind: "suggestion", summary: "x", details: "" }).body).not.toContain("Technical details");
  });

  it("lists the version, the system and recent errors with the top of their stack", () => {
    const text = technicalDetails({ version: "0.25.0", os: "windows", arch: "x86_64" }, [{ message: "boom", area: "preview", stack: "Error: boom\n at a\n at b\n at c\n at d\n at e\n at f\n at g", time: "2026-10-01T12:00:00Z" }]);
    expect(text).toContain("Markpion 0.25.0\nSystem: windows (x86_64)");
    expect(text).toContain("Error in the preview at 2026-10-01T12:00:00Z: boom");
    expect(text).toContain("    at e");
    expect(text).not.toContain("at f");
  });

  it("makes a GitHub new-issue link, shortened when the text is too long", () => {
    const short = issueUrl("[Problem] It broke", "Steps: open a file.");
    expect(short.shortened).toBe(false);
    const url = new URL(short.url);
    expect(url.origin + url.pathname).toBe("https://github.com/nasimuddin-dev/markpion/issues/new");
    expect(url.searchParams.get("title")).toBe("[Problem] It broke");
    expect(url.searchParams.get("body")).toBe("Steps: open a file.");
    const long = issueUrl("t", "x".repeat(20_000));
    expect(long.shortened).toBe(true);
    expect(long.url.length).toBeLessThanOrEqual(7500);
    expect(new URL(long.url).searchParams.get("body")).toMatch(/Shortened to fit/);
  });

  it("makes an email link to the feedback address, with spaces encoded for mail apps, shortened to fit", () => {
    const { url, shortened } = emailUrl("[Problem] It broke", "Line one\nA & B + C");
    expect(shortened).toBe(false);
    expect(url).toBe("mailto:nasim.uddinbd02@gmail.com?subject=Markpion%3A%20%5BProblem%5D%20It%20broke&body=Line%20one%0AA%20%26%20B%20%2B%20C");
    const long = emailUrl("t", "word ".repeat(2000));
    expect(long.shortened).toBe(true);
    expect(long.url.length).toBeLessThanOrEqual(1900);
    expect(decodeURIComponent(long.url)).toMatch(/Shortened to fit in an email link/);
  });

  it("keeps only the last five errors", () => {
    for (let i = 1; i <= 7; i++) recordError(new Error(`error ${i}`), "test");
    expect(recentErrors().map((e) => e.message)).toEqual(["error 3", "error 4", "error 5", "error 6", "error 7"]);
  });
});

describe("Send Feedback dialog", () => {
  it("opens the report on GitHub in the browser, with the technical details only when ticked", async () => {
    const open = vi.spyOn(backend(), "openExternal").mockResolvedValue();
    useUi.getState().openFeedback({ kind: "suggestion" });
    render(<FeedbackDialog />);
    const send = screen.getByRole("button", { name: "Open on GitHub" });
    // Without a summary the button says what's missing (it doesn't silently do nothing).
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(screen.getByRole("alert")).toHaveTextContent("Write a short summary first.");
    expect(screen.getByLabelText("Summary")).toHaveFocus();
    expect(screen.getByLabelText("Summary")).toHaveAttribute("aria-invalid", "true");
    expect(open).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Word count per section" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "In the outline." } });
    expect(screen.queryByLabelText("Technical details")).toBeNull();
    fireEvent.click(send);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    const url = new URL(open.mock.calls[0][0]);
    expect(url.searchParams.get("title")).toBe("[Suggestion] Word count per section");
    expect(url.searchParams.get("body")).toContain("In the outline.");
    expect(url.searchParams.get("body")).not.toContain("Technical details");
    expect(useUi.getState().feedback).toBeNull();
  });

  it("Cancel closes the dialog", () => {
    useUi.getState().openFeedback({ kind: "suggestion" });
    render(<FeedbackDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useUi.getState().feedback).toBeNull();
  });

  it("sends the report by email through the mail app", async () => {
    const open = vi.spyOn(backend(), "openExternal").mockResolvedValue();
    useUi.getState().openFeedback({ kind: "design" });
    render(<FeedbackDialog />);
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Bigger toolbar icons" } });
    fireEvent.click(screen.getByRole("button", { name: "Send by Email" }));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(open.mock.calls[0][0]).toMatch(/^mailto:nasim\.uddinbd02@gmail\.com\?subject=Markpion%3A%20%5BDesign%5D%20Bigger%20toolbar%20icons&body=/);
  });

  it("starts a problem report with the error in the editable technical details", async () => {
    useUi.getState().openFeedback({ kind: "problem", error: { message: "Couldn't save notes.md", area: "editor" } });
    render(<FeedbackDialog />);
    expect(screen.getByRole("heading", { name: "Report a Problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Problem or error")).toBeChecked();
    await waitFor(() => expect((screen.getByLabelText("Technical details") as HTMLTextAreaElement).value).toContain("Error in the editor: Couldn't save notes.md"));
  });
});

describe("reporting from errors", () => {
  it("a part of the window that failed offers to report the error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = () => {
      throw new Error("render failed");
    };
    render(
      <ErrorBoundary area="preview">
        <Broken />
      </ErrorBoundary>,
    );
    expect(recentErrors().at(-1)).toMatchObject({ message: "render failed", area: "preview" });
    fireEvent.click(screen.getByRole("button", { name: "Report Problem…" }));
    expect(useUi.getState().feedback).toMatchObject({ kind: "problem", error: { message: "render failed", area: "preview" } });
  });

  it("an error message offers to report it", () => {
    useUi.getState().notify("error", "Couldn't export to PDF.");
    render(<Toasts />);
    fireEvent.click(screen.getByRole("button", { name: "Report…" }));
    expect(useUi.getState().feedback).toEqual({ kind: "problem", error: { message: "Couldn't export to PDF." } });
    expect(useUi.getState().toasts).toEqual([]);
  });
});
