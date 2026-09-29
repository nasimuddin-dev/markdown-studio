export type LineEnding = "lf" | "crlf";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  /** Modification time in ms since epoch, used for external-change detection. */
  mtime: number;
  lineEnding: LineEnding;
  bom: boolean;
}

export interface RecentEntry {
  path: string;
  kind: "file" | "folder";
}

/** A newer signed release found by the in-app updater. */
export interface AppUpdate {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export interface AppInfo {
  version: string;
  os: string;
  arch: string;
  logPath: string;
}

export type ErrorKind =
  | "notFound"
  | "permissionDenied"
  | "outOfScope"
  | "invalidPath"
  | "encoding"
  | "conflict"
  | "alreadyExists"
  | "diskFull"
  | "tooLarge"
  | "io"
  | "ai";

/** The AI assistant's setup, as reported by the backend. */
export interface AiStatus {
  hasKey: boolean;
  /** Where the key is kept, e.g. "Windows Credential Manager". */
  keyStorage: string;
  /** Models to offer, the default first. */
  models: string[];
}

export type AutoSaveMode = "off" | "afterDelay" | "onFocusChange";
export type ViewMode = "editor" | "split" | "preview";
export type ThemePreference = "system" | "light" | "dark";

export interface Settings {
  theme: ThemePreference;
  fontSize: number;
  fontFamily: string;
  lineNumbers: boolean;
  lineWrapping: boolean;
  tabSize: number;
  previewDebounceMs: number;
  viewMode: ViewMode;
  showExplorer: boolean;
  showOutline: boolean;
  syncScroll: boolean;
  renderMath: boolean;
  renderDiagrams: boolean;
  lintMarkdown: boolean;
  spellCheck: boolean;
  pasteRichTextAsMarkdown: boolean;
  updateTocOnSave: boolean;
  checkForUpdates: boolean;
  restoreSession: boolean;
  autoSave: AutoSaveMode;
  autoSaveDelayMs: number;
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
  newFileLineEnding: "auto" | LineEnding;
  /** Paper size for PDF and Word export; "auto" follows the system region. */
  exportPageSize: "auto" | "a4" | "letter";
  /** The optional AI assistant (off until turned on and given an API key). */
  aiEnabled: boolean;
  aiModel: string;
  /** Set once the user has accepted that AI commands send text to Anthropic. */
  aiConsent: boolean;
  /** Last session's workspace and open files, restored on launch (FR-003). */
  session: { workspace: string | null; files: string[] };
}

export type ExternalChange = "modified" | "deleted" | null;

export interface Doc {
  id: string;
  /** `null` for a new, never-saved document. */
  path: string | null;
  name: string;
  content: string;
  /** Content as last loaded/saved; the document is dirty when it differs. */
  savedContent: string;
  lineEnding: LineEnding;
  bom: boolean;
  mtime: number | null;
  externalChange: ExternalChange;
  saving: boolean;
}

export interface RecoverySnapshot {
  savedAt: number;
  docs: Array<Pick<Doc, "path" | "name" | "content" | "lineEnding" | "bom" | "mtime">>;
}

/** Files and folders the OS asked the app to open (launch args, drop, second instance). */
export interface OpenPaths {
  files: string[];
  folders: string[];
}

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  maxResults?: number;
}

/** Positions are UTF-16 offsets (JavaScript string indices). */
export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  preview: string;
  previewStart: number;
}

export interface SearchResult {
  files: Array<{ path: string; matches: SearchMatch[] }>;
  totalMatches: number;
  filesSearched: number;
  truncated: boolean;
}

export interface HistoryEntry {
  /** Time (ms since epoch) this version was replaced by a save. */
  id: number;
  size: number;
}
