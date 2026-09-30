---
title: Math and LaTeX
description: Write mathematical formulas in Markpion with LaTeX syntax, inline with $…$ and as display blocks with $$…$$. Rendering, supported syntax, examples and limitations.
---

# Math / LaTeX

Markpion renders mathematical formulas written in LaTeX syntax, using [KaTeX](https://katex.org). Formulas are converted to MathML, which the system's web engine displays.

**Format → Inline Math** wraps the selection in `$…$`, and **Format → Insert Math Block** puts `$$` lines around it (or starts an empty formula).

## Inline math

Put the formula between single dollar signs:

```markdown
The famous identity $e^{i\pi} + 1 = 0$ links five constants.
```

## Display math

Put the formula between double dollar signs on their own lines:

```markdown
$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$
```

A ` ```math ` code block works too.

## Examples

```markdown
Fractions and roots: $\frac{a}{b}$, $\sqrt{x^2 + y^2}$
Sub- and superscripts: $x_i^2$, $a_{n+1}$
Greek letters: $\alpha, \beta, \Gamma, \pi$
Sums and limits: $\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$, $\lim_{x \to 0} \frac{\sin x}{x} = 1$

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
\qquad
f(x) = \begin{cases} x & x \ge 0 \\ -x & x < 0 \end{cases}
$$
```

The [Mermaid page](/markdown/mermaid) has a screenshot of math in the preview.

## Supported syntax

KaTeX supports most of LaTeX's **math mode**: fractions, roots, operators, Greek letters, accents, matrices, `cases`, `aligned` and similar environments, and `\text{…}` inside formulas. The full list is in [KaTeX's supported functions](https://katex.org/docs/supported). Text-mode LaTeX (documents, packages, `\usepackage`) isn't supported; this is math inside Markdown.

## Limitations and tips

- **Dollar signs in text.** Because `$` starts math, a sentence like "costs $5 or $10" can be read as a formula. Escape the dollar signs: `\$5`.
- **Errors** don't break the preview: a formula KaTeX can't parse is shown as its source, in red.
- **Appearance** depends on your system's MathML support, so formulas can look slightly different on Windows, macOS and Linux.
- To show formulas as plain text, turn off **Settings → Preview → Render LaTeX math**.

## Export

| Export | Formulas |
| --- | --- |
| Export as HTML | Rendered |
| Print / Save as PDF | Rendered, as in the preview |
| Export as Word | Native Word equations you can edit in Word (fractions, roots, scripts, sums, integrals, limits, brackets, Greek letters and operators). A formula using anything else, such as a matrix or an `aligned` environment, keeps its LaTeX text |
| Export as PDF | Display formulas (`$$…$$`) are drawn as sharp pictures on Windows. Inline formulas (`$…$`) are set as text, because PDF text can't flow around pictures: variables in italics, real superscripts and subscripts, fractions as a/b and roots as √. A formula that needs a symbol the built-in font lacks (arrows such as `\to`, set symbols such as `\subset` or `\in`), a script inside a script, or a matrix stays as LaTeX text. On macOS, and possibly Linux, the system web engine doesn't allow drawing formulas to a picture, so display formulas stay as LaTeX too |

For a PDF with every formula rendered on any system, use **Print / Save as PDF**.
