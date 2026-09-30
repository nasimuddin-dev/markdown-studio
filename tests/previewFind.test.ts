import { describe, expect, it } from "vitest";
import { findTextRanges } from "../src/components/PreviewFind";

describe("find in the preview", () => {
  it("finds matches across elements, ignoring case, buttons and hidden text", () => {
    const root = document.createElement("div");
    root.innerHTML = '<h1>Mark<em>down</em> guide</h1><p>Write markdown.</p><div class="code-block"><pre>MARKDOWN</pre><button>Copy markdown</button></div><span class="sr-only">markdown</span>';
    const found = findTextRanges(root, "markdown");
    expect(found.map((r) => r.toString())).toEqual(["Markdown", "markdown", "MARKDOWN"]);
    expect(findTextRanges(root, "")).toEqual([]);
    expect(findTextRanges(root, "missing")).toEqual([]);
    expect(findTextRanges(root, "o", 2)).toHaveLength(2);
  });
});
