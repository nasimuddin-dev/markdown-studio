import { describe, expect, it } from "vitest";
import { decodeEntities, findAllLinks, fixAllProblems, fixChanges, findHtmlLinks, findLinks, lintLinks, lintMarkdown, maskCode } from "../src/features/lint";

const rules = (text: string) => lintMarkdown(text).map((p) => p.rule);

describe("markdown lint: document rules", () => {
  it("flags duplicate headings, multiple H1s and skipped levels", () => {
    const text = "# A\n\n### Skipped\n\n## B\n\n## B\n\n# Second\n";
    expect(rules(text)).toEqual(["heading-increment", "duplicate-heading", "multiple-h1"]);
  });

  it("checks in-document anchors using GitHub slugs", () => {
    const text = "# Getting Started!\n\n## Install\n\n## Install\n\n[ok](#getting-started) [dup](#install-1) [bad](#nope) <a id=\"custom\"></a> [c](#custom)";
    const problems = lintMarkdown(text).filter((p) => p.rule === "broken-anchor");
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("#nope");
    expect(text.slice(problems[0].from, problems[0].to)).toBe("[bad](#nope)");
  });

  it("flags empty links and images without alt text", () => {
    expect(rules("[x]() ![](a.png) ![ok](b.png)")).toEqual(["empty-link", "image-alt"]);
  });

  it("ignores links inside code", () => {
    const text = "`[x](#missing)`\n\n```\n[y](#missing)\n# not a heading\n```\n";
    expect(lintMarkdown(text)).toEqual([]);
    expect(maskCode("a `b` c")).toBe("a     c");
  });

  it("parses link titles and angle-bracket destinations", () => {
    const links = findLinks('[a](<my file.md> "title") ![i](img.png \'t\')');
    expect(links.map((l) => [l.target, l.image])).toEqual([["my file.md", false], ["img.png", true]]);
  });

  it("finds reference definitions outside code, with where each destination starts", () => {
    const text = 'See [the guide][g] and [a](  b.md).\n\n[g]: docs/guide.md "Guide"\n  [logo]: <img/my logo.png>\n\n```\n[x]: not-a-def.md\n```';
    const links = findAllLinks(text);
    expect(links.map((l) => [l.target, !!l.definition])).toEqual([["b.md", false], ["docs/guide.md", true], ["img/my logo.png", true]]);
    for (const l of links) expect(text.slice(l.targetFrom, l.targetFrom + l.target.length)).toBe(l.target);
  });

  it("finds HTML links and images, with where each destination starts", () => {
    const text = '<p align="center"><img alt="logo.png" width="80" src="logo.png"></p>\n<a href="docs/guide.md#x">Guide</a> <a name="top"></a>\n\n`<img src="code.png">`';
    const links = findHtmlLinks(text);
    expect(links.map((l) => [l.target, l.image])).toEqual([["logo.png", true], ["docs/guide.md#x", false]]);
    for (const l of links) expect(text.slice(l.targetFrom, l.targetFrom + l.target.length)).toBe(l.target);
    expect(links[0].targetFrom).toBe(text.indexOf('src="') + 5);
    // HTML images aren't held to the Markdown alt-text rule; their targets are checked.
    expect(rules('<img src="a.png">\n\n<a href="#nope">x</a>')).toEqual(["broken-anchor"]);
  });

  it("decodes HTML entities in link attributes", async () => {
    expect(decodeEntities("a&amp;b &#39;c&#x27; &lt;&nbsp;&bogus; &#0;")).toBe("a&b 'c' < &bogus; &#0;");
    const text = '<a href="Q&amp;A.md#faq">FAQ</a>';
    const [link] = findHtmlLinks(text);
    expect(link).toMatchObject({ target: "Q&A.md#faq", sourceLength: "Q&amp;A.md#faq".length });
    expect(findHtmlLinks('<a href="a.md">x</a>')[0].sourceLength).toBeUndefined();
    const problems = await lintLinks('# FAQ\n\n<a href="Q&amp;A.md">x</a> <a href="#faq">y</a>', "/ws/p.md", async (p) => p === "/ws/Q&A.md");
    expect(problems).toEqual([]);
  });

  it("flags reference definitions to missing files and anchors", async () => {
    expect(rules("# A\n\n[y][x]\n\n[x]: #nope")).toEqual(["broken-anchor"]);
    const problems = await lintLinks("[ok]: a.md\n[bad]: missing.md", "/ws/p.md", async (p) => p === "/ws/a.md");
    expect(problems.map((p) => p.message)).toEqual(["Linked file not found: missing.md"]);
  });
});

describe("markdown lint: files", () => {
  it("reports missing local files and images, skipping unknown locations and URLs", async () => {
    const present = new Set(["/ws/docs/guide.md", "/ws/img/a.png"]);
    const exists = async (p: string) => (p.startsWith("/other") ? null : present.has(p));
    const text = [
      "[guide](guide.md)",
      "[missing](nope.md)",
      "![a](../img/a.png)",
      "![b](../img/b.png)",
      "[web](https://example.com)",
      "[outside](/other/x.md)",
      "[anchor](#x)",
    ].join("\n");
    const problems = await lintLinks(text, "/ws/docs/page.md", exists);
    expect(problems.map((p) => [p.rule, p.message])).toEqual([
      ["broken-link", "Linked file not found: nope.md"],
      ["missing-image", "Image not found: ../img/b.png"],
    ]);
  });

  it("does nothing for unsaved documents", async () => {
    expect(await lintLinks("[a](b.md)", null, async () => false)).toEqual([]);
  });
});

describe("markdown lint: tables, footnotes and link text", () => {
  const only = (text: string, rule: string) => lintMarkdown(text).filter((p) => p.rule === rule);
  /** Applies the first quick fix offered for `rule`. */
  const applyFix = (text: string, rule: string) => {
    const p = only(text, rule).find((x) => x.fix)!;
    let out = text;
    for (const c of [...fixChanges(p.fix!, p.from, text)].reverse()) out = out.slice(0, c.from) + c.insert + out.slice(c.to);
    return out;
  };

  it("flags table rows that don't match the header, as GFM renders them", () => {
    const table = "| a | b |\n| - | - |\n| 1 | 2 |\n| 1 | 2 | 3 |\n| 1 |\n| `x|y` | z |\n| `x\\|y` | z |";
    const problems = only(table, "table-columns");
    expect(problems.map((p) => table.slice(p.from, p.to))).toEqual(["| 1 | 2 | 3 |", "| 1 |", "| `x|y` | z |"]);
    expect(problems[0].message).toMatch(/3 cells but the table has 2 columns: the extra cells aren't shown/);
    // A line right after the table joins it.
    expect(only("| a |\n| - |\nText right after", "table-columns")[0].message).toMatch(/Add a blank line/);
    expect(only("| a |\n| - |\n\nText after a blank line", "table-columns")).toEqual([]);
    expect(only("| a |\n| - |\n## Heading", "table-columns")).toEqual([]);
    // A header that doesn't match its divider isn't a table.
    expect(only("| a | b |\n| - |\n", "table-columns")[0].message).toMatch(/header has 2 cells but the divider row has 1/);
    // Not tables: a setext heading, and tables inside code.
    expect(only("a | b\n---", "table-columns")).toEqual([]);
    expect(only("```\n| a | b |\n| - | - |\n| 1 |\n```", "table-columns")).toEqual([]);
  });

  it("offers quick fixes that resolve the problem", () => {
    expect(applyFix("| a | b |\n| - | - |\nText", "table-columns")).toBe("| a | b |\n| - | - |\n\nText");
    const padded = applyFix("| a | b | c |\n| - | - | - |\n| 1 |", "table-columns");
    expect(padded).toBe("| a | b | c |\n| - | - | - |\n| 1 |  |  |");
    expect(only(padded, "table-columns")).toEqual([]);
    expect(applyFix("See[^x].", "footnote")).toBe("See[^x].\n\n[^x]: ");
    expect(applyFix("See[^x].\n", "footnote")).toBe("See[^x].\n\n[^x]: ");
    expect(applyFix("# A\n\n### Skipped\n", "heading-increment")).toBe("# A\n\n## Skipped\n");
    expect(only("# A\n\nB\n=\n\nSkipped\n---", "heading-increment")).toEqual([]);
    const typo = "## Installation\n\n## Usage\n\nSee [install](#instalation).";
    expect(only(typo, "broken-anchor")[0].message).toMatch(/Did you mean “#installation”\?/);
    expect(applyFix(typo, "broken-anchor")).toBe("## Installation\n\n## Usage\n\nSee [install](#installation).");
    // No suggestion when nothing is close.
    expect(only("## Usage\n\n[x](#something-else)", "broken-anchor")[0].fix).toBeUndefined();
    // Extra cells, a row without a closing "|", or a header that doesn't match its divider: Fix Table repairs the whole table.
    expect(applyFix("Intro\n\n| a |\n| - |\n| 1 | 2 |\n\nAfter", "table-columns")).toBe("Intro\n\n| a   | Column 2 |\n| --- | -------- |\n| 1   | 2        |\n\nAfter");
    expect(applyFix("| a | b |\n| - | - |\n| 1", "table-columns")).toBe("| a   | b   |\n| --- | --- |\n| 1   |     |");
    const mismatch = "| a | b |\n| - |\n| 1 | 2 |";
    expect(only(mismatch, "table-columns")[0].fix?.label).toBe("Fix Table");
    expect(only(applyFix(mismatch, "table-columns"), "table-columns")).toEqual([]);
  });

  it("flags headings without a space and --- that turns a line into a heading", () => {
    expect(applyFix("#Title\n\ntext", "heading-space")).toBe("# Title\n\ntext");
    expect(applyFix("  ###Setup steps", "heading-space")).toBe("  ### Setup steps");
    // "#123", "#" alone, code and "# Title" aren't flagged.
    expect(only("#123\n\n#\n\n`#x y`\n\n```\n#no space\n```\n\n# Title", "heading-space")).toEqual([]);

    expect(applyFix("Some text\n---\nmore", "setext-heading")).toBe("Some text\n\n---\nmore");
    // Not after a blank line, a list, a table, another rule, or the front matter's closing line.
    expect(only("text\n\n---\n\n- item\n---\n\n| a |\n---\n\n***\n---", "setext-heading")).toEqual([]);
    expect(only("---\ntitle: x\n---\n# Doc", "setext-heading")).toEqual([]);
  });

  it("flags list items without a space and emphasis with spaces inside", () => {
    expect(applyFix("- one\n-two\n- three", "list-space")).toBe("- one\n- two\n- three");
    expect(applyFix("1. one\n2.two", "list-space")).toBe("1. one\n2. two");
    // Not flagged away from a list, for numbers, rules, bold or emphasis at the line start.
    expect(only("-10°C outside\n\n- a\n- b\n3.14 is pi\n\n- a\n**bold** start\n- b\n*Note:* x\n---", "list-space")).toEqual([]);

    expect(applyFix("This is ** bold** text", "emphasis-space")).toBe("This is **bold** text");
    expect(applyFix("Also __ strong __ here", "emphasis-space")).toBe("Also __strong__ here");
    // An escaped backslash before ** keeps it a marker; an escaped ** is text.
    expect(only("**Ctrl+\\\\** then **Cmd+\\\\**", "emphasis-space")).toEqual([]);
    expect(only("\\** not bold \\** here", "emphasis-space")).toEqual([]);
    // Text between two bold spans, code inside bold, arithmetic, snake_case, emphasis and code aren't flagged.
    expect(only("**Ctrl+Z** and **Ctrl+Y**, **Use `x`** now, 2 * 3 * 4, a_b_c, *fine* and `** x **`, snake__case__name", "emphasis-space")).toEqual([]);
  });

  it("flags link and image paths with spaces", () => {
    expect(applyFix("See ![Logo](my logo.png) here", "destination-spaces")).toBe("See ![Logo](<my logo.png>) here");
    expect(applyFix("[Notes](../My Notes.md#top)", "destination-spaces")).toBe("[Notes](<../My Notes.md#top>)");
    // Titles, wrapped paths, encoded spaces and code are fine.
    expect(only('[a](b.md "Title") [c](<d e.md>) [f](g%20h.md) `[x](y z)`', "destination-spaces")).toEqual([]);
    // The fixed link is a real link again (so its target is checked).
    expect(findLinks("![Logo](<my logo.png>)")[0].target).toBe("my logo.png");
  });

  it("fixes all safe problems at once, repeating as fixes reveal new ones", () => {
    const text = "# A\n\n### B\n\n#### C\n\n| a | b |\n| - | - |\n| 1 |\nafter\n\nSee[^x] and[^y] and [c](#b).";
    const { text: fixed, fixed: count } = fixAllProblems(text);
    expect(fixed).toBe("# A\n\n## B\n\n### C\n\n| a | b |\n| - | - |\n| 1 |  |\n\nafter\n\nSee[^x] and[^y] and [c](#b).\n\n[^x]: \n[^y]: ");
    expect(count).toBe(6);
    expect(lintMarkdown(fixed).filter((p) => p.fix)).toEqual([]);
    // Anchor suggestions are guesses, left for a person.
    expect(fixAllProblems("## Setup\n\n[x](#setpu)").fixed).toBe(0);
  });

  it("flags footnotes without a definition and unused definitions", () => {
    const text = "One[^1] two[^Note] three[^missing].\n\n[^1]: First.\n[^note]: Case doesn't matter.\n[^spare]: Unused.";
    expect(only(text, "footnote").map((p) => p.message)).toEqual([
      "Footnote [^missing] has no definition, so it's shown as plain text. Add a line “[^missing]: …”.",
      "Footnote [^spare] is defined but never referenced.",
    ]);
    expect(only("`[^x]` in code", "footnote")).toEqual([]);
  });

  it("flags reference links without a definition and unused definitions", () => {
    const text = "See [the guide][Guide], [Home][] and [short], ![logo][img] and [bad][nope].\n\n[guide]: guide.md\n[home]: /\n[Short]: s.md\n[img]: logo.png\n[spare]: x.md";
    expect(only(text, "reference").map((p) => p.message)).toEqual([
      "Link reference [nope] has no definition, so it's shown as plain text. Add a line “[nope]: address”.",
      "Link definition [spare] is never used.",
    ]);
    // Whitespace in labels matches loosely; code, escapes, footnotes, task boxes and plain brackets aren't references.
    expect(only("[a][two  words]\n\n[Two words]: a.md", "reference")).toEqual([]);
    expect(only("`[a][b]` and \\[a][b] and [^1][^2] and - [x] done and [plain] text", "reference")).toEqual([]);
    // A link inside link text counts as a use.
    expect(only("[![badge][b]](https://example.com)\n\n[b]: b.svg", "reference")).toEqual([]);
  });

  it("adds a missing reference definition at the end, after other definitions", () => {
    const fix = (text: string) => {
      const p = only(text, "reference")[0];
      const changes = fixChanges(p.fix!, p.from, text);
      return changes.reduceRight((t, c) => t.slice(0, c.from) + c.insert + t.slice(c.to), text);
    };
    expect(fix("See [x][Docs].")).toBe("See [x][Docs].\n\n[Docs]: ");
    expect(fix("See [x][b] [y][a].\n\n[a]: a.md\n")).toBe("See [x][b] [y][a].\n\n[a]: a.md\n[b]: ");
  });

  it("flags links without text, but not code or images as text", () => {
    expect(only("[](https://example.com)", "link-text")).toHaveLength(1);
    expect(only("[`code`](a.md) [text](a.md) ![alt](i.png) [![x]](b.md)", "link-text")).toEqual([]);
    expect(only("![`alt`](i.png)", "image-alt")).toEqual([]);
  });
});
