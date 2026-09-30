import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import * as fmt from "../src/features/formatting";
import { editorKeymap } from "../src/features/commands";

/** Builds a state from text where `|` marks the cursor and `[` `]` mark a selection. */
function stateOf(marked: string) {
  const from = marked.indexOf("[");
  if (from >= 0 && !marked.includes("|")) {
    const to = marked.indexOf("]") - 1;
    const doc = marked.replace("[", "").replace("]", "");
    return EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  }
  const cursor = marked.indexOf("|");
  return EditorState.create({ doc: marked.replace("|", ""), selection: EditorSelection.cursor(cursor) });
}

function run(marked: string, command: StateCommand) {
  const s = fmt.applyCommand(stateOf(marked), command);
  const r = s.selection.main;
  return { doc: s.doc.toString(), selected: s.sliceDoc(r.from, r.to), cursor: r.head };
}

describe("inline formatting", () => {
  it("wraps a selection and keeps it selected", () => {
    expect(run("say [hello] now", fmt.toggleBold)).toMatchObject({ doc: "say **hello** now", selected: "hello" });
    expect(run("[x]", fmt.toggleItalic).doc).toBe("*x*");
    expect(run("[gone]", fmt.toggleStrikethrough).doc).toBe("~~gone~~");
    expect(run("[a()]", fmt.toggleInlineCode).doc).toBe("`a()`");
  });

  it("unwraps when the markers surround the selection", () => {
    expect(run("say **[hello]** now", fmt.toggleBold)).toMatchObject({ doc: "say hello now", selected: "hello" });
    expect(run("say [**hello**] now", fmt.toggleBold)).toMatchObject({ doc: "say hello now", selected: "hello" });
  });

  it("inserts an empty pair with the cursor inside", () => {
    expect(run("a | b", fmt.toggleBold)).toMatchObject({ doc: "a **** b", cursor: 4 });
  });
});

describe("links", () => {
  it("wraps text and selects the URL placeholder", () => {
    expect(run("see [docs]", fmt.insertLink)).toMatchObject({ doc: "see [docs](https://)", selected: "https://" });
  });
  it("wraps a URL and puts the cursor in the label", () => {
    expect(run("[https://tauri.app]", fmt.insertLink)).toMatchObject({ doc: "[](https://tauri.app)", cursor: 1 });
  });
  it("inserts a placeholder link with the label selected", () => {
    expect(run("|", fmt.insertLink)).toMatchObject({ doc: "[link text](https://)", selected: "link text" });
  });
});

describe("headings", () => {
  it("sets, changes and removes heading levels", () => {
    expect(run("Ti|tle", fmt.setHeading(2)).doc).toBe("## Title");
    expect(run("# Ti|tle", fmt.setHeading(3)).doc).toBe("### Title");
    expect(run("## Ti|tle", fmt.setHeading(2)).doc).toBe("Title");
    expect(run("### Ti|tle", fmt.setHeading(0)).doc).toBe("Title");
  });

  it("promotes and demotes selected headings within H1-H6", () => {
    expect(run("### Ti|tle", fmt.promoteHeading).doc).toBe("## Title");
    expect(run("### Ti|tle", fmt.demoteHeading).doc).toBe("#### Title");
    expect(run("# Ti|tle", fmt.promoteHeading).doc).toBe("# Title");
    expect(run("###### Ti|tle", fmt.demoteHeading).doc).toBe("###### Title");
    expect(run("[## A\ntext\n### B]", fmt.demoteHeading).doc).toBe("### A\ntext\n#### B");
  });

  it("leaves non-heading lines alone", () => {
    const state = stateOf("plain |text");
    expect(fmt.promoteHeading({ state, dispatch: () => {} })).toBe(false);
    expect(run("#hashtag|", fmt.demoteHeading).doc).toBe("#hashtag");
  });
});

describe("line prefixes", () => {
  it("toggles bullet lists across several lines", () => {
    expect(run("[a\nb]", fmt.toggleBulletList).doc).toBe("- a\n- b");
    expect(run("[- a\n- b]", fmt.toggleBulletList).doc).toBe("a\nb");
  });

  it("numbers ordered lists and converts between list kinds", () => {
    expect(run("[a\nb\nc]", fmt.toggleOrderedList).doc).toBe("1. a\n2. b\n3. c");
    expect(run("[- a\n- b]", fmt.toggleOrderedList).doc).toBe("1. a\n2. b");
    expect(run("[1. a\n2. b]", fmt.toggleTaskList).doc).toBe("- [ ] a\n- [ ] b");
    expect(run("- [x] a|", fmt.toggleTaskList).doc).toBe("a");
  });

  it("preserves indentation and skips blank lines", () => {
    expect(run("[  a\n\n  b]", fmt.toggleQuote).doc).toBe("  > a\n\n  > b");
  });
});

describe("blocks", () => {
  it("inserts a code block around the selection on its own lines", () => {
    expect(run("[let x = 1;]", fmt.insertCodeBlock).doc).toBe("```\nlet x = 1;\n```\n");
    expect(run("intro|", fmt.insertCodeBlock).doc).toBe("intro\n\n```\n```\n");
  });

  it("inserts a table with the first header selected", () => {
    const r = run("|", fmt.insertTable);
    expect(r.doc).toContain("| Column 1 | Column 2 |");
    expect(r.selected).toBe("Column 1");
  });
});

describe("editor keymap", () => {
  it("derives CodeMirror key names from menu shortcuts", () => {
    const keys = editorKeymap().map((k) => k.key).filter(Boolean);
    expect(keys).toEqual(expect.arrayContaining(["Mod-b", "Mod-i", "Mod-k", "Mod-Shift-x", "Mod-Alt-1", "Mod-Shift-8", "Mod-Alt-c", "Mod-Alt-=", "Mod-Alt--", "Mod-Enter", "Mod-Alt-r"]));
  });
});

describe("tasks and footnotes", () => {
  it("checks and unchecks tasks on the selected lines", () => {
    expect(run("- [ ] bu|y milk", fmt.toggleTaskCheck).doc).toBe("- [x] buy milk");
    expect(run("  * [X] do|ne", fmt.toggleTaskCheck).doc).toBe("  * [ ] done");
    expect(run("> 1. [ ] quo|ted", fmt.toggleTaskCheck).doc).toBe("> 1. [x] quoted");
    // Mixed selection: everything becomes checked first.
    const doc = "- [x] a\n- [ ] b\nplain";
    const all = EditorState.create({ doc, selection: EditorSelection.single(0, doc.length) });
    const checked = fmt.applyCommand(all, fmt.toggleTaskCheck).doc.toString();
    expect(checked).toBe("- [x] a\n- [x] b\nplain");
    const again = EditorState.create({ doc: checked, selection: EditorSelection.single(0, doc.length) });
    expect(fmt.applyCommand(again, fmt.toggleTaskCheck).doc.toString()).toBe("- [ ] a\n- [ ] b\nplain");
  });

  it("falls through on lines that aren't tasks", () => {
    const state = stateOf("- plain |item");
    expect(fmt.toggleTaskCheck({ state, dispatch: () => {} })).toBe(false);
  });

  it("inserts numbered footnotes with their definitions at the end", () => {
    const first = run("Claim| here.", fmt.insertFootnote);
    expect(first.doc).toBe("Claim[^1] here.\n\n[^1]: ");
    expect(first.cursor).toBe(first.doc.length);
    const second = run("A[^1] and B|.\n\n[^1]: one\n", fmt.insertFootnote);
    expect(second.doc).toBe("A[^1] and B[^2].\n\n[^1]: one\n[^2]: ");
    expect(run("Text|\n", fmt.insertFootnote).doc).toBe("Text[^1]\n\n[^1]: ");
  });
});

describe("insert text", () => {
  it("replaces the selection or inserts at the cursor", () => {
    expect(run("Due: |", fmt.insertText(() => "2026-09-30"))).toMatchObject({ doc: "Due: 2026-09-30", cursor: 15 });
    expect(run("Due: [soon]!", fmt.insertText(() => "today")).doc).toBe("Due: today!");
  });
});

describe("callouts", () => {
  it("inserts an alert, with the cursor ready for its text", () => {
    const r = run("|", fmt.insertCallout("NOTE"));
    expect(r.doc).toBe("> [!NOTE]\n> \n");
    expect(r.cursor).toBe("> [!NOTE]\n> ".length);
  });

  it("quotes the selected text under the alert", () => {
    expect(run("[Back up first.\n\nThen update.]", fmt.insertCallout("WARNING")).doc).toBe("> [!WARNING]\n> Back up first.\n>\n> Then update.\n");
  });
});
