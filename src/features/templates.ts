import { backend } from "../services";
import { basename, isInside, isMarkdownPath, join } from "../services/paths";
import { describeError, toAppError } from "../services/errors";
import { activeDoc, useDocuments } from "../stores/documentsStore";
import { useWorkspace } from "../stores/workspaceStore";
import { notify, promptText } from "../stores/uiStore";
import { newDocument } from "./documents";
import { refreshDir } from "./workspace";
import { getEditorView, requestReveal } from "./editorBridge";

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Built-in text, or a workspace file read on use. */
  body?: string;
  path?: string;
}

/**
 * Placeholders: {{date}} (2026-09-25), {{time}} (14:05), {{datetime}},
 * {{year}}, {{week}} (ISO week number), {{title}} (the template's name) and
 * {{cursor}} (where the cursor starts; removed from the text).
 */
export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Attendees, agenda, decisions and action items",
    body: `# Meeting notes: {{cursor}}

**Date:** {{date}} {{time}}
**Attendees:**

## Agenda

1.

## Notes

## Decisions

-

## Action items

- [ ] Owner: task (due date)
`,
  },
  {
    id: "readme",
    name: "Project README",
    description: "Overview, install, usage, contributing and license",
    body: `# {{cursor}}Project name

One or two sentences on what this project does and who it's for.

## Features

-

## Getting started

### Prerequisites

### Installation

\`\`\`bash

\`\`\`

## Usage

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you would like to change.

## License
`,
  },
  {
    id: "blog",
    name: "Blog post",
    description: "Front matter (title, date, tags) and a draft outline",
    body: `---
title: "{{cursor}}"
date: {{date}}
tags: []
draft: true
---

Opening paragraph: the hook and what the reader will learn.

## Background

## Main point

## Wrapping up
`,
  },
  {
    id: "adr",
    name: "Decision record (ADR)",
    description: "Context, decision, consequences and alternatives",
    body: `# ADR: {{cursor}}

- **Status:** Proposed
- **Date:** {{date}}
- **Deciders:**

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult because of this change?

## Alternatives considered

| Option | Pros | Cons |
| ------ | ---- | ---- |
|        |      |      |
`,
  },
  {
    id: "weekly",
    name: "Weekly status report",
    description: "Highlights, progress, risks and next week's plan",
    body: `# Status report: week {{week}}, {{year}}

**Date:** {{date}}

## Highlights

- {{cursor}}

## Progress

| Workstream | Status | Notes |
| ---------- | ------ | ----- |
|            | On track |     |

## Risks and blockers

> [!WARNING]
> Describe anything that needs attention.

## Next week

- [ ]
`,
  },
  {
    id: "changelog",
    name: "Changelog",
    description: "Keep a Changelog format with an Unreleased section",
    body: `# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- {{cursor}}

### Changed

### Fixed
`,
  },
  {
    id: "journal",
    name: "Daily journal",
    description: "Today's focus, notes and a short reflection",
    body: `# {{date}}

## Today's focus

- [ ] {{cursor}}

## Notes

## Reflection
`,
  },
];

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Fills placeholders; returns the text and the cursor offset ({{cursor}}, else the end). */
export function fillTemplate(body: string, title: string, now = new Date()): { text: string; cursor: number } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const values: Record<string, string> = {
    date,
    time,
    datetime: `${date} ${time}`,
    year: String(now.getFullYear()),
    week: String(isoWeek(now)),
    title,
  };
  const filled = body.replace(/\{\{\s*(date|time|datetime|year|week|title)\s*\}\}/gi, (_, k: string) => values[k.toLowerCase()]);
  const at = filled.search(/\{\{\s*cursor\s*\}\}/i);
  if (at < 0) return { text: filled, cursor: filled.length };
  return { text: filled.replace(/\{\{\s*cursor\s*\}\}/gi, ""), cursor: at };
}

/** Built-in templates plus Markdown files in the workspace's `templates/` folder. */
export async function listTemplates(): Promise<Template[]> {
  const root = useWorkspace.getState().root;
  if (!root) return BUILT_IN_TEMPLATES;
  let files: string[] = [];
  try {
    const dir = join(root, "templates");
    files = (await backend().listWorkspaceFiles(root)).filter((p) => isMarkdownPath(p) && isInside(p, dir));
  } catch {
    // The template list still works without the workspace ones.
  }
  const own: Template[] = files.map((path) => ({
    id: `file:${path}`,
    name: basename(path).replace(/\.(md|markdown)$/i, ""),
    description: "From this folder's templates/",
    path,
  }));
  return [...own, ...BUILT_IN_TEMPLATES];
}

/**
 * File → Save as Template…: copies the active document into the open folder's
 * `templates/` folder (created if needed), so File → New from Template
 * offers it. Placeholders such as {{title}}, {{date}} and {{cursor}} work in it.
 */
export async function saveAsTemplate() {
  const doc = activeDoc();
  const root = useWorkspace.getState().root;
  if (!doc) return;
  if (!root) {
    notify("info", "Open a folder first: templates are kept in its “templates” folder.");
    return;
  }
  const suggested = doc.name.replace(/\.(md|markdown)$/i, "") || "template";
  const name = await promptText({
    title: "Save as Template",
    message: "Save this document in the folder's “templates” folder, to start new documents from it (File → New from Template). You can use {{title}}, {{date}} and {{cursor}} in it.",
    value: `${suggested}.md`,
    okLabel: "Save",
    selectUntil: suggested.length,
  });
  if (!name) return;
  const fileName = /\.(md|markdown)$/i.test(name) ? name : `${name}.md`;
  const b = backend();
  const dir = join(root, "templates");
  try {
    await b.createFolder(root, "templates").catch((e) => {
      if (toAppError(e).kind !== "alreadyExists") throw e;
    });
    const path = await b.createFile(dir, fileName);
    await b.writeTextFile({ path, content: doc.content, lineEnding: doc.lineEnding, bom: false, expectedMtime: null, force: true });
    await refreshDir(root);
    notify("success", `Saved as the template “${fileName.replace(/\.(md|markdown)$/i, "")}”.`);
  } catch (e) {
    notify("error", toAppError(e).kind === "alreadyExists" ? `A template named “${fileName}” already exists.` : describeError(e, "save the template"));
  }
}

/** Built-in snippets, inserted at the cursor (Format → Insert Snippet…). */
export const BUILT_IN_SNIPPETS: Template[] = [
  { id: "snippet:details", name: "Collapsible section", description: "<details> with a summary line", body: "<details>\n<summary>{{cursor}}Summary</summary>\n\nContent\n\n</details>\n" },
  { id: "snippet:kbd", name: "Keyboard key", description: "<kbd>Ctrl</kbd>", body: "<kbd>{{cursor}}</kbd>" },
  { id: "snippet:tasks", name: "Task list", description: "Three open tasks", body: "- [ ] {{cursor}}\n- [ ] \n- [ ] \n" },
];

/** Built-in snippets plus Markdown files in the workspace's `snippets/` folder. */
export async function listSnippets(): Promise<Template[]> {
  const root = useWorkspace.getState().root;
  if (!root) return BUILT_IN_SNIPPETS;
  let files: string[] = [];
  try {
    const dir = join(root, "snippets");
    files = (await backend().listWorkspaceFiles(root)).filter((p) => isMarkdownPath(p) && isInside(p, dir));
  } catch {
    // The built-in snippets still work.
  }
  const own: Template[] = files.map((path) => ({ id: `file:${path}`, name: basename(path).replace(/\.(md|markdown)$/i, ""), description: "From this folder's snippets/", path }));
  return [...own, ...BUILT_IN_SNIPPETS];
}

/** Inserts a snippet at the cursor (replacing the selection), with placeholders filled and the cursor at {{cursor}}. */
export async function insertSnippet(snippet: Template) {
  const view = getEditorView();
  const doc = activeDoc();
  if (!view || !doc) return;
  let body = snippet.body ?? "";
  if (snippet.path) {
    try {
      body = (await backend().readTextFile(snippet.path)).content;
    } catch (e) {
      notify("error", describeError(e, `read the snippet “${snippet.name}”`));
      return;
    }
  }
  const { text, cursor } = fillTemplate(body, doc.name.replace(/\.(md|markdown)$/i, ""));
  const range = view.state.selection.main;
  view.dispatch({ changes: { from: range.from, to: range.to, insert: text }, selection: { anchor: range.from + cursor }, scrollIntoView: true, userEvent: "input" });
  view.focus();
}

/** Opens a new, unsaved document from a template with the cursor at {{cursor}}. */
export async function newFromTemplate(template: Template) {
  let body = template.body ?? "";
  if (template.path) {
    try {
      body = (await backend().readTextFile(template.path)).content;
    } catch (e) {
      notify("error", `Couldn't read the template “${template.name}”: ${(e as Error).message}`);
      return null;
    }
  }
  const { text, cursor } = fillTemplate(body, template.name);
  const id = newDocument(text);
  const before = text.slice(0, cursor).split("\n");
  requestReveal(id, before.length, before[before.length - 1].length, 0);
  useDocuments.getState().setActive(id);
  return id;
}
