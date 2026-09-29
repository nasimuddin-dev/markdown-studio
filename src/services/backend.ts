import type {
  AppInfo, AppUpdate, HistoryEntry, OpenPaths, SearchOptions, SearchResult, DirEntry, FileContent, LineEnding, RecentEntry, RecoverySnapshot,
} from "../types";

export type ExportKind = "html";

export interface WriteRequest {
  path: string;
  content: string;
  lineEnding: LineEnding;
  bom: boolean;
  /** mtime from when the file was last read/saved; enables conflict detection. */
  expectedMtime: number | null;
  /** Overwrite even if the file changed on disk. */
  force: boolean;
}

/**
 * Everything the UI needs from the host platform. The Tauri implementation
 * calls validated Rust commands; the in-memory implementation lets the UI run
 * in a plain browser (development, demos, and tests).
 */
export interface Backend {
  readonly isNative: boolean;
  appInfo(): Promise<AppInfo>;

  pickOpenFile(): Promise<string | null>;
  pickOpenFolder(): Promise<string | null>;
  pickSavePath(suggestedName: string, directory: string | null): Promise<string | null>;
  /** Asks for a folder to export into; approves it for writing without opening it. */
  pickExportFolder(): Promise<string | null>;

  /** Native Open dialog for a document to import (desktop only). */
  pickImportFile(kind: "docx" | "html" | "pdf" | "csv"): Promise<string | null>;
  /** Reads an approved file as base64 (desktop only; used by import). */
  readBinaryFile(path: string): Promise<string>;

  listRecent(): Promise<RecentEntry[]>;
  openRecent(path: string): Promise<RecentEntry>;
  removeRecent(path: string): Promise<void>;

  listDir(path: string): Promise<DirEntry[]>;
  readTextFile(path: string): Promise<FileContent>;
  /** Returns the new modification time. */
  writeTextFile(req: WriteRequest): Promise<number>;
  /** Returns `null` if the file no longer exists. */
  fileMtime(path: string): Promise<number | null>;
  createFile(directory: string, name: string): Promise<string>;
  createFolder(directory: string, name: string): Promise<string>;
  /** Creates a subfolder unless it exists; returns its path. */
  ensureFolder(directory: string, name: string): Promise<string>;
  renamePath(path: string, newName: string): Promise<string>;
  deletePath(path: string): Promise<void>;
  /** Markdown and image files under an approved folder (for link completion). */
  listWorkspaceFiles(root: string): Promise<string[]>;
  /** Word, PDF, HTML and CSV/TSV files under the workspace (batch conversion). */
  listConvertibleFiles(root: string): Promise<string[]>;
  /** Searches Markdown files under an approved folder. */
  searchWorkspace(root: string, options: SearchOptions): Promise<SearchResult>;
  /**
   * Saves an image into `assets/` next to a saved document; returns the new
   * file's absolute path. Never overwrites existing files.
   */
  saveImageAsset(docPath: string, fileName: string, dataBase64: string): Promise<string>;
  /** Returns a data: URL for a local image referenced by a document. */
  readImage(path: string): Promise<string>;
  openExternal(url: string): Promise<void>;
  /** Shows a file or folder in the system file manager. */
  revealInFolder(path: string): Promise<void>;
  /**
   * Asks the user where to save an exported file (native Save dialog) and
   * writes it there. Returns the chosen path, or `null` if cancelled.
   */
  exportFile(suggestedName: string, content: string, kind: ExportKind): Promise<string | null>;
  /** Like exportFile, for binary formats (Word .docx, PDF). */
  exportBinaryFile(suggestedName: string, dataBase64: string, kind: "docx" | "pdf"): Promise<string | null>;

  /** Earlier versions of a document kept by local history, newest first. */
  listHistory(path: string): Promise<HistoryEntry[]>;
  readHistory(path: string, id: number): Promise<string>;

  loadSettings(): Promise<unknown>;
  saveSettings(settings: unknown): Promise<void>;
  loadRecovery(): Promise<RecoverySnapshot | null>;
  saveRecovery(snapshot: RecoverySnapshot): Promise<void>;
  clearRecovery(): Promise<void>;

  /** Watches a folder for changes (desktop only); `null` root stops watching. */
  watchWorkspace(root: string | null): Promise<void>;
  /** Subscribes to file-system changes under the watched folder. */
  onFsChanged(handler: (paths: string[]) => void): Promise<() => void>;
  /** Paths the app was launched with (consumed once). */
  takePendingOpens(): Promise<OpenPaths>;
  /** Subscribes to paths opened later (drop, second launch). Returns an unsubscribe function. */
  onOpenPaths(handler: (paths: OpenPaths) => void): Promise<() => void>;

  /** In-app updates (desktop): the newer signed release on GitHub, or null. */
  checkAppUpdate(): Promise<AppUpdate | null>;
  /** Downloads, verifies and installs the update; the app restarts when it's done. */
  installAppUpdate(): Promise<void>;
  onUpdateProgress(handler: (downloaded: number, total: number | null) => void): Promise<() => void>;

  log(level: "error" | "warn" | "info" | "debug", category: string, message: string): void;
  exportLogs(): Promise<string | null>;
}
