---
title: Code Blocks
description: Write inline code and fenced code blocks in Markpion, with syntax highlighting in the editor and preview. Includes the list of highlighted languages and aliases.
---

# Code blocks

## Inline code

Wrap code in single backticks: `` `npm install` `` renders as `npm install`. To include a backtick, use two: ``` `` a`b `` ```. **Ctrl+E** (**Cmd+E**) wraps the selection.

## Fenced code blocks

Put three backticks (or three tildes) on the lines before and after the code, and name the language after the opening fence:

````markdown
```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
```
````

**Format → Code Block** (**Ctrl+Alt+C**) inserts an empty block. Indented code (four spaces) works too, but can't have a language.

## Syntax highlighting

Code is highlighted in two places:

- **In the editor**, the code inside a fenced block is highlighted in its own language, and many languages are supported (the language support loads when first needed).
- **In the preview** and in HTML export, these languages are highlighted:

  `arduino`, `bash`, `c`, `cpp`, `csharp`, `css`, `diff`, `go`, `graphql`, `ini`, `java`, `javascript`, `json`, `kotlin`, `less`, `lua`, `makefile`, `markdown`, `objectivec`, `perl`, `php`, `plaintext`, `python`, `r`, `ruby`, `rust`, `scss`, `shell`, `sql`, `swift`, `typescript`, `vbnet`, `wasm`, `xml` (also HTML) and `yaml`.

  Common aliases work too, such as `js`, `ts`, `py`, `sh`, `html`, `yml`, `c++` and `cs`. A block without a language, or with a language not in the list, is shown as plain monospaced text; the language isn't guessed.

`mermaid` blocks become [diagrams](/markdown/mermaid) instead of code.

## In exports

- **HTML export** keeps the highlighting colours.
- **PDF** and **Word** exports show code blocks in a monospaced font with a shaded background, without colours.
