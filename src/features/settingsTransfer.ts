import { backend } from "../services";
import { describeError } from "../services/errors";
import { sanitizeSettings, useSettings } from "../stores/settingsStore";
import { ask, notify } from "../stores/uiStore";
import type { Settings } from "../types";

/**
 * Export and import of the user's preferences and shortcuts as a JSON file,
 * for moving to another computer or sharing a team setup. The last session
 * and the AI consent are personal and never exported or imported.
 */

const SETTINGS_FILE_NAME = "markpion-settings.json";

/** The file's content: a marker, a format version and the settings. */
export function settingsExport(settings: Settings, now = new Date()): string {
  const { session: _session, aiConsent: _consent, ...portable } = settings;
  return JSON.stringify({ markpion: "settings", version: 1, exportedAt: now.toISOString(), settings: portable }, null, 2) + "\n";
}

/** Reads an exported file; `null` if it isn't a Markpion settings file. */
export function parseSettingsExport(text: string): Partial<Settings> | null {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return null;
  }
  const d = data as { markpion?: unknown; settings?: unknown };
  if (!d || typeof d !== "object" || d.markpion !== "settings" || !d.settings || typeof d.settings !== "object") return null;
  const given = d.settings as Record<string, unknown>;
  // Validated like the settings file; only keys present in the export are taken.
  const valid = sanitizeSettings(given);
  const out: Partial<Settings> = {};
  for (const key of Object.keys(valid) as Array<keyof Settings>) {
    if (key === "session" || key === "aiConsent" || !Object.hasOwn(given, key)) continue;
    (out as Record<string, unknown>)[key] = valid[key];
  }
  return out;
}

export async function exportSettings() {
  try {
    const saved = await backend().exportFile(SETTINGS_FILE_NAME, settingsExport(useSettings.getState().settings), "json");
    if (saved) notify("success", `Settings exported to ${saved}`);
  } catch (e) {
    notify("error", describeError(e, "export the settings"));
  }
}

/** Asks for a settings file (native dialog, or a file input in the browser demo). */
async function readSettingsFile(): Promise<string | null> {
  const b = backend();
  if (b.capabilities.nativeImport) {
    const path = await b.pickImportFile("json");
    return path ? (await b.readTextFile(path)).content : null;
  }
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
  return file ? file.text() : null;
}

export async function importSettings() {
  try {
    const text = await readSettingsFile();
    if (text === null) return;
    const imported = parseSettingsExport(text);
    if (!imported) {
      notify("error", "That file isn't a Markpion settings export.");
      return;
    }
    const choice = await ask({
      title: "Import settings?",
      message: `This replaces ${Object.keys(imported).length} settings, including keyboard shortcuts, with the ones in the file. Your open folder and files are kept.`,
      buttons: [
        { id: "cancel", label: "Cancel" },
        { id: "import", label: "Import", variant: "primary" },
      ],
      cancelId: "cancel",
    });
    if (choice !== "import") return;
    // Settings an IT policy locks keep their managed values (update() skips them).
    useSettings.getState().update(imported);
    notify("success", "Settings imported.");
  } catch (e) {
    notify("error", describeError(e, "import the settings"));
  }
}
