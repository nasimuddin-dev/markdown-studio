import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { formatStateAt } from "../src/features/formatState";

/** The format state with the cursor at the "¦" in `text`. */
function at(text: string) {
  const pos = text.indexOf("¦");
  const state = EditorState.create({ doc: text.replace("¦", ""), selection: { anchor: pos }, extensions: [markdown({ base: markdownLanguage })] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return formatStateAt(state);
}

describe("formatting at the cursor", () => {
  it("detects inline marks only inside them", () => {
    expect(at("some **bo¦ld** text")).toMatchObject({ bold: true, italic: false });
    expect(at("some **bold**¦ text").bold).toBe(false);
    expect(at("an *it¦alic* word").italic).toBe(true);
    expect(at("~~str¦ike~~").strikethrough).toBe(true);
    expect(at("use `co¦de` here").code).toBe(true);
    expect(at("a [li¦nk](https://x.test)").link).toBe(true);
    expect(at("***bo¦th***")).toMatchObject({ bold: true, italic: true });
  });

  it("detects headings, lists, quotes, code blocks and tables", () => {
    expect(at("## Tit¦le").heading).toBe(2);
    expect(at("Title¦\n===").heading).toBe(1);
    expect(at("plain¦ text").heading).toBe(0);
    expect(at("- it¦em").list).toBe("bullet");
    expect(at("1. it¦em").list).toBe("ordered");
    expect(at("- [ ] ta¦sk").list).toBe("task");
    expect(at("> quo¦ted").quote).toBe(true);
    expect(at("```\nco¦de\n```").codeBlock).toBe(true);
    expect(at("| a | b |\n| - | - |\n| 1¦ | 2 |").table).toBe(true);
  });
});
