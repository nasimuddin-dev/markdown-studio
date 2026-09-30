import { describe, expect, it } from "vitest";
import { formatAllTables } from "../src/features/tables";
import { applySaveTransforms } from "../src/features/saveTransforms";

describe("aligning every table", () => {
  const text = ["# Doc", "", "|a|bb|", "|-|:-:|", "|ccc|d|", "", "text | with a pipe", "", "```", "|x|y|", "|-|-|", "```", "", "> |q|r|", "> |-|-|"].join("\n");

  it("formats the tables and leaves code, plain text with pipes and invalid tables alone", () => {
    expect(formatAllTables(text)).toBe(
      ["# Doc", "", "| a   | bb  |", "| --- | :-: |", "| ccc |  d  |", "", "text | with a pipe", "", "```", "|x|y|", "|-|-|", "```", "", "> |q|r|", "> |-|-|"].join("\n"),
    );
  });

  it("runs on save only when the setting is on", () => {
    const off = { trimTrailingWhitespace: false, insertFinalNewline: false };
    expect(applySaveTransforms("|a|b|\n|-|-|", off)).toBe("|a|b|\n|-|-|");
    expect(applySaveTransforms("|a|b|\n|-|-|", { ...off, formatTablesOnSave: true })).toBe("| a   | b   |\n| --- | --- |");
  });
});
