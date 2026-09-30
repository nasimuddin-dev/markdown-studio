import { describe, expect, it } from "vitest";
import { diffLines, pairedWordDiffs, wordDiff, type Segment } from "../src/features/diff";

const show = (segments: Segment[]) => segments.map((s) => (s.changed ? `[${s.text}]` : s.text)).join("");

describe("word differences within a changed line", () => {
  it("marks the words that differ", () => {
    const d = wordDiff("The quick brown fox jumps.", "The quick red fox jumped!")!;
    expect(show(d.old)).toBe("The quick [brown] fox [jumps.]");
    expect(show(d.new)).toBe("The quick [red] fox [jumped!]");
  });

  it("handles words added at either end and non-Latin text", () => {
    expect(show(wordDiff("Install the app", "Please install the app now")!.new)).toBe("[Please install] the app[ now]");
    expect(show(wordDiff("Привет мир и всё", "Привет новый мир и всё")!.new)).toBe("Привет [новый ]мир и всё");
  });

  it("gives up on lines that share too little, or are too long", () => {
    expect(wordDiff("completely different words here", "nothing alike at all")).toBeNull();
    expect(wordDiff("a b c", "a b d", 4)).toBeNull();
    expect(wordDiff("", "text")).toBeNull();
  });
});

describe("pairing changed lines", () => {
  it("pairs removed and added lines in order, leaving unpaired and dissimilar lines whole", () => {
    const lines = diffLines("# Title\nOne two three.\nFour five six.\nkeep\nold only\n", "# Title\nOne 2 three.\nFour five seven.\nExtra line.\nkeep\nsomething else entirely\n")!;
    const words = pairedWordDiffs(lines);
    const marked = lines.filter((l) => words.has(l)).map((l) => `${l.kind} ${show(words.get(l)!)}`);
    expect(marked).toEqual(["del One [two] three.", "del Four five [six].", "add One [2] three.", "add Four five [seven]."]);
  });
});
