import { describe, expect, it } from "vitest";
import { pathFilter, relativeTo } from "../src/services/pathFilter";
import { MemoryBackend } from "../src/services/memoryBackend";

describe("search path filters", () => {
  it("follows the same glob rules as the native search", () => {
    // The same cases as path_filters_follow_glob_rules in src-tauri/src/search.rs.
    const f = (inc: string, exc: string, path: string) => pathFilter(inc, exc)(path);
    expect(f("", "", "a.md")).toBe(true);
    expect(f("docs", "", "docs/a.md")).toBe(true);
    expect(f("docs", "", "x/docs/a.md")).toBe(true);
    expect(f("docs", "", "docsy/a.md")).toBe(false);
    expect(f("docs/**", "", "docs/deep/a.md")).toBe(true);
    expect(f("/docs", "", "x/docs/a.md")).toBe(false);
    expect(f("*.draft.md", "", "notes/x.DRAFT.md")).toBe(true);
    expect(f("*.draft.md", "", "notes/x.md")).toBe(false);
    expect(f("**/api/*.md", "", "a/b/api/x.md")).toBe(true);
    expect(f("**/api/*.md", "", "a/b/api/v1/x.md")).toBe(false);
    expect(f("guide?.md", "", "guide1.md")).toBe(true);
    expect(f("", "drafts, archive/", "drafts/a.md")).toBe(false);
    expect(f("", "drafts, archive/", "archive/old/a.md")).toBe(false);
    expect(f("", "drafts, archive/", "docs/a.md")).toBe(true);
    expect(f("docs", "*.draft.md", "docs/x.draft.md")).toBe(false);
    expect(f(" , ", "", "a.md")).toBe(true);
  });

  it("makes paths relative to the folder", () => {
    expect(relativeTo("C:\\Work\\Repo", "C:\\Work\\Repo\\docs\\a.md")).toBe("docs/a.md");
    expect(relativeTo("/ws/", "/ws/a.md")).toBe("a.md");
  });

  it("applies to the in-browser search too", async () => {
    const b = new MemoryBackend({ files: { "/ws/a.md": "needle", "/ws/docs/b.md": "needle", "/ws/docs/c.draft.md": "needle" }, approved: ["/ws"] });
    const search = async (include: string, exclude: string) =>
      (await b.searchWorkspace("/ws", { query: "needle", caseSensitive: false, wholeWord: false, regex: false, include, exclude })).files.map((f) => f.path);
    expect(await search("docs", "")).toEqual(["/ws/docs/b.md", "/ws/docs/c.draft.md"]);
    expect(await search("docs", "*.draft.md")).toEqual(["/ws/docs/b.md"]);
    expect(await search("", "docs")).toEqual(["/ws/a.md"]);
  });
});
