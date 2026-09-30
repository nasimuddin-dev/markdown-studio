import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { emojiCompletionSource, fileCompletions, headingCompletions, invalidateWorkspaceFiles, linkCompletionSource, referenceCompletionSource } from "../src/features/completion";
import { relativePath } from "../src/services/paths";
import { openPath } from "../src/features/documents";
import { setWorkspace } from "../src/features/workspace";
import { setupBackend } from "./helpers";

describe("relativePath", () => {
  it("builds forward-slash relative paths", () => {
    expect(relativePath("/ws/docs", "/ws/docs/a.md")).toBe("a.md");
    expect(relativePath("/ws/docs", "/ws/img/x.png")).toBe("../img/x.png");
    expect(relativePath("C:\\ws\\docs", "c:\\ws\\README.md")).toBe("../README.md");
    expect(relativePath("C:\\ws", "D:\\other\\a.md")).toBeNull();
  });
});

describe("completion options", () => {
  it("offers GitHub-style anchors for headings", () => {
    expect(headingCompletions("# Hello World\n## Hello World\n").map((c) => c.label)).toEqual(["#hello-world", "#hello-world-1"]);
  });

  it("offers documents for links and images for image links", () => {
    const files = ["/ws/docs/page.md", "/ws/docs/other doc.md", "/ws/README.md", "/ws/img/logo.png"];
    expect(fileCompletions(files, "/ws/docs/page.md", false).map((c) => c.label)).toEqual(["other%20doc.md", "../README.md"]);
    expect(fileCompletions(files, "/ws/docs/page.md", true).map((c) => c.label)).toEqual(["../img/logo.png"]);
  });
});

async function complete(doc: string, explicit = false) {
  const state = EditorState.create({ doc });
  const result = await linkCompletionSource(new CompletionContext(state, doc.length, explicit));
  return result && { from: result.from, labels: result.options.map((o) => o.label) };
}

describe("link completion source", () => {
  it("completes files after ]( and headings after ](#", async () => {
    invalidateWorkspaceFiles();
    setupBackend({ "/ws/a.md": "# Top\n", "/ws/b.md": "", "/ws/pics/p.png": "x" });
    await setWorkspace("/ws");
    await openPath("/ws/a.md");

    expect(await complete("see [b](")).toEqual({ from: 8, labels: ["b.md"] });
    expect(await complete("![p](")).toEqual({ from: 5, labels: ["pics/p.png"] });
    expect(await complete("# Top\n[t](#")).toEqual({ from: 10, labels: ["#top"] });
    expect(await complete("plain text")).toBeNull();
  });
});

describe("emoji shortcode completion", () => {
  const complete = async (doc: string) => {
    const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
    ensureSyntaxTree(state, state.doc.length, 5000);
    return emojiCompletionSource(new CompletionContext(state, doc.length, false));
  };

  it("offers shortcodes after a colon and two characters", async () => {
    const result = await complete("Launch :roc");
    expect(result?.from).toBe(7);
    const rocket = result?.options.find((o) => o.label === ":rocket:");
    expect(rocket?.displayLabel).toBe("🚀  :rocket:");
  });

  it("stays quiet for one character, times, URLs and code", async () => {
    expect(await complete("Launch :r")).toBeNull();
    expect(await complete("at 10:30")).toBeNull();
    expect(await complete("see http://example")).toBeNull();
    expect(await complete("`:roc")).toBeNull();
    expect(await complete("```\n:roc")).toBeNull();
  });
});

describe("reference and footnote label completion", () => {
  const complete = (doc: string) => {
    const result = referenceCompletionSource(new CompletionContext(EditorState.create({ doc }), doc.length, false));
    return result && { from: result.from, labels: result.options.map((o) => `${o.label}=${o.detail}`) };
  };
  const defs = "\n\n[Guide]: guide.md\n[home]: /\n[guide]: dup.md\n[^note]: A note.\n`[code]: x`";

  it("offers the document's link definitions after ][", () => {
    expect(complete(defs + "\nSee [the guide][")).toEqual({ from: defs.length + 17, labels: ["Guide=guide.md", "home=/"] });
    expect(complete(defs + "\n![logo][ho")?.labels).toEqual(["Guide=guide.md", "home=/"]);
    expect(complete("[a][")).toBeNull();
  });

  it("offers defined footnotes after [^, but not where a definition starts", () => {
    expect(complete(defs + "\nText[^")).toEqual({ from: defs.length + 7, labels: ["note=A note."] });
    expect(complete(defs + "\n[^")).toBeNull();
  });
});
