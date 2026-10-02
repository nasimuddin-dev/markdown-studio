import { describe, expect, it } from "vitest";
import { escapeLatex, markdownToLatex } from "../src/services/convert/toLatex";

const body = (tex: string) => tex.slice(tex.indexOf("\\begin{document}"), tex.indexOf("\\end{document}"));

describe("LaTeX export", () => {
  it("escapes LaTeX's special characters in text", () => {
    expect(escapeLatex("50% of $5 & #1_a ^ ~ {x} \\ <a|b>")).toBe(
      "50\\% of \\$5 \\& \\#1\\_a \\textasciicircum{} \\textasciitilde{} \\{x\\} \\textbackslash{} \\textless{}a\\textbar{}b\\textgreater{}",
    );
    expect(markdownToLatex("Costs 50% & more.")).toContain("Costs 50\\% \\& more.");
  });

  it("makes a complete document with the title and author from the front matter", () => {
    const tex = markdownToLatex("---\ntitle: My Paper\nauthor: Ada Lovelace\n---\n\n# Introduction\n\nText.");
    expect(tex).toMatch(/^% Exported from Markpion/);
    expect(tex).toContain("\\documentclass{article}");
    expect(tex).toContain("\\title{My Paper}");
    expect(tex).toContain("\\author{Ada Lovelace}");
    expect(tex).toContain("\\maketitle");
    expect(tex).toContain("\\section{Introduction}\\label{introduction}");
    expect(tex.trimEnd().endsWith("\\end{document}")).toBe(true);
  });

  it("uses a lone top heading as the title, and the next level as sections", () => {
    const tex = markdownToLatex("# Report\n\n## Background\n\n### Detail\n\nText.");
    expect(tex).toContain("\\title{Report}");
    expect(body(tex)).not.toContain("Report}\\label");
    expect(tex).toContain("\\section{Background}\\label{background}");
    expect(tex).toContain("\\subsection{Detail}\\label{detail}");
  });

  it("keeps math as written", () => {
    const tex = markdownToLatex("Euler: $e^{i\\pi} + 1 = 0$.\n\n$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$");
    expect(tex).toContain("Euler: $e^{i\\pi} + 1 = 0$.");
    expect(tex).toContain("\\[\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n\\]");
    expect(tex).toContain("\\usepackage{amsmath}");
  });

  it("converts formatting, links, lists, tasks, quotes, alerts and code", () => {
    const tex = markdownToLatex(
      [
        "# A", "", "## Part", "",
        "**Bold**, *italic*, ~~gone~~, `x_1`, [site](https://example.com/a%20b#top) and [back](#part).", "",
        "1. one", "2. two", "", "- [x] done", "- [ ] open", "",
        "> [!WARNING]", "> Careful.", "",
        "```js", "const a = {b: 1};", "```", "", "---",
      ].join("\n"),
    );
    expect(tex).toContain("\\textbf{Bold}, \\emph{italic}, \\sout{gone}, \\texttt{x\\_1}");
    expect(tex).toContain("\\usepackage[normalem]{ulem}");
    expect(tex).toContain("\\href{https://example.com/a\\%20b\\#top}{site}");
    expect(tex).toContain("\\hyperref[part]{back}");
    expect(tex).toContain("\\begin{enumerate}\n\\item one\n\\item two\n\\end{enumerate}");
    expect(tex).toContain("\\item[$\\boxtimes$] done\n\\item[$\\square$] open");
    expect(tex).toContain("\\begin{quote}\n\\textbf{Warning:} Careful.\n\\end{quote}");
    expect(tex).toContain("\\begin{verbatim}\nconst a = {b: 1};\n\\end{verbatim}");
    expect(tex).toContain("\\rule{\\linewidth}{0.4pt}");
  });

  it("makes tables with booktabs, aligned like the Markdown", () => {
    const tex = markdownToLatex("| Name | Score |\n| :--- | ---: |\n| Ada | 99 |\n| Bob & co | 7 |");
    expect(tex).toContain("\\usepackage{longtable}");
    expect(tex).toContain("\\begin{longtable}{lr}\n\\toprule\nName & Score \\\\\n\\midrule\n\\endhead\nAda & 99 \\\\\nBob \\& co & 7 \\\\\n\\bottomrule\n\\end{longtable}");
  });

  it("turns footnotes into \\footnote and reference links into links", () => {
    const tex = markdownToLatex("Claim[^1] and [docs][d].\n\n[^1]: Source: *Book*, 2020.\n\n[d]: https://example.com/docs");
    expect(tex).toContain("Claim\\footnote{Source: \\emph{Book}, 2020.} and \\href{https://example.com/docs}{docs}.");
  });

  it("puts a picture on its own in a figure, and a web picture becomes a link", () => {
    const tex = markdownToLatex("![The setup](images/my%20setup.png)\n\nInline ![logo](https://example.com/l.png) here.");
    expect(tex).toContain("\\usepackage{graphicx}");
    expect(tex).toContain("\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=\\linewidth,height=0.8\\textheight,keepaspectratio]{images/my setup.png}\n\\caption*{The setup}\n\\end{figure}");
    expect(tex).toContain("Inline \\href{https://example.com/l.png}{logo} here.");
  });

  // CI compiles these with pdflatex (the .github/workflows/ci.yml "latex" job sets LATEX_OUT).
  it("writes sample documents for compiling", async () => {
    const samples: Record<string, string> = {
      plain: "Just a paragraph with 50% & $x_1$.",
      // As LaTeX with Pictures writes it: a diagram drawn to a PNG, and an SVG picture pointed at its PNG copy.
      pictures: "# Pictures\n\n```mermaid\ngraph LR\n  A --> B\n```\n\n![Logo](pic.svg)\n",
      rich: [
        "---", "title: Sample Paper", "author: Markpion", "---", "",
        "# Introduction", "", "Text with **bold**, *italic*, ~~struck~~, `code_1`, a [link](https://example.com/?a=1&b=2#x), a footnote[^1] and [a reference](#methods).", "",
        "## Methods", "", "1. first", "2. second", "   - nested", "", "- [x] done", "- [ ] open", "",
        "> [!NOTE]", "> An alert with *emphasis*.", "",
        "| Left | Centre | Right |", "| :--- | :---: | ---: |", "| a | b & c | 1 |", "| 50% | $x^2$ | 2 |", "",
        "```python", "print(\"{braces} and \\\\backslash\")", "```", "", "$$", "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}", "$$", "",
        "![A picture](pic.png)", "", "Line one  ", "line two.", "", "---", "", "[^1]: The footnote, with `code`.", "",
      ].join("\n"),
    };
    const out = process.env.LATEX_OUT;
    for (const [name, markdown] of Object.entries(samples)) {
      const tex = name === "pictures" ? markdownToLatex(markdown, { svgAsPng: true, diagram: () => "pic.png" }) : markdownToLatex(markdown);
      expect(tex).toContain("\\end{document}");
      if (out) {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(out, { recursive: true });
        writeFileSync(`${out}/${name}.tex`, tex);
        // The picture the rich sample shows: a 1×1 PNG.
        writeFileSync(`${out}/pic.png`, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
      }
    }
  });

  it("draws Mermaid diagrams as figures when given a picture for them, and points SVG pictures at their PNG copies", () => {
    const md = "```mermaid\ngraph LR\n  A --> B\n```\n\n```mermaid\nbroken\n```\n\n![Logo](images/logo.svg)\n";
    const tex = markdownToLatex(md, { svgAsPng: true, diagram: (code) => (code.startsWith("graph") ? "images/diagram-1.png" : null) });
    expect(tex).toContain("\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=\\linewidth,height=0.8\\textheight,keepaspectratio]{images/diagram-1.png}\n\\end{figure}");
    // A diagram without a picture (it couldn't be drawn) stays as its code.
    expect(tex).toContain("\\begin{verbatim}\nbroken\n\\end{verbatim}");
    expect(tex).toContain("{images/logo.png}");
    expect(tex).not.toContain("logo.svg");
    // Without the options, nothing changes.
    expect(markdownToLatex(md)).toContain("\\begin{verbatim}\ngraph LR");
    expect(markdownToLatex(md)).toContain("{images/logo.svg}");
  });

  it("gives just the converted text for pasting (Copy as LaTeX)", () => {
    expect(markdownToLatex("# Results\n\nIt is **$x^2$**.", { bodyOnly: true })).toBe("\\section{Results}\\label{results}\n\nIt is \\textbf{$x^2$}.\n");
  });

  it("leaves math alone when math is off", () => {
    expect(markdownToLatex("Price: $5 and $6", { math: false })).toContain("Price: \\$5 and \\$6");
  });
});
