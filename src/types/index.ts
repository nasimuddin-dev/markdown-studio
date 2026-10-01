export type LineEnding = "lf" | "crlf";

/** Git state of the open folder's repository (read-only). */
export interface GitStatus {
  /** The branch, or null on a detached HEAD. */
  branch: string | null;
  ahead: number;
  behind: number;
  /** Changed files: M modified, A added, D deleted, R renamed, U untracked, C conflict. */
  files: Array<{ path: string; status: string }>;
}

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
  /** The file can't be written (read-only attribute or permissions). */
  readOnly?: boolean;
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
  /** The formatting toolbar above the editor. */
  showToolbar: boolean;
  /** Show Git branch and file status (runs `git status` in the open folder). */
  showGitStatus: boolean;
  /** List pictures in the Explorer, besides Markdown files. */
  explorerShowImages: boolean;
  syncScroll: boolean;
  renderMath: boolean;
  renderDiagrams: boolean;
  /** Show pictures from the web (http/https) in the preview. Off: a placeholder, so no request leaves the computer. */
  previewRemoteImages: boolean;
  lintMarkdown: boolean;
  /** Keep the cursor's line vertically centred while typing. */
  typewriterScrolling: boolean;
  /** Dim every paragraph except the one with the cursor. */
  dimOtherParagraphs: boolean;
  /** Type the closing ), ], } or ` along with the opening one. */
  closeBrackets: boolean;
  /** Editor text width in characters, centered (0 = the full width of the pane). */
  editorLineLength: number;
  /** Lint checks (rule ids) turned off with "Don't Show This Check". */
  lintDisabledRules: string[];
  spellCheck: boolean;
  pasteRichTextAsMarkdown: boolean;
  updateTocOnSave: boolean;
  checkForUpdates: boolean;
  restoreSession: boolean;
  autoSave: AutoSaveMode;
  autoSaveDelayMs: number;
  trimTrailingWhitespace: boolean;
  /** Align every table when saving (as Format Table does). */
  formatTablesOnSave: boolean;
  insertFinalNewline: boolean;
  newFileLineEnding: "auto" | LineEnding;
  /** Paper size for PDF and Word export; "auto" follows the system region. */
  exportPageSize: "auto" | "a4" | "letter";
  /** Extra CSS for rendered documents (preview, print, slides, HTML export), scoped to the document. */
  customCss: string;
  /** PDF, Word and printing: each top-level heading after the first starts a new page. */
  pageBreakBeforeH1: boolean;
  /** Folder (one name, next to the document) for pasted, dropped and inserted images. */
  imageFolder: string;
  /** Ask for a file name when pasting a screenshot (else a timestamp). */
  askImageName: boolean;
  /** The optional AI assistant (off until turned on and given an API key). */
  aiEnabled: boolean;
  aiModel: string;
  /** Claude (Anthropic, with an API key) or a local model through Ollama. */
  aiProvider: "claude" | "ollama";
  /** The local Ollama server (this computer only). */
  aiLocalUrl: string;
  /** The Ollama model to use, e.g. "llama3.2:latest". */
  aiLocalModel: string;
  /** Set once the user has accepted that AI commands send text to Anthropic. */
  aiConsent: boolean;
  /** Changed keyboard shortcuts: command id → shortcut ("Mod+Shift+K"), or null for none. */
  keybindings: Record<string, string | null>;
  /** Word count goals by document path (Set Word Count Goal…). */
  wordGoals: Record<string, number>;
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
  /**
   * Editing is locked: "file" when the file is read-only on disk, "user" when
   * turned on with Toggle Read-Only. Unset when the document can be edited.
   */
  readOnly?: "file" | "user";
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
  /** Comma-separated globs: only matching files are searched (see `services/pathFilter.ts`). */
  include?: string;
  /** Comma-separated globs: matching files are skipped. */
  exclude?: string;
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
