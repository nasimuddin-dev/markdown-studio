import { create } from "zustand";
import type { Settings } from "../types";
import { backend } from "../services";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  fontSize: 15,
  fontFamily: "",
  lineNumbers: true,
  lineWrapping: true,
  tabSize: 2,
  previewDebounceMs: 150,
  viewMode: "split",
  showExplorer: true,
  showOutline: true,
  syncScroll: true,
  renderMath: true,
  renderDiagrams: true,
  lintMarkdown: true,
  spellCheck: true,
  pasteRichTextAsMarkdown: true,
  updateTocOnSave: true,
  checkForUpdates: true,
  restoreSession: true,
  autoSave: "off",
  autoSaveDelayMs: 1000,
  trimTrailingWhitespace: false,
  insertFinalNewline: false,
  newFileLineEnding: "lf",
  exportPageSize: "auto",
  session: { workspace: null, files: [] },
};

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

/**
 * Merges stored settings over defaults, dropping anything invalid so a damaged
 * or older settings file can never break startup (SRS §12).
 */
export function sanitizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  const bool = (v: unknown, f: boolean) => (typeof v === "boolean" ? v : f);
  const session = (s.session ?? {}) as { workspace?: unknown; files?: unknown };
  return {
    theme: s.theme === "light" || s.theme === "dark" || s.theme === "system" ? s.theme : d.theme,
    fontSize: clamp(s.fontSize, 8, 40, d.fontSize),
    fontFamily: typeof s.fontFamily === "string" ? s.fontFamily.slice(0, 200) : d.fontFamily,
    lineNumbers: bool(s.lineNumbers, d.lineNumbers),
    lineWrapping: bool(s.lineWrapping, d.lineWrapping),
    tabSize: clamp(s.tabSize, 1, 8, d.tabSize),
    previewDebounceMs: clamp(s.previewDebounceMs, 0, 2000, d.previewDebounceMs),
    viewMode: s.viewMode === "editor" || s.viewMode === "preview" || s.viewMode === "split" ? s.viewMode : d.viewMode,
    showExplorer: bool(s.showExplorer, d.showExplorer),
    showOutline: bool(s.showOutline, d.showOutline),
    syncScroll: bool(s.syncScroll, d.syncScroll),
    renderMath: bool(s.renderMath, d.renderMath),
    renderDiagrams: bool(s.renderDiagrams, d.renderDiagrams),
    lintMarkdown: bool(s.lintMarkdown, d.lintMarkdown),
    spellCheck: bool(s.spellCheck, d.spellCheck),
    pasteRichTextAsMarkdown: bool(s.pasteRichTextAsMarkdown, d.pasteRichTextAsMarkdown),
    updateTocOnSave: bool(s.updateTocOnSave, d.updateTocOnSave),
    checkForUpdates: bool(s.checkForUpdates, d.checkForUpdates),
    restoreSession: bool(s.restoreSession, d.restoreSession),
    autoSave: s.autoSave === "afterDelay" || s.autoSave === "onFocusChange" || s.autoSave === "off" ? s.autoSave : d.autoSave,
    autoSaveDelayMs: clamp(s.autoSaveDelayMs, 200, 60000, d.autoSaveDelayMs),
    trimTrailingWhitespace: bool(s.trimTrailingWhitespace, d.trimTrailingWhitespace),
    insertFinalNewline: bool(s.insertFinalNewline, d.insertFinalNewline),
    newFileLineEnding:
      s.newFileLineEnding === "auto" || s.newFileLineEnding === "lf" || s.newFileLineEnding === "crlf"
        ? s.newFileLineEnding
        : d.newFileLineEnding,
    exportPageSize: s.exportPageSize === "a4" || s.exportPageSize === "letter" || s.exportPageSize === "auto" ? s.exportPageSize : d.exportPageSize,
    session: {
      workspace: typeof session.workspace === "string" ? session.workspace : null,
      files: Array.isArray(session.files) ? session.files.filter((f): f is string => typeof f === "string").slice(0, 50) : [],
    },
  };
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    let raw: unknown = null;
    try {
      raw = await backend().loadSettings();
    } catch (e) {
      backend().log("warn", "settings.load", String(e));
    }
    set({ settings: sanitizeSettings(raw), loaded: true });
  },
  update(patch) {
    const settings = sanitizeSettings({ ...get().settings, ...patch });
    set({ settings });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      backend()
        .saveSettings(get().settings)
        .catch((e) => backend().log("error", "settings.save", String(e)));
    }, 300);
  },
}));
