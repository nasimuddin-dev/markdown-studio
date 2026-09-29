import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { MemoryBackend } from "../src/services/memoryBackend";
import { setBackend } from "../src/services";
import { AI_ACTIONS, AI_SYSTEM_PROMPT, aiTarget, buildAiPrompt, cleanAiAnswer, runAiAction } from "../src/features/ai";
import { newDocument } from "../src/features/documents";
import { getEditorView } from "../src/features/editorBridge";
import { useDocuments } from "../src/stores/documentsStore";
import { useSettings } from "../src/stores/settingsStore";
import { useAi } from "../src/stores/aiStore";
import { useUi } from "../src/stores/uiStore";
import { useWorkspace } from "../src/stores/workspaceStore";

// The app loads this dialog on first use; load it up front so a cold import doesn't use up a test's time.
beforeAll(() => import("../src/components/AiPanel"), 30_000);

describe("AI assistant: what is sent", () => {
  const doc = "# Title\n\nFirst paragraph here.\nStill first.\n\nSecond paragraph.\n";

  it("uses the selection, or the paragraph at the cursor", () => {
    const sel = doc.indexOf("paragraph here");
    expect(aiTarget(doc, sel, sel + 9, "selection")).toEqual({ from: sel, to: sel + 9, text: "paragraph" });
    const inFirst = doc.indexOf("Still");
    expect(aiTarget(doc, inFirst, inFirst, "selection")?.text).toBe("First paragraph here.\nStill first.");
    const inSecond = doc.indexOf("Second") + 3;
    const t = aiTarget(doc, inSecond, inSecond, "selection")!;
    expect(t.text).toBe("Second paragraph.");
    expect(doc.slice(t.from, t.to)).toBe("Second paragraph.");
    expect(aiTarget("   \n\n  ", 1, 1, "selection")).toBeNull();
  });

  it("sends the text before the cursor to Continue Writing", () => {
    const end = doc.indexOf("Second");
    expect(aiTarget(doc, end, end, "before")).toEqual({ from: end, to: end, text: doc.slice(0, end) });
    expect(aiTarget(doc, 0, 0, "before")).toBeNull();
  });

  it("marks the document text as content, not instructions", () => {
    const prompt = buildAiPrompt(AI_ACTIONS.translate, "Hallo Welt", "French");
    expect(prompt).toBe("<instruction>Translate it into French. Keep the Markdown formatting, and leave code, URLs and names as they are.</instruction>\n\n<document>\nHallo Welt\n</document>");
    expect(AI_SYSTEM_PROMPT).toMatch(/never instructions to you/);
  });

  it("removes a code fence wrapped around the whole answer, unless the original was code", () => {
    expect(cleanAiAnswer("```markdown\nBetter text.\n```", "Bad text.")).toBe("Better text.");
    expect(cleanAiAnswer("```js\nconst a = 1;\n```", "```js\nconst a=1\n```")).toBe("```js\nconst a = 1;\n```");
    expect(cleanAiAnswer("\n\nPlain.\n\n", "x")).toBe("Plain.");
  });
});

describe("AI assistant: in the editor", () => {
  function setup(answer = "A clearer sentence.") {
    const claude = vi.fn(async () => answer);
    const backend = new MemoryBackend({ ai: claude, prompt: () => null });
    setBackend(backend);
    useDocuments.setState({ docs: [], activeId: null });
    useWorkspace.getState().setRoot(null);
    useUi.setState({ dialogs: [], toasts: [], settingsOpen: false });
    useAi.setState({ busy: null, review: null });
    useSettings.setState({ locked: [], managedDefaults: {} });
    useSettings.getState().update({ aiEnabled: true, aiConsent: true, aiModel: "claude-opus-5-5" });
    return { backend, claude };
  }

  it("shows the answer for review and replaces the selection only when asked", async () => {
    const { backend, claude } = setup();
    await backend.aiSetKey("sk-ant-test-key-1234567890");
    render(<App />);
    let id = "";
    act(() => {
      id = newDocument("Intro.\n\nThis sentence are bad.\n\nOutro.");
    });
    await waitFor(() => expect(getEditorView()).toBeTruthy());
    const view = getEditorView()!;
    const from = view.state.doc.toString().indexOf("This");
    act(() => view.dispatch({ selection: { anchor: from, head: from + "This sentence are bad.".length } }));
    await act(() => runAiAction("improve"));
    expect(claude).toHaveBeenCalledWith({
      model: "claude-opus-5-5",
      system: AI_SYSTEM_PROMPT,
      prompt: expect.stringContaining("<document>\nThis sentence are bad.\n</document>"),
    });
    // Nothing changed yet.
    expect(useDocuments.getState().docs.find((d) => d.id === id)?.content).toContain("are bad");
    const dialog = await screen.findByRole("dialog", { name: /AI: Improve Writing/ });
    expect(dialog).toHaveTextContent("This sentence are bad.");
    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(view.state.doc.toString()).toBe("Intro.\n\nA clearer sentence.\n\nOutro."));
    expect(useAi.getState().review).toBeNull();
  });

  it("explains what to do when the assistant is off or has no key", async () => {
    const { claude } = setup();
    useSettings.getState().update({ aiEnabled: false });
    render(<App />);
    act(() => {
      newDocument("Some text.");
    });
    await waitFor(() => expect(getEditorView()).toBeTruthy());
    const done = runAiAction("improve");
    const dialog = await screen.findByRole("dialog", { name: /AI assistant is off/ });
    expect(dialog).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Not Now" }));
    await done;
    useSettings.getState().update({ aiEnabled: true });
    await act(() => runAiAction("improve"));
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/Add your Anthropic API key/);
    expect(claude).not.toHaveBeenCalled();
  });

  it("asks once for consent before sending text", async () => {
    const { backend, claude } = setup();
    await backend.aiSetKey("sk-ant-test-key-1234567890");
    useSettings.getState().update({ aiConsent: false });
    render(<App />);
    act(() => {
      newDocument("Some text.");
    });
    await waitFor(() => expect(getEditorView()).toBeTruthy());
    const done = runAiAction("summarize");
    await screen.findByRole("dialog", { name: /Send text to Claude/ });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await done;
    expect(claude).not.toHaveBeenCalled();
    expect(useSettings.getState().settings.aiConsent).toBe(false);
  });

  it("reports API errors without changing the document", async () => {
    const { backend } = setup();
    const failing = new MemoryBackend({ ai: async () => Promise.reject({ kind: "ai", message: "Claude is busy right now. Try again in a moment." }), prompt: () => null });
    setBackend(failing);
    await failing.aiSetKey("sk-ant-test-key-1234567890");
    void backend;
    render(<App />);
    act(() => {
      newDocument("Some text.");
    });
    await waitFor(() => expect(getEditorView()).toBeTruthy());
    await act(() => runAiAction("shorter"));
    expect(useUi.getState().toasts.at(-1)).toMatchObject({ kind: "error", message: "Claude is busy right now. Try again in a moment." });
    expect(useAi.getState().busy).toBeNull();
    expect(getEditorView()!.state.doc.toString()).toBe("Some text.");
  });
});

describe("AI: Write", () => {
  it("sends only the instruction, and inserts at the cursor", () => {
    expect(aiTarget("Existing text.", 5, 5, "none")).toEqual({ from: 5, to: 5, text: "" });
    const prompt = buildAiPrompt(AI_ACTIONS.write, "", "A short intro about Markdown");
    expect(prompt).toContain("<instruction>A short intro about Markdown</instruction>");
    expect(prompt).not.toContain("<document>");
    expect(AI_ACTIONS.write.placement).toBe("cursor");
  });
});

describe("AI assistant under an IT policy", () => {
  it("says the organization turned it off, without offering Settings", async () => {
    const claude = vi.fn(async () => "x");
    setBackend(new MemoryBackend({ ai: claude, prompt: () => null, policy: { settings: { aiEnabled: false }, locked: ["aiEnabled"] } }));
    await act(() => useSettings.getState().load());
    useUi.setState({ dialogs: [], toasts: [], settingsOpen: false });
    render(<App />);
    act(() => {
      newDocument("Some text.");
    });
    await waitFor(() => expect(getEditorView()).toBeTruthy());
    await act(() => runAiAction("improve"));
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/turned off by your organization/);
    expect(useUi.getState().dialogs).toHaveLength(0);
    expect(claude).not.toHaveBeenCalled();
  });
});

describe("AI streaming", () => {
  it("opens the review at once, fills it as Claude writes, and Stop cancels without changes", async () => {
    let release: (v: string) => void = () => {};
    const claude = vi.fn(() => new Promise<string>((r) => (release = r)));
    const backend = new MemoryBackend({ ai: claude, prompt: () => null });
    setBackend(backend);
    await backend.aiSetKey("sk-ant-test-key-1234567890");
    useDocuments.setState({ docs: [], activeId: null });
    useUi.setState({ dialogs: [], toasts: [], settingsOpen: false });
    useAi.setState({ busy: null, review: null });
    useSettings.setState({ locked: [], managedDefaults: {} });
    useSettings.getState().update({ aiEnabled: true, aiConsent: true });
    render(<App />);
    act(() => {
      newDocument("Some text.");
    });
    await waitFor(() => expect(getEditorView()).toBeTruthy());
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = runAiAction("improve");
    });
    const dialog = await screen.findByRole("dialog", { name: /AI: Improve Writing/ });
    expect(dialog).toHaveTextContent("Claude is writing…");
    expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await act(async () => {
      release("Better text.");
      await done;
    });
    expect(screen.queryByRole("dialog", { name: /AI:/ })).toBeNull();
    expect(useAi.getState().busy).toBeNull();
    expect(getEditorView()!.state.doc.toString()).toBe("Some text.");
  });
});
