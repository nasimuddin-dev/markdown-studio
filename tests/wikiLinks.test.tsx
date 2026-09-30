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
import { checkWorkspaceLinks } from "../src/features/linkCheck";
import { lintLinks } from "../src/features/lint";
import { rewriteLinks } from "../src/features/linkUpdate";

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
    expect(linkAt(text, text.indexOf("Setup") + 1)).toEqual({ kind: "href", href: "Setup Guide.md#install" });
  });

  it("are checked like other links, and counted as links to the page", async () => {
    setupBackend({ "/ws/a.md": "[[b]] [[b#B]] [[missing]] [[b#nope]]\n", "/ws/b.md": "# B\n" });
    const report = await checkWorkspaceLinks("/ws");
    expect(report.files[0].problems.map((p) => p.message)).toEqual(["Linked file not found: missing.md", "No heading matches “#nope” in b.md."]);
    expect(report.incoming.filter((l) => l.to === "/ws/b.md")).toHaveLength(3);
    const problems = await lintLinks("[[missing]]", "/ws/a.md", async () => false);
    expect(problems.map((p) => [p.message, !!p.fix])).toEqual([["Linked file not found: missing.md", false]]);
  });

  it("follow a renamed or moved page, keeping their style, heading and text", () => {
    const moved = (p: string) => (p === "/ws/b.md" ? "/ws/docs/c.md" : p);
    expect(rewriteLinks("[[b]] [[b#Intro|see]] [[b.md]] [[other]] [x](b.md)", "/ws/a.md", "/ws/a.md", moved).text).toBe("[[docs/c]] [[docs/c#Intro|see]] [[docs/c.md]] [[other]] [x](docs/c.md)");
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

  it("complete a page's headings after [[page#, and this document's after [[#", async () => {
    invalidateWorkspaceFiles();
    setupBackend({ "/ws/a.md": "", "/ws/docs/Setup Guide.md": "# Setup\n\n## Install it\n" });
    await setWorkspace("/ws");
    await openPath("/ws/a.md");
    const complete = async (doc: string) => {
      const r = await wikiLinkCompletionSource(new CompletionContext(EditorState.create({ doc }), doc.length, false));
      return r && { from: r.from, labels: r.options.map((o) => o.apply) };
    };
    expect(await complete("[[docs/Setup Guide#ins")).toEqual({ from: 19, labels: ["Setup]]", "Install it]]"] });
    expect(await complete("# Here\n\n[[#")).toEqual({ from: 11, labels: ["Here]]"] });
  });
});
