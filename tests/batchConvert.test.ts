import { describe, expect, it } from "vitest";
import { convertWorkspaceDocuments } from "../src/features/batchConvert";
import { kindForPath } from "../src/features/importing";
import { useWorkspace } from "../src/stores/workspaceStore";
import { useUi } from "../src/stores/uiStore";
import { autoAnswer, setupBackend } from "./helpers";

const read = async (b: ReturnType<typeof setupBackend>, p: string) => (await b.readTextFile(p)).content;

describe("convert folder to Markdown", () => {
  it("maps extensions to converters", () => {
    expect(kindForPath("C:\a\b.DOCX")).toBe("docx");
    expect(kindForPath("/x/page.htm")).toBe("html");
    expect(kindForPath("/x/data.tsv")).toBe("csv");
    expect(kindForPath("/x/novel.EPUB")).toBe("epub");
    expect(kindForPath("/x/notes.md")).toBeNull();
  });

  it("converts new documents beside the originals and skips ones already converted", async () => {
    const backend = setupBackend({
      "/ws/page.html": "<h1>Hello</h1><p>Some <strong>bold</strong> text.</p>",
      "/ws/data/cities.csv": "City,Pop\nOslo,700000\n",
      "/ws/done.html": "<p>new</p>",
      "/ws/done.md": "keep me",
      "/ws/.hidden/x.csv": "a,b\n1,2",
    });
    useWorkspace.getState().setRoot("/ws");
    const answered = autoAnswer("convert");
    const result = await convertWorkspaceDocuments();
    answered.stop();
    expect(answered.titles).toEqual(["Convert folder to Markdown"]);
    expect(result?.converted.sort()).toEqual(["/ws/data/cities.md", "/ws/page.md"]);
    expect(result?.skipped).toEqual(["/ws/done.html"]);
    expect(await read(backend, "/ws/page.md")).toContain("# Hello\n\nSome **bold** text.");
    expect(await read(backend, "/ws/data/cities.md")).toContain("| Oslo | 700000 |");
    expect(await read(backend, "/ws/done.md")).toBe("keep me");
    expect(useUi.getState().toasts.at(-1)).toMatchObject({ kind: "success", message: "Converted 2 documents to Markdown." });

    // A second run has nothing left to do and doesn't ask.
    const again = autoAnswer("convert");
    expect((await convertWorkspaceDocuments())?.converted).toEqual([]);
    again.stop();
    expect(again.titles).toEqual([]);
  });

  it("reports files that fail and still converts the rest", async () => {
    const backend = setupBackend({ "/ws/broken.pdf": "not a pdf", "/ws/ok.csv": "a,b\n1,2" });
    useWorkspace.getState().setRoot("/ws");
    const answered = autoAnswer("convert");
    const result = await convertWorkspaceDocuments();
    answered.stop();
    expect(result?.converted).toEqual(["/ws/ok.md"]);
    expect(result?.failed.map((f) => f.path)).toEqual(["/ws/broken.pdf"]);
    expect(await backend.readTextFile("/ws/ok.md")).toBeTruthy();
    expect(useUi.getState().toasts.at(-1)?.kind).toBe("warning");
  }, 20000);

  it("does nothing when cancelled", async () => {
    const backend = setupBackend({ "/ws/a.csv": "a,b\n1,2" });
    useWorkspace.getState().setRoot("/ws");
    const answered = autoAnswer("cancel");
    expect(await convertWorkspaceDocuments()).toBeNull();
    answered.stop();
    await expect(backend.readTextFile("/ws/a.md")).rejects.toBeTruthy();
  });
});
