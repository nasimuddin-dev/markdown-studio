import { describe, expect, it } from "vitest";
import { collectFolderTags, extractTags } from "../src/features/tags";
import { setupBackend } from "./helpers";

describe("extractTags", () => {
  it("reads front matter tags, as a list or comma-separated", () => {
    expect(extractTags("---\ntitle: A\ntags: [draft, \"work\"]\n---\n")).toEqual([
      { tag: "draft", line: 3 },
      { tag: "work", line: 3 },
    ]);
    expect(extractTags("---\ntag: idea, later\n---\n").map((t) => t.tag)).toEqual(["idea", "later"]);
    expect(extractTags("---\ntags:\n  - one\n  - two\n---\n").map((t) => t.tag)).toEqual(["one", "two"]);
  });

  it("finds inline tags with their line, skipping headings, code, links and numbers", () => {
    const text = "# Title\n\nSome #idea here (#nested/sub).\n`#code` and [x](#anchor) and #1 and a#b\n\n```\n#fenced\n```\n#last-one";
    expect(extractTags(text)).toEqual([
      { tag: "idea", line: 3 },
      { tag: "nested/sub", line: 3 },
      { tag: "last-one", line: 9 },
    ]);
  });

  it("counts lines from the top of the file when there is front matter", () => {
    expect(extractTags("---\ntitle: A\n---\n\n#todo")).toEqual([{ tag: "todo", line: 5 }]);
  });
});

describe("collectFolderTags", () => {
  it("groups tags case-insensitively by file, with the first line and a count", async () => {
    setupBackend({ "/ws/a.md": "#Idea and #idea\n\n#work", "/ws/b.md": "---\ntags: [idea]\n---\n", "/ws/c.txt": "#idea" });
    const tags = await collectFolderTags("/ws");
    expect(tags.get("idea")).toEqual([
      { path: "/ws/a.md", line: 1, count: 2 },
      { path: "/ws/b.md", line: 2, count: 1 },
    ]);
    expect(tags.get("work")).toEqual([{ path: "/ws/a.md", line: 3, count: 1 }]);
  });
});
