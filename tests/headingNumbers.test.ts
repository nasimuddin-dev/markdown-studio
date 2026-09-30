import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { numberHeadings, numberHeadingsCommand, removeHeadingNumbersCommand } from "../src/features/headingNumbers";

const doc = `# Product Spec

Intro.

## Introduction

### Purpose

### Scope

## Requirements

#### Deep

\`\`\`
## not a heading
\`\`\`

Setext heading
--------------
`;

describe("heading numbers", () => {
  it("numbers headings below a lone H1 title, skipping code", () => {
    expect(numberHeadings(doc)).toBe(`# Product Spec

Intro.

## 1. Introduction

### 1.1 Purpose

### 1.2 Scope

## 2. Requirements

#### 2.1.1 Deep

\`\`\`
## not a heading
\`\`\`

3. Setext heading
--------------
`);
  });

  it("updates existing numbers, keeps number-like titles and removes numbers", () => {
    const moved = "## 2. Second\n\n## 1. First\n\n### 1.4 Sub\n\n## 2024 Roadmap\n\n## 10 Tips";
    expect(numberHeadings(moved)).toBe("## 1. Second\n\n## 2. First\n\n### 2.1 Sub\n\n## 3. 2024 Roadmap\n\n## 4. 10 Tips");
    expect(numberHeadings(numberHeadings(moved), true)).toBe("## Second\n\n## First\n\n### Sub\n\n## 2024 Roadmap\n\n## 10 Tips");
    // Several H1s are numbered too; closing hashes stay.
    expect(numberHeadings("# A #\n\n# B")).toBe("# 1. A #\n\n# 2. B");
  });

  it("refreshes the table of contents in the same edit", () => {
    const text = "# T\n\n<!-- toc -->\n- [Old](#old)\n<!-- tocstop -->\n\n## Alpha\n\n## Beta\n";
    const state = EditorState.create({ doc: text });
    let next = state;
    expect(numberHeadingsCommand({ state, dispatch: (tr) => (next = tr.state) })).toBe(true);
    expect(next.doc.toString()).toBe("# T\n\n<!-- toc -->\n- [1. Alpha](#1-alpha)\n- [2. Beta](#2-beta)\n<!-- tocstop -->\n\n## 1. Alpha\n\n## 2. Beta\n");
    let removed = next;
    removeHeadingNumbersCommand({ state: next, dispatch: (tr) => (removed = tr.state) });
    expect(removed.doc.toString()).toBe("# T\n\n<!-- toc -->\n- [Alpha](#alpha)\n- [Beta](#beta)\n<!-- tocstop -->\n\n## Alpha\n\n## Beta\n");
    expect(removeHeadingNumbersCommand({ state: removed, dispatch: () => {} })).toBe(false);
  });
});
