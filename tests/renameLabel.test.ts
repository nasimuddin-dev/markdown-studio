import { describe, expect, it } from "vitest";
import { applyChanges } from "../src/features/referenceLinks";
import { labelAt, planLabelRename } from "../src/features/renameLabel";

const rename = (text: string, marker: string, value: string) => {
  const target = labelAt(text, text.indexOf(marker) + 1)!;
  return applyChanges(text, planLabelRename(text, target, value));
};

describe("renaming footnote and link labels", () => {
  it("finds the label under the cursor", () => {
    const text = "See[^note] and [the guide][Guide] or [home][].\n\n[guide]: guide.md\n[^note]: A note.";
    expect(labelAt(text, text.indexOf("^note") + 1)).toEqual({ kind: "footnote", label: "note" });
    expect(labelAt(text, text.indexOf("[Guide]") + 2)).toEqual({ kind: "reference", label: "Guide" });
    expect(labelAt(text, text.indexOf("home") + 1)).toEqual({ kind: "reference", label: "home" });
    expect(labelAt(text, text.indexOf("[guide]:") + 1)).toEqual({ kind: "reference", label: "guide" });
    expect(labelAt(text, text.indexOf("See"))).toBeNull();
  });

  it("renames a footnote's references and definition", () => {
    expect(rename("One[^1] two[^1].\n\n[^1]: Note.\n`[^1]` in code", "^1]", "source")).toBe("One[^source] two[^source].\n\n[^source]: Note.\n`[^1]` in code");
  });

  it("renames a link label in full, collapsed and shortcut references and the definition", () => {
    const text = "[the guide][Guide], [guide][] and [guide].\n\n[guide]: guide.md\n[other]: o.md";
    expect(rename(text, "[Guide]", "manual")).toBe("[the guide][manual], [guide][manual] and [guide][manual].\n\n[manual]: guide.md\n[other]: o.md");
  });
});
