/** Sample workspace used when the UI runs in a browser without the native shell. */
export const DEMO_FILES: Record<string, string> = {
  "/demo/README.md": `# Welcome to Markpion

Markpion is a **local-first** Markdown editor with live preview.

> You're running the browser demo. Files here live in your browser only.
> Install the desktop app to edit files on your computer.

## GitHub Flavored Markdown

| Feature        | Supported |
| -------------- | :-------: |
| Tables         |    ✅     |
| Task lists     |    ✅     |
| ~~Strikethrough~~ |  ✅     |
| Autolinks      |    ✅     |

### Task list

- [x] Create a document
- [x] Preview it
- [ ] Save it with **Ctrl/Cmd+S**

### Code

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Links and images

Visit https://tauri.app or read the [guide](docs/guide.md).

![Logo](assets/logo.svg)

Unicode works too: héllo, 世界, 🚀.
`,
  "/demo/docs/guide.md": `# Guide

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| New document | Ctrl/Cmd+N |
| Open file | Ctrl/Cmd+O |
| Open folder | Ctrl/Cmd+Shift+O |
| Save | Ctrl/Cmd+S |
| Save As | Ctrl/Cmd+Shift+S |
| Close tab | Ctrl/Cmd+W |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Find / Replace | Ctrl/Cmd+F / Ctrl/Cmd+H |
| Go to line | Ctrl/Cmd+G |
| Toggle view mode | Ctrl/Cmd+\\\\ |
| Bold / Italic / Link | Ctrl/Cmd+B / I / K |
| Heading 1–6 | Ctrl/Cmd+Alt+1–6 |
| Bulleted / Numbered / Task list | Ctrl/Cmd+Shift+8 / 7 / 9 |
| Toggle file explorer | Ctrl/Cmd+Shift+E |
| Settings | Ctrl/Cmd+, |

[Back to README](../README.md)
`,
  "/demo/docs/security-test.md": `# Unsafe content test

The preview must not run scripts (SEC-004).

<script>alert("xss")</script>

<img src="x" onerror="alert('xss')">

[javascript link](javascript:alert('xss'))

<iframe src="https://example.com"></iframe>

<details><summary>Safe HTML is kept</summary>

This <kbd>Ctrl</kbd> + <kbd>S</kbd> text is inside a sanitized details element.

</details>
`,
  "/demo/docs/diagrams-and-math.md": `# Diagrams and math

## Mermaid

\`\`\`mermaid
flowchart LR
  A[Write Markdown] --> B{Preview}
  B -->|Looks good| C[Save]
  B -->|Needs work| A
\`\`\`

## LaTeX math

Inline: the famous identity $e^{i\\pi} + 1 = 0$.

Display:

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$
`,
  "/demo/notes/todo.md":`# Todo

- [ ] Write release notes
- [ ] Test on Windows, macOS and Linux
`,
  "/demo/assets/logo.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="96" height="96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#9333ea"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><path d="M14 44V18l18 18 18-18v26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 42l5.5 6.5L32 57l-5.5-8.5z" fill="#fff"/><circle cx="32" cy="48.6" r="1.6" fill="#6d3be8"/></svg>`,
};
