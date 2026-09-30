import { describe, expect, it } from "vitest";
import { checkWorkspaceLinks, documentAnchors } from "../src/features/linkCheck";
import { setupBackend } from "./helpers";

describe("workspace link check", () => {
  it("collects heading slugs and HTML anchors", () => {
    expect([...documentAnchors('# Intro\n\n## Set up & run\n\n<a id="custom"></a>\n## Intro\n')]).toEqual(["intro", "set-up--run", "intro-1", "custom"]);
  });

  it("finds missing files, images and anchors across files", async () => {
    setupBackend({
      "/ws/README.md": [
        "# Home",
        "",
        "[Guide](docs/guide.md#install) [bad anchor](docs/guide.md#nope)",
        "[gone](missing.md) ![logo](img/logo.png) ![lost](img/lost.png)",
        "[here](#home) [there](#nowhere) [web](https://example.com) [outside](../x.md)",
        "`[code](not-a-link.md)`",
      ].join("\n"),
      "/ws/docs/guide.md": "# Guide\n\n## Install\n\n[back](../README.md#home) [folder](../docs/)\n",
      "/ws/img/logo.png": "png",
    });
    const report = await checkWorkspaceLinks("/ws");
    expect(report.filesChecked).toBe(2);
    expect(report.files.map((f) => f.path)).toEqual(["/ws/README.md"]);
    const problems = report.files[0].problems.map((p) => `${p.line}:${p.rule}:${p.message}`);
    expect(problems).toEqual([
      "3:broken-anchor:No heading matches “#nope” in docs/guide.md.",
      "4:broken-link:Linked file not found: missing.md",
      "4:missing-image:Image not found: img/lost.png",
      "5:broken-anchor:No heading matches “#nowhere” in this document.",
    ]);
    const first = report.files[0].problems[0];
    expect(first.column).toBe("[Guide](docs/guide.md#install) ".length);
  });

  it("checks reference-style link definitions", async () => {
    setupBackend({ "/ws/a.md": "# A\n\nSee [b][1] and [c][2].\n\n[1]: b.md#b\n[2]: c.md\n", "/ws/b.md": "# B\n" });
    const report = await checkWorkspaceLinks("/ws");
    expect(report.linksChecked).toBe(2);
    expect(report.files[0].problems.map((p) => `${p.line}:${p.message}`)).toEqual(["6:Linked file not found: c.md"]);
  });

  it("checks HTML image sources and link targets", async () => {
    setupBackend({ "/ws/a.md": '# A\n\n<img src="logo.png" alt="Logo">\n<a href="b.md">B</a>\n', "/ws/b.md": "# B\n" });
    const report = await checkWorkspaceLinks("/ws");
    expect(report.linksChecked).toBe(2);
    expect(report.files[0].problems.map((p) => `${p.line}:${p.rule}`)).toEqual(["3:missing-image"]);
  });

  it("reports a clean workspace", async () => {
    setupBackend({ "/ws/a.md": "# A\n\n[b](b.md)\n", "/ws/b.md": "# B\n" });
    const report = await checkWorkspaceLinks("/ws");
    expect(report).toMatchObject({ files: [], filesChecked: 2, linksChecked: 1 });
  });

  it("lists the links between Markdown files, for “Links to this document”", async () => {
    setupBackend({
      "/ws/a.md": "# A\n\n[to B](b.md#b) and [self](a.md) and ![img](b.png)\n",
      "/ws/docs/c.md": "See [ref][b].\n\n[b]: ../b.md\n",
      "/ws/b.md": "# B\n",
      "/ws/b.png": "x",
    });
    const report = await checkWorkspaceLinks("/ws");
    expect(report.incoming.map((l) => `${l.from} -> ${l.to} @${l.line}: ${l.label}`)).toEqual(["/ws/a.md -> /ws/b.md @3: to B", "/ws/docs/c.md -> /ws/b.md @3: b"]);
  });
});
