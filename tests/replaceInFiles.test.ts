import { describe, expect, it } from "vitest";
import { replaceInText, replaceInWorkspace } from "../src/features/replaceInFiles";
import { openPath } from "../src/features/documents";
import { useDocuments } from "../src/stores/documentsStore";
import { useWorkspace } from "../src/stores/workspaceStore";
import { autoAnswer, setupBackend } from "./helpers";

const opts = (query: string, extra: Partial<{ caseSensitive: boolean; wholeWord: boolean; regex: boolean }> = {}) => ({
  query, caseSensitive: false, wholeWord: false, regex: false, ...extra,
});

describe("replace in text", () => {
  it("replaces literally, honouring case and whole-word options", () => {
    expect(replaceInText("Cat cat concat", opts("cat"), "dog")).toEqual({ text: "dog dog condog", count: 3 });
    expect(replaceInText("Cat cat", opts("cat", { caseSensitive: true }), "dog").text).toBe("Cat dog");
    expect(replaceInText("cat concat", opts("cat", { wholeWord: true }), "dog").text).toBe("dog concat");
    expect(replaceInText("a.b", opts("."), "$1").text).toBe("a$1b"); // literal, even with $
  });

  it("supports regex groups, per line, keeping CRLF", () => {
    expect(replaceInText("## One\r\n## Two\r\n", opts("^## (.*)$", { regex: true }), "### $1").text).toBe("### One\r\n### Two\r\n");
    expect(replaceInText("v1.2 and v3.4", opts("v(?<major>\\d)\\.(\\d)", { regex: true }), "$<major>-$2 ($&) $$").text).toBe("1-2 (v1.2) $ and 3-4 (v3.4) $");
    // Lookarounds see the whole line, not just the match.
    expect(replaceInText("foobar foobaz", opts("foo(?=bar)", { regex: true }), "X").text).toBe("Xbar foobaz");
  });
});

describe("replace in workspace", () => {
  it("replaces across files, skips unsaved ones and reloads open tabs", async () => {
    const backend = setupBackend({
      "/ws/a.md": "Acme is great.\nUse Acme.",
      "/ws/docs/b.md": "About Acme",
      "/ws/c.md": "Acme draft",
      "/ws/d.md": "Nothing here",
    });
    useWorkspace.getState().setRoot("/ws");
    const b = (await openPath("/ws/docs/b.md"))!;
    const c = (await openPath("/ws/c.md"))!;
    useDocuments.getState().setContent(c, "Acme draft, edited");

    const answered = autoAnswer("replace");
    const result = await replaceInWorkspace("/ws", opts("Acme"), "Globex");
    answered.stop();
    expect(answered.titles).toEqual(["Replace in files"]);
    expect(result).toMatchObject({ replaced: 3, files: 2, skippedUnsaved: ["c.md"], failed: [] });
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("Globex is great.\nUse Globex.");
    expect((await backend.readTextFile("/ws/c.md")).content).toBe("Acme draft"); // unsaved: untouched
    expect(useDocuments.getState().docs.find((d) => d.id === b)?.content).toBe("About Globex"); // open tab reloaded
  });

  it("changes nothing when cancelled", async () => {
    const backend = setupBackend({ "/ws/a.md": "Acme" });
    useWorkspace.getState().setRoot("/ws");
    const answered = autoAnswer("cancel");
    expect(await replaceInWorkspace("/ws", opts("Acme"), "Globex")).toBeNull();
    answered.stop();
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("Acme");
  });

  it("only touches the files the search filters allow", async () => {
    const backend = setupBackend({ "/ws/a.md": "Acme", "/ws/docs/b.md": "Acme", "/ws/docs/old/c.md": "Acme" });
    useWorkspace.getState().setRoot("/ws");
    const answered = autoAnswer("replace");
    const result = await replaceInWorkspace("/ws", { ...opts("Acme"), include: "docs", exclude: "old" }, "Globex");
    answered.stop();
    expect(result).toMatchObject({ replaced: 1, files: 1 });
    expect((await backend.readTextFile("/ws/docs/b.md")).content).toBe("Globex");
    expect((await backend.readTextFile("/ws/a.md")).content).toBe("Acme");
    expect((await backend.readTextFile("/ws/docs/old/c.md")).content).toBe("Acme");
  });
});
