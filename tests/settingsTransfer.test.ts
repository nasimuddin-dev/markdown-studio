import { describe, expect, it, vi } from "vitest";
import { MemoryBackend } from "../src/services/memoryBackend";
import { setBackend } from "../src/services";
import { exportSettings, importSettings, parseSettingsExport, settingsExport } from "../src/features/settingsTransfer";
import { DEFAULT_SETTINGS, useSettings } from "../src/stores/settingsStore";
import { useUi } from "../src/stores/uiStore";
import { autoAnswer } from "./helpers";

describe("settings export and import", () => {
  const settings = { ...DEFAULT_SETTINGS, theme: "dark" as const, fontSize: 18, aiConsent: true, keybindings: { save: "Mod+Shift+K" }, session: { workspace: "/private", files: ["/private/a.md"] } };

  it("exports everything but the session and the AI consent", () => {
    const text = settingsExport(settings, new Date("2026-09-29T00:00:00Z"));
    const data = JSON.parse(text);
    expect(data).toMatchObject({ markpion: "settings", version: 1, exportedAt: "2026-09-29T00:00:00.000Z" });
    expect(data.settings).toMatchObject({ theme: "dark", fontSize: 18, keybindings: { save: "Mod+Shift+K" } });
    expect(data.settings.session).toBeUndefined();
    expect(data.settings.aiConsent).toBeUndefined();
  });

  it("reads exports back, validating values and ignoring what isn't there", () => {
    expect(parseSettingsExport(settingsExport(settings))).toMatchObject({ theme: "dark", fontSize: 18, keybindings: { save: "Mod+Shift+K" } });
    const partial = parseSettingsExport(JSON.stringify({ markpion: "settings", version: 1, settings: { theme: "light", fontSize: 999, session: { workspace: "/x" }, aiConsent: true } }));
    expect(partial).toEqual({ theme: "light", fontSize: 40 });
    expect(parseSettingsExport("{}")).toBeNull();
    expect(parseSettingsExport("not json")).toBeNull();
    expect(parseSettingsExport(JSON.stringify({ theme: "dark" }))).toBeNull();
  });

  it("imports after confirmation, keeping the session", async () => {
    const backend = new MemoryBackend({ prompt: () => null });
    setBackend(backend);
    useSettings.setState({ locked: [], managedDefaults: {} });
    useSettings.getState().update({ ...DEFAULT_SETTINGS, session: { workspace: "/mine", files: [] } });
    useUi.setState({ dialogs: [], toasts: [] });
    // The browser demo picks the file with a file input.
    const file = new File([settingsExport(settings)], "markpion-settings.json", { type: "application/json" });
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, "files", { value: [file] });
      this.dispatchEvent(new Event("change"));
    });
    const answered = autoAnswer("import");
    await importSettings();
    answered.stop();
    click.mockRestore();
    expect(answered.titles).toEqual(["Import settings?"]);
    expect(useSettings.getState().settings).toMatchObject({ theme: "dark", fontSize: 18, keybindings: { save: "Mod+Shift+K" }, session: { workspace: "/mine" } });
    await exportSettings();
    expect(JSON.parse((backend as unknown as { lastExport: { content: string } }).lastExport.content).settings.theme).toBe("dark");
  });
});
