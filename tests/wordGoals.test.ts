import { describe, expect, it } from "vitest";
import { onPathRenamed } from "../src/features/documents";
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from "../src/stores/settingsStore";

describe("word count goals", () => {
  it("keep only whole numbers from 1 to 1,000,000", () => {
    expect(sanitizeSettings({ wordGoals: { "/a.md": 500, "/b.md": 0, "/c.md": 2.5, "/d.md": "9", "/e.md": 2_000_000 } }).wordGoals).toEqual({ "/a.md": 500 });
    expect(sanitizeSettings({ wordGoals: [1, 2] }).wordGoals).toEqual({});
  });

  it("follow files that are renamed or moved", () => {
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, wordGoals: { "/ws/docs/a.md": 800, "/ws/other.md": 100 } } });
    onPathRenamed("/ws/docs", "/ws/guides");
    expect(useSettings.getState().settings.wordGoals).toEqual({ "/ws/guides/a.md": 800, "/ws/other.md": 100 });
  });
});
