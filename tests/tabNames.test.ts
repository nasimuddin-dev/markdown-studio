import { describe, expect, it } from "vitest";
import { tabHints } from "../src/features/tabNames";

const doc = (id: string, path: string | null, name = path ? path.split(/[\\/]/).pop()! : "Untitled-1.md") => ({ id, name, path });

describe("tab hints for files with the same name", () => {
  it("shows the folder that tells them apart, and nothing for unique names", () => {
    const hints = tabHints([doc("a", "/ws/docs/README.md"), doc("b", "/ws/notes/README.md"), doc("c", "/ws/guide.md"), doc("d", null)]);
    expect(Object.fromEntries(hints)).toEqual({ a: "docs", b: "notes" });
  });

  it("goes further up when the parent folders match too, ignoring case", () => {
    const hints = tabHints([doc("a", "/ws/api/docs/index.md"), doc("b", "/ws/web/docs/INDEX.md"), doc("c", "C:\\ws\\index.md")]);
    expect(Object.fromEntries(hints)).toEqual({ a: "api/docs", b: "web/docs", c: "ws" });
  });
});
