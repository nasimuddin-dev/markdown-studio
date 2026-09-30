import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { applyChanges, convertToInlineLinks, convertToReferenceLinks, toInlineLinks, toReferenceLinks } from "../src/features/referenceLinks";
import { lintMarkdown } from "../src/features/lint";

const toRef = (text: string, from?: number, to?: number) => applyChanges(text, toReferenceLinks(text, from, to));
const toInline = (text: string, from?: number, to?: number) => applyChanges(text, toInlineLinks(text, from, to));

describe("converting links to reference style", () => {
  it("numbers new definitions, reuses equal ones and keeps titles and <addresses>", () => {
    const text = 'See [the guide](docs/guide.md "Guide"), ![logo](img/logo.png) and [again](docs/guide.md "Guide").\n[Other](<my file.md>) and [home](https://example.com).\n\n[1]: https://example.com\n';
    expect(toRef(text)).toBe(
      'See [the guide][2], ![logo][3] and [again][2].\n[Other][4] and [home][1].\n\n[1]: https://example.com\n[2]: docs/guide.md "Guide"\n[3]: img/logo.png\n[4]: <my file.md>\n',
    );
  });

  it("adds the definitions after a blank line, and only converts links inside the range", () => {
    const text = "[a](a.md) and [b](b.md)";
    expect(toRef(text)).toBe("[a][1] and [b][2]\n\n[1]: a.md\n[2]: b.md\n");
    expect(toRef(text, 10)).toBe("[a](a.md) and [b][1]\n\n[1]: b.md\n");
  });

  it("leaves code, empty links and link text untouched", () => {
    expect(toReferenceLinks("`[a](b.md)` and\n\n```\n[c](d.md)\n```\n[empty]()")).toEqual([]);
    expect(toRef("[`code` **bold**](x.md)")).toBe("[`code` **bold**][1]\n\n[1]: x.md\n");
  });

  it("gives a document with no problems from the lint", () => {
    const result = toRef("# Doc\n\nSee [a](a.md) and [b](#doc).\n");
    expect(lintMarkdown(result).filter((p) => p.rule === "reference")).toEqual([]);
  });
});

describe("converting links to inline style", () => {
  it("converts full, collapsed and shortcut references and removes unused definitions", () => {
    const text = 'See [the guide][Guide], [Home][] and [home], ![logo][img] or [x] text.\n\n[guide]: docs/guide.md "Guide"\n[home]: <my home.md>\n[img]: logo.png\n';
    expect(toInline(text)).toBe('See [the guide](docs/guide.md "Guide"), [Home](<my home.md>) and [home](<my home.md>), ![logo](logo.png) or [x] text.\n');
  });

  it("keeps a definition that references outside the range still use", () => {
    const text = "[a][r] and [b][r]\n\n[r]: r.md\n";
    expect(toInline(text, 0, 6)).toBe("[a](r.md) and [b][r]\n\n[r]: r.md\n");
  });

  it("round-trips", () => {
    const text = 'Read [one](1.md "One") and ![two](2.png).\n';
    expect(toInline(toRef(text))).toBe(text);
  });
});

describe("link conversion commands", () => {
  const run = (command: typeof convertToReferenceLinks, doc: string, anchor = 0, head = anchor) => {
    let state = EditorState.create({ doc, selection: { anchor, head } });
    const ran = command({ state, dispatch: (tr) => (state = tr.state) });
    return ran ? state.doc.toString() : null;
  };

  it("work on the selection, or the whole document", () => {
    expect(run(convertToReferenceLinks, "[a](a.md) [b](b.md)")).toBe("[a][1] [b][2]\n\n[1]: a.md\n[2]: b.md\n");
    expect(run(convertToReferenceLinks, "[a](a.md) [b](b.md)", 0, 9)).toBe("[a][1] [b](b.md)\n\n[1]: a.md\n");
    expect(run(convertToInlineLinks, "[a][1]\n\n[1]: a.md\n")).toBe("[a](a.md)\n");
    expect(run(convertToInlineLinks, "no links")).toBeNull();
  });
});

describe("removing definitions", () => {
  it("keeps text after the definitions, and the document's ending", () => {
    expect(toInline("[a][r]\n\n[r]: r.md\n\nMore text.\n")).toBe("[a](r.md)\n\n\nMore text.\n");
    expect(toInline("[a][r]\n\n[r]: r.md\n[s]: s.md\n")).toBe("[a](r.md)\n\n[s]: s.md\n");
    expect(toInline("[r]: r.md\n[a][r]")).toBe("[a](r.md)");
  });
});
