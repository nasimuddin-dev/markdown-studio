import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryBackend } from "../src/services/memoryBackend";
import { setBackend } from "../src/services";
import { applyPolicy, parsePolicy } from "../src/stores/policy";
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from "../src/stores/settingsStore";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { useUi } from "../src/stores/uiStore";

const parse = (raw: unknown) => parsePolicy(raw, sanitizeSettings, DEFAULT_SETTINGS);

describe("managed settings policy", () => {
  it("keeps valid settings and known locks only", () => {
    const policy = parse({
      settings: { aiEnabled: false, exportPageSize: "letter", fontSize: 999, theme: "neon", session: { workspace: "/x", files: [] }, bogus: 1 },
      locked: ["aiEnabled", "session", "bogus", 7, "aiEnabled"],
    });
    expect(policy.settings).toEqual({ aiEnabled: false, exportPageSize: "letter" });
    expect(policy.locked).toEqual(["aiEnabled"]);
    expect(parse(null)).toEqual({ settings: {}, locked: [] });
    expect(parse("garbage")).toEqual({ settings: {}, locked: [] });
  });

  it("uses policy values as defaults, user choices over them, and locks over everything", () => {
    const policy = parse({ settings: { exportPageSize: "letter", aiEnabled: false, checkForUpdates: false }, locked: ["aiEnabled", "lineNumbers"] });
    const s = applyPolicy({ exportPageSize: "a4", aiEnabled: true, lineNumbers: false }, policy, sanitizeSettings, DEFAULT_SETTINGS);
    expect(s.exportPageSize).toBe("a4"); // the user's own choice
    expect(s.checkForUpdates).toBe(false); // policy default
    expect(s.aiEnabled).toBe(false); // locked to the policy value
    expect(s.lineNumbers).toBe(DEFAULT_SETTINGS.lineNumbers); // locked without a value: built-in default
  });

  it("applies the policy on load, refuses changes to locked settings, and shows them as managed", async () => {
    setBackend(new MemoryBackend({ policy: { settings: { aiEnabled: false, exportPageSize: "letter" }, locked: ["aiEnabled"] }, prompt: () => null }));
    await act(() => useSettings.getState().load());
    expect(useSettings.getState().settings).toMatchObject({ aiEnabled: false, exportPageSize: "letter" });
    act(() => useSettings.getState().update({ aiEnabled: true, exportPageSize: "a4" }));
    expect(useSettings.getState().settings).toMatchObject({ aiEnabled: false, exportPageSize: "a4" });
    act(() => useUi.getState().setSettingsOpen(true));
    render(<SettingsDialog />);
    expect(screen.getByRole("note")).toHaveTextContent("managed by your organization");
    expect(screen.getByRole("checkbox", { name: /Turn on AI commands/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Show line numbers/ })).toBeEnabled();
    // Reset returns to the organization's defaults.
    act(() => screen.getByRole("button", { name: /Reset/ }).click());
    expect(useSettings.getState().settings.exportPageSize).toBe("letter");
  });

  it("changes nothing without a policy", async () => {
    setBackend(new MemoryBackend({ prompt: () => null }));
    await act(() => useSettings.getState().load());
    expect(useSettings.getState().locked).toEqual([]);
    expect(useSettings.getState().settings).toEqual(DEFAULT_SETTINGS);
  });
});
