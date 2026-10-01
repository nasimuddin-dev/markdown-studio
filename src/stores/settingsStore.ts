import { applyPolicy, NO_POLICY, parsePolicy, withoutLocked } from "./policy";
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
  showToolbar: true,
  showGitStatus: true,
  explorerShowImages: true,
  syncScroll: true,
  renderMath: true,
  renderDiagrams: true,
  previewRemoteImages: true,
  lintMarkdown: true,
  typewriterScrolling: false,
  dimOtherParagraphs: false,
  closeBrackets: false,
  editorLineLength: 0,
  lintDisabledRules: [],
  spellCheck: true,
  pasteRichTextAsMarkdown: true,
  updateTocOnSave: true,
  checkForUpdates: true,
  restoreSession: true,
  autoSave: "off",
  autoSaveDelayMs: 1000,
  trimTrailingWhitespace: false,
  formatTablesOnSave: false,
  insertFinalNewline: false,
  newFileLineEnding: "lf",
  exportPageSize: "auto",
  customCss: "",
  pageBreakBeforeH1: false,
  imageFolder: "assets",
  askImageName: false,
  aiEnabled: false,
  aiModel: "claude-opus-5-5",
  aiProvider: "claude",
  aiLocalUrl: "http://localhost:11434",
  aiLocalModel: "",
  aiConsent: false,
  keybindings: {},
  wordGoals: {},
  session: { workspace: null, files: [] },
};

/** A shortcut such as "Mod+Shift+K", "Alt+ArrowUp" or "F2". */
export const SHORTCUT = /^((Mod|Ctrl|Shift|Alt)\+){0,4}([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Arrow(Up|Down|Left|Right)|Tab|Enter|Escape|Space|Home|End|PageUp|PageDown|Delete|Backspace|Insert|[-=[\]\\;',./`])$/;

function sanitizeKeybindings(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | null> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>).slice(0, 300)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(id)) continue;
    if (value === null || (typeof value === "string" && SHORTCUT.test(value))) out[id] = value as string | null;
  }
  return out;
}

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

/**
 * The folder name for pasted images: one name without path separators or
 * reserved characters (checked again natively), else "assets".
 */
export function imageFolderName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  return name && name.length <= 64 && name !== "." && name !== ".." && !/[\\/:*?"<>|\u0000-\u001f]/.test(name) ? name : "assets";
}

/** Word goals: paths to whole numbers from 1 to 1,000,000, at most 200 of them. */
function sanitizeWordGoals(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [path, goal] of Object.entries(value).slice(-200)) {
    if (typeof path === "string" && path.length <= 1024 && Number.isInteger(goal) && (goal as number) >= 1 && (goal as number) <= 1_000_000) out[path] = goal as number;
  }
  return out;
}

/** The editor line lengths offered in Settings (0 = full width). */
export const LINE_LENGTHS = [0, 72, 80, 100, 120];

/** Custom CSS beyond this is cut off. */
export const MAX_CUSTOM_CSS = 100_000;

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
    showToolbar: bool(s.showToolbar, d.showToolbar),
    showGitStatus: bool(s.showGitStatus, d.showGitStatus),
    explorerShowImages: bool(s.explorerShowImages, d.explorerShowImages),
    syncScroll: bool(s.syncScroll, d.syncScroll),
    renderMath: bool(s.renderMath, d.renderMath),
    renderDiagrams: bool(s.renderDiagrams, d.renderDiagrams),
    previewRemoteImages: bool(s.previewRemoteImages, d.previewRemoteImages),
    lintMarkdown: bool(s.lintMarkdown, d.lintMarkdown),
    typewriterScrolling: bool(s.typewriterScrolling, d.typewriterScrolling),
    dimOtherParagraphs: bool(s.dimOtherParagraphs, d.dimOtherParagraphs),
    closeBrackets: bool(s.closeBrackets, d.closeBrackets),
    editorLineLength: LINE_LENGTHS.includes(s.editorLineLength as number) ? (s.editorLineLength as number) : d.editorLineLength,
    lintDisabledRules: Array.isArray(s.lintDisabledRules)
      ? [...new Set(s.lintDisabledRules.filter((r): r is string => typeof r === "string" && /^[a-z0-9-]{1,40}$/.test(r)))].slice(0, 50)
      : d.lintDisabledRules,
    spellCheck: bool(s.spellCheck, d.spellCheck),
    pasteRichTextAsMarkdown: bool(s.pasteRichTextAsMarkdown, d.pasteRichTextAsMarkdown),
    updateTocOnSave: bool(s.updateTocOnSave, d.updateTocOnSave),
    checkForUpdates: bool(s.checkForUpdates, d.checkForUpdates),
    restoreSession: bool(s.restoreSession, d.restoreSession),
    autoSave: s.autoSave === "afterDelay" || s.autoSave === "onFocusChange" || s.autoSave === "off" ? s.autoSave : d.autoSave,
    autoSaveDelayMs: clamp(s.autoSaveDelayMs, 200, 60000, d.autoSaveDelayMs),
    trimTrailingWhitespace: bool(s.trimTrailingWhitespace, d.trimTrailingWhitespace),
    formatTablesOnSave: bool(s.formatTablesOnSave, d.formatTablesOnSave),
    insertFinalNewline: bool(s.insertFinalNewline, d.insertFinalNewline),
    newFileLineEnding:
      s.newFileLineEnding === "auto" || s.newFileLineEnding === "lf" || s.newFileLineEnding === "crlf"
        ? s.newFileLineEnding
        : d.newFileLineEnding,
    exportPageSize: s.exportPageSize === "a4" || s.exportPageSize === "letter" || s.exportPageSize === "auto" ? s.exportPageSize : d.exportPageSize,
    customCss: typeof s.customCss === "string" ? s.customCss.slice(0, MAX_CUSTOM_CSS) : d.customCss,
    imageFolder: imageFolderName(s.imageFolder),
    askImageName: bool(s.askImageName, d.askImageName),
    pageBreakBeforeH1: bool(s.pageBreakBeforeH1, d.pageBreakBeforeH1),
    aiEnabled: bool(s.aiEnabled, d.aiEnabled),
    aiModel: typeof s.aiModel === "string" && /^claude-[a-z0-9-]{3,60}$/.test(s.aiModel) ? s.aiModel : d.aiModel,
    aiProvider: s.aiProvider === "ollama" ? "ollama" : "claude",
    // Local models run on this computer only (the native side checks it too).
    aiLocalUrl:
      typeof s.aiLocalUrl === "string" && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?\/?$/.test(s.aiLocalUrl) ? s.aiLocalUrl : d.aiLocalUrl,
    aiLocalModel: typeof s.aiLocalModel === "string" && /^[\w.:/-]{0,100}$/.test(s.aiLocalModel) ? s.aiLocalModel : d.aiLocalModel,
    aiConsent: bool(s.aiConsent, d.aiConsent),
    keybindings: sanitizeKeybindings(s.keybindings),
    wordGoals: sanitizeWordGoals(s.wordGoals),
    session: {
      workspace: typeof session.workspace === "string" ? session.workspace : null,
      files: Array.isArray(session.files) ? session.files.filter((f): f is string => typeof f === "string").slice(0, 50) : [],
    },
  };
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  /** Settings an IT policy has locked; the app can't change them. */
  locked: Array<keyof Settings>;
  /** Defaults set by an IT policy (what "Reset to defaults" returns to). */
  managedDefaults: Partial<Settings>;
  load(): Promise<void>;
  update(patch: Partial<Settings>): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  locked: [],
  managedDefaults: {},
  async load() {
    let raw: unknown = null;
    let policy = NO_POLICY;
    try {
      raw = await backend().loadSettings();
    } catch (e) {
      backend().log("warn", "settings.load", String(e));
    }
    try {
      policy = parsePolicy(await backend().loadPolicy(), sanitizeSettings, DEFAULT_SETTINGS);
    } catch (e) {
      backend().log("warn", "policy.load", String(e));
    }
    set({ settings: applyPolicy(raw, policy, sanitizeSettings, DEFAULT_SETTINGS), locked: policy.locked, managedDefaults: policy.settings, loaded: true });
  },
  update(patch) {
    const settings = sanitizeSettings({ ...get().settings, ...withoutLocked(patch, get().locked) });
    set({ settings });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      backend()
        .saveSettings(get().settings)
        .catch((e) => backend().log("error", "settings.save", String(e)));
    }, 300);
  },
}));
