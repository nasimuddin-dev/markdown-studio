---
title: How to Write a Great README
description: The sections a good README needs, in the order readers look for them, with tips on install instructions, examples and badges, and a copy-paste README template in Markdown.
date: 2026-09-25
---

# How to write a great README

*2026-09-25*

A README is the front page of a project. Most visitors read it for less than a minute, and they're trying to answer three questions: *What is this? Is it for me? How do I start?* A great README answers them in that order, before anything else.

## The sections, in the order readers need them

### 1. Name and one-sentence description

Say what the project does and who it's for, in plain words. "A command-line tool that converts CSV files to Markdown tables" beats "A blazing-fast, next-generation data utility".

### 2. A picture or example

Show it working: a screenshot for an app, a short code sample for a library, or a command and its output for a CLI. One real example explains more than a paragraph of description.

### 3. Installation

Give the exact commands, in code blocks that can be copied:

````markdown
```bash
npm install csv2md
```
````

List the requirements (language version, operating system) before the commands, not after someone has failed.

### 4. Usage

Start with the most common task, end to end. Then link to fuller documentation rather than putting everything in the README.

### 5. Help, contributing and license

Say where to ask questions and report bugs, how to contribute (or link to `CONTRIBUTING.md`), and under which license people can use it.

## Tips

- **Headings are navigation.** GitHub builds a table of contents from them, so keep them short and descriptive.
- **Keep it current.** An install command that no longer works costs more trust than a missing section. Update the README in the same change as the code.
- **Use badges sparingly.** Build status and the latest version are useful; a row of twenty badges is noise.
- **Write alt text** for screenshots, so the README works with screen readers.
- **Link, don't duplicate.** Long reference material belongs in `docs/`, linked from the README.

## A template

````markdown
# Project name

One sentence: what it does and who it's for.

![Screenshot of the main screen](docs/screenshot.png)

## Installation

Requirements: …

```bash
install command
```

## Usage

```bash
the most common command
```

See the [documentation](docs/) for more.

## Contributing

Bug reports and pull requests are welcome. See CONTRIBUTING.md.

## License

MIT (or your license)
````

## Writing READMEs in Markpion

Markpion has a **Project README** template (**File → New from Template…**), a live GitHub-style preview, and a **link check** that finds broken links and missing images before you publish. **Insert / Update Table of Contents** adds a linked contents list for longer READMEs. See [Writing tools](/guide/writing-tools).
