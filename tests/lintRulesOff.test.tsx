import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { fixAllProblems, LINT_RULES, lintMarkdown } from "../src/features/lint";
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from "../src/stores/settingsStore";
import { useUi } from "../src/stores/uiStore";
import { setupBackend } from "./helpers";

describe("turning lint checks off", () => {
  it("names every rule the lint can report", () => {
    const text = "# A\n\n# A\n\n#### Deep\n\n#Oops\n\n![](x.png) [](y.md) [x](#nope) [e]()\n\nSee[^n].\n\n| a | b |\n| - | - |\n| 1 |\n\n- a\n-b\n\n** bold**\n\n![p](my pic.png)\n\ntext\n---";
    for (const rule of new Set(lintMarkdown(text).map((p) => p.rule))) expect(LINT_RULES[rule], rule).toBeTruthy();
    expect(Object.keys(LINT_RULES)).toContain("broken-link");
  });

  it("keeps only valid rule ids in the setting", () => {
    expect(sanitizeSettings({ lintDisabledRules: ["image-alt", "image-alt", 5, "Bad Rule!"] }).lintDisabledRules).toEqual(["image-alt"]);
    expect(sanitizeSettings({ lintDisabledRules: "x" }).lintDisabledRules).toEqual([]);
  });

  it("skips turned-off checks in Fix All Problems", () => {
    expect(fixAllProblems("#Title", new Set(["heading-space"])).fixed).toBe(0);
    expect(fixAllProblems("#Title").text).toBe("# Title");
  });

  it("lists turned-off checks in Settings, with Show Again", async () => {
    setupBackend();
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, lintDisabledRules: ["image-alt", "heading-increment"] } });
    render(<SettingsDialog />);
    act(() => useUi.getState().setSettingsOpen(true));
    expect(screen.getByText("Images without alt text")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show again: Images without alt text" }));
    expect(useSettings.getState().settings.lintDisabledRules).toEqual(["heading-increment"]);
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
  });
});
