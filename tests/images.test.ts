import { describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { assetFileName, imageMarkdown, insertImageFiles, insertImageFromFile, isImageFile, namedImageFile, relativeImageMarkdown, toBase64 } from "../src/features/images";
import { registerEditorView } from "../src/features/editorBridge";
import { newDocument, openPath } from "../src/features/documents";
import { useUi } from "../src/stores/uiStore";
import { imageFolderName, sanitizeSettings, useSettings } from "../src/stores/settingsStore";
import { setupBackend } from "./helpers";

const png = (name = "image.png") => new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });

function mountEditor(doc = "") {
  const view = new EditorView({ state: EditorState.create({ doc }), parent: document.body });
  registerEditorView(view);
  return view;
}

describe("image helpers", () => {
  it("names clipboard screenshots with a timestamp and keeps real names", () => {
    const now = new Date(2026, 8, 23, 18, 5, 9);
    expect(assetFileName(png(), now)).toBe("image-20260923-180509.png");
    expect(assetFileName(new File(["x"], "My Diagram (v2).PNG", { type: "image/png" }), now)).toBe("My-Diagram-v2.png");
    expect(assetFileName(new File(["x"], "photo.jpeg", { type: "image/jpeg" }), now)).toBe("photo.jpg");
  });

  it("builds relative, URL-safe Markdown", () => {
    expect(imageMarkdown("/ws/docs/assets/my shot.png")).toBe("![my shot](assets/my%20shot.png)");
    expect(imageMarkdown("C:\\ws\\assets\\image-1.png")).toBe("![image 1](assets/image-1.png)");
  });

  it("detects images and encodes base64", async () => {
    expect(isImageFile(png())).toBe(true);
    expect(isImageFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(false);
    expect(await toBase64(png())).toBe("iVBORw==");
  });
});

describe("inserting images", () => {
  it("saves into assets/ next to the document and inserts links at the cursor", async () => {
    const backend = setupBackend({ "/ws/docs/page.md": "Intro\n" });
    await openPath("/ws/docs/page.md");
    const view = mountEditor("Intro\n");
    view.dispatch({ selection: { anchor: 6 } });

    expect(await insertImageFiles([png("chart.png"), png("chart.png")])).toBe(true);
    expect(view.state.doc.toString()).toBe("Intro\n![chart](assets/chart.png)\n![chart 1](assets/chart-1.png)");
    expect(await backend.readImage("/ws/docs/assets/chart.png")).toBe("data:image/png;base64,iVBORw==");
    view.destroy();
  });

  it("saves into the folder set in Settings, falling back to assets/ for an invalid name", async () => {
    const backend = setupBackend({ "/ws/p.md": "" });
    await openPath("/ws/p.md");
    const view = mountEditor("");
    useSettings.getState().update({ imageFolder: "media files" });
    try {
      await insertImageFiles([png("x.png")]);
      expect(view.state.doc.toString()).toBe("![x](media%20files/x.png)");
      expect(await backend.readImage("/ws/media files/x.png")).toBe("data:image/png;base64,iVBORw==");
      expect(imageFolderName("../up")).toBe("assets");
      expect(imageFolderName(" images ")).toBe("images");
      expect(sanitizeSettings({ imageFolder: "a/b" }).imageFolder).toBe("assets");
    } finally {
      useSettings.getState().update({ imageFolder: "assets" });
      view.destroy();
    }
  });

  it("asks for a name for a pasted screenshot when the setting is on", async () => {
    const backend = setupBackend({ "/ws/p.md": "" });
    await openPath("/ws/p.md");
    const view = mountEditor("");
    useSettings.getState().update({ askImageName: true });
    const unsub = useUi.subscribe((s) => {
      const d = s.dialogs[0];
      if (!d) return;
      unsub();
      queueMicrotask(() => useUi.getState().closeDialog(d.id, { button: "ok", value: "Login page v1.2" }));
    });
    try {
      await insertImageFiles([png("image.png")]);
      expect(view.state.doc.toString()).toBe("![Login page v1.2](assets/Login-page-v1.2.png)");
      expect(await backend.readImage("/ws/assets/Login-page-v1.2.png")).toContain("base64");
      expect(namedImageFile("shot.PNG", "image-1.png")).toBe("shot.png");
      expect(namedImageFile("  ", "image-1.png")).toBe("image-1.png");
    } finally {
      useSettings.getState().update({ askImageName: false });
      view.destroy();
    }
  });

  it("puts images on their own line when pasted mid-line", async () => {
    setupBackend({ "/ws/p.md": "ab" });
    await openPath("/ws/p.md");
    const view = mountEditor("ab");
    view.dispatch({ selection: { anchor: 1 } });
    await insertImageFiles([png("x.png")]);
    expect(view.state.doc.toString()).toBe("a\n![x](assets/x.png)\nb");
    view.destroy();
  });

  it("asks to save untitled documents first", async () => {
    setupBackend();
    newDocument("draft");
    expect(await insertImageFiles([png()])).toBe(true);
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/Save the document first/);
  });

  it("ignores non-image files", async () => {
    setupBackend();
    newDocument();
    expect(await insertImageFiles([new File(["x"], "a.txt", { type: "text/plain" })])).toBe(false);
  });
});

describe("Insert Image…", () => {
  /** A backend that behaves like the desktop app's native picker, returning `picked`. */
  function nativeBackend(files: Record<string, string>, picked: string | null) {
    const backend = setupBackend(files);
    Object.assign(backend, { capabilities: { ...backend.capabilities, nativeImport: true }, pickImportFile: async () => picked });
    return backend;
  }

  it("links an image inside the document's folder where it is", async () => {
    nativeBackend({ "/ws/docs/a.md": "", "/ws/docs/pics/my cat (1).png": "png" }, "/ws/docs/pics/my cat (1).png");
    await openPath("/ws/docs/a.md");
    const view = mountEditor("");
    await insertImageFromFile();
    expect(view.state.doc.toString()).toBe("![my cat (1)](pics/my%20cat%20%281%29.png)");
    view.destroy();
  });

  it("copies an image from elsewhere into assets/ next to the document", async () => {
    const backend = nativeBackend({ "/ws/docs/a.md": "", "/ws/other/dog.png": "png" }, "/ws/other/dog.png");
    await openPath("/ws/docs/a.md");
    const view = mountEditor("");
    await insertImageFromFile();
    expect(view.state.doc.toString()).toBe("![dog](assets/dog.png)");
    expect(await backend.fileMtime("/ws/docs/assets/dog.png")).not.toBeNull();
    view.destroy();
  });

  it("does nothing when the picker is cancelled, and asks to save untitled documents first", async () => {
    nativeBackend({ "/ws/a.md": "x" }, null);
    await openPath("/ws/a.md");
    const view = mountEditor("x");
    await insertImageFromFile();
    expect(view.state.doc.toString()).toBe("x");
    view.destroy();
    newDocument("draft");
    await insertImageFromFile();
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/Save the document first/);
  });

  it("builds relative links for images the document can reach", () => {
    expect(relativeImageMarkdown("/ws/docs/a.md", "/ws/img/b_c.png")).toBe("![b c](../img/b_c.png)");
    expect(relativeImageMarkdown("C:\\ws\\a.md", "D:\\img\\b.png")).toBeNull();
  });
});
