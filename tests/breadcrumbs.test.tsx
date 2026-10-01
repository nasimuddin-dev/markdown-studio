import { describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { headingParents, headingPath, siblingHeadings } from "../src/features/breadcrumbs";
import { extractHeadings } from "../src/features/outline";
import { Breadcrumbs } from "../src/components/Breadcrumbs";
import { newDocument } from "../src/features/documents";
import { commands } from "../src/features/commands";
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from "../src/stores/settingsStore";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

const DOC = [
  "Intro text", // 1
  "# Guide", // 2
  "## Install", // 3
  "### Windows", // 4
  "Steps", // 5
  "### macOS", // 6
  "## Use", // 7
  "#### Deep", // 8 (skips a level: its parent is still Use)
  "# Reference", // 9
  "## API", // 10
].join("\n");

describe("breadcrumb paths", () => {
  const headings = extractHeadings(DOC);
  const parents = headingParents(headings);
  const texts = (ids: number[]) => ids.map((i) => headings[i].text);

  it("finds each heading's parent", () => {
    expect(parents).toEqual([-1, 0, 1, 1, 0, 4, -1, 6]);
  });

  it("gives the heading path of a line, outermost first", () => {
    expect(texts(headingPath(headings, parents, 1))).toEqual([]);
    expect(texts(headingPath(headings, parents, 5))).toEqual(["Guide", "Install", "Windows"]);
    expect(texts(headingPath(headings, parents, 8))).toEqual(["Guide", "Use", "Deep"]);
    expect(texts(headingPath(headings, parents, 10))).toEqual(["Reference", "API"]);
  });

  it("lists the headings at a crumb's level, under the same parent", () => {
    expect(texts(siblingHeadings(parents, -1))).toEqual(["Guide", "Reference"]);
    expect(texts(siblingHeadings(parents, 3))).toEqual(["Windows", "macOS"]);
    expect(texts(siblingHeadings(parents, 1))).toEqual(["Install", "Use"]);
    expect(texts(siblingHeadings(parents, 7))).toEqual(["API"]);
  });
});

describe("breadcrumb bar", () => {
  it("shows the cursor's heading path and lists headings to jump to", async () => {
    setupBackend();
    render(<Breadcrumbs />);
    act(() => {
      newDocument(DOC);
      useUi.getState().setCursor({ line: 5, col: 1, selected: 0 });
    });
    const nav = screen.getByRole("navigation", { name: "Breadcrumbs" });
    const crumbs = within(nav).getAllByRole("button");
    expect(crumbs.map((b) => b.textContent)).toEqual(["Untitled-1.md", "Guide", "Install", "Windows"]);
    expect(crumbs[3]).toHaveAttribute("aria-current", "location");

    await userEvent.click(crumbs[3]);
    const menu = screen.getByRole("menu", { name: "Headings at this level" });
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["• Windows", "macOS"]);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(crumbs[0]);
    expect(within(screen.getByRole("menu", { name: "Top-level headings" })).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["• Guide", "Reference"]);
    await userEvent.keyboard("{Escape}");

    act(() => useUi.getState().setCursor({ line: 1, col: 1, selected: 0 }));
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Untitled-1.md"]);
  });

  it("is a setting with a View menu toggle", () => {
    setupBackend();
    expect(DEFAULT_SETTINGS.showBreadcrumbs).toBe(true);
    expect(sanitizeSettings({ showBreadcrumbs: false }).showBreadcrumbs).toBe(false);
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
    expect(commands.toggleBreadcrumbs.checked?.()).toBe(true);
    void commands.toggleBreadcrumbs.run();
    expect(useSettings.getState().settings.showBreadcrumbs).toBe(false);
    expect(commands.toggleBreadcrumbs.checked?.()).toBe(false);
  });
});
