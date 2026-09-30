import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { markdownPlugins } from "../src/services/markdown";
import { wikiLinkHref } from "../src/services/wikiLinks";
import { linkAt } from "../src/features/followLink";
import { invalidateWorkspaceFiles, wikiLinkCompletionSource } from "../src/features/completion";
import { openPath } from "../src/features/documents";
import { setWorkspace } from "../src/features/workspace";
import { setupBackend } from "./helpers";

const render = (md: string) => {
  const { remarkPlugins, rehypePlugins } = markdownPlugins({ math: false });
  return renderToStaticMarkup(<ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>{md}</ReactMarkdown>);
};

describe("wiki links", () => {
  it("point to the page's .md file, with a heading as its anchor", () => {
    expect(wikiLinkHref("Setup Guide")).toBe("Setup%20Guide.md");
    expect(wikiLinkHref("docs/api#Error Codes")).toBe("docs/api.md#error-codes");
    expect(wikiLinkHref("logo.png")).toBe("logo.png");
  });

  it("render as links in the preview, but not in code", () => {
    const html = render("See [[Setup Guide]] and [[notes/todo|my list]], not `[[code]]`.");
    expect(html).toContain('href="Setup%20Guide.md"');
    expect(html).toContain(">Setup Guide</a>");
    expect(html).toContain('href="notes/todo.md"');
    expect(html).toContain(">my list</a>");
    expect(html).toContain("<code>[[code]]</code>");
  });

  it("can be followed from the editor", () => {
    const text = "Go to [[Setup Guide#Install]] now";
    expect(linkAt(text, text.indexOf("Setup") + 1)).toEqual({ kind: "href", href: "Setup%20Guide.md#install" });
  });

  it("complete with the folder's documents after [[", async () => {
    invalidateWorkspaceFiles();
    setupBackend({ "/ws/a.md": "", "/ws/docs/Setup Guide.md": "", "/ws/pic.png": "x" });
    await setWorkspace("/ws");
    await openPath("/ws/a.md");
    const doc = "See [[set";
    const result = await wikiLinkCompletionSource(new CompletionContext(EditorState.create({ doc }), doc.length, false));
    expect(result?.from).toBe(6);
    expect(result?.options.map((o) => [o.label, o.apply])).toEqual([["docs/Setup Guide", "docs/Setup Guide]]"]]);
  });
});
