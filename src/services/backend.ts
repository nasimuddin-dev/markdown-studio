import type {
  AiStatus, AppInfo, AppUpdate, GitStatus, HistoryEntry, OpenPaths, SearchOptions, SearchResult, DirEntry, FileContent, LineEnding, RecentEntry, RecoverySnapshot,
} from "../types";

/**
 * The host platform, as the UI sees it.
 *
 * The UI never touches files, dialogs or the network itself; it goes through
 * this interface, which is split by domain so each part can be implemented
 * (and replaced) on its own:
 *
 * - `tauriBackend`: the desktop app. Calls validated, scope-checked Rust commands.
 * - `MemoryBackend`: an in-memory implementation for the browser demo and tests.
 * - A future web/cloud version would add a third implementation (an HTTP API
 *   with accounts and server-side storage) behind the same interface, and
 *   declare in `capabilities` what it can't do (e.g. reveal in a folder).
 *
 * Paths are opaque strings to the UI: native paths on the desktop, virtual
 * POSIX paths in the demo, and could be document IDs or URLs in a cloud backend.
 */

export type ExportKind = "html" | "json";

export interface WriteRequest {
  path: string;
  content: string;
  lineEnding: LineEnding;
  bom: boolean;
  /**
   * The version the edit is based on (the file's modification time as last
   * read or saved; a cloud backend can use a revision number or ETag). A save
   * is refused if the stored version differs, unless `force` is set.
   */
  expectedMtime: number | null;
  /** Overwrite even if the file changed since it was read. */
  force: boolean;
}

/** What a backend can do; the UI hides or adapts features that aren't available. */
export interface BackendCapabilities {
  /** The installed desktop app (native dialogs, OS integration, file associations). */
  desktop: boolean;
  /** Deleting moves items to the system Trash / Recycle Bin, so it can be undone. */
  trash: boolean;
  /** Can show a file in the system file manager. */
  revealInFolder: boolean;
  /** Can download and install new versions itself. */
  selfUpdate: boolean;
  /** Has native Open dialogs and binary reads for importing Word/PDF/HTML/CSV files. */
  nativeImport: boolean;
  /** The optional AI assistant can be used. */
  ai: boolean;
}

/** Native pickers. Each approves the chosen location for the app's later use. */
export interface DialogsApi {
  pickOpenFile(): Promise<string | null>;
  pickOpenFolder(): Promise<string | null>;
  pickSavePath(suggestedName: string, directory: string | null): Promise<string | null>;
  /** Asks for a folder to export into; approves it for writing without opening it. */
  pickExportFolder(): Promise<string | null>;
  /** Native Open dialog for a document to import (desktop only). */
  pickImportFile(kind: "docx" | "html" | "pdf" | "csv" | "json" | "image"): Promise<string | null>;
}

/** Reading and writing documents, folders and assets in approved locations. */
export interface FilesApi {
  listDir(path: string): Promise<DirEntry[]>;
  readTextFile(path: string): Promise<FileContent>;
  /** Returns the new modification time (version). */
  writeTextFile(req: WriteRequest): Promise<number>;
  /** Returns `null` if the file no longer exists. */
  fileMtime(path: string): Promise<number | null>;
  createFile(directory: string, name: string): Promise<string>;
  createFolder(directory: string, name: string): Promise<string>;
  /** Creates a subfolder unless it exists; returns its path. */
  ensureFolder(directory: string, name: string): Promise<string>;
  /** Moves a file or folder into `directory`, keeping its name; returns the new path. */
  movePath(path: string, directory: string): Promise<string>;
  renamePath(path: string, newName: string): Promise<string>;
  deletePath(path: string): Promise<void>;
  /** Reads an approved file as base64 (desktop only; used by import). */
  readBinaryFile(path: string): Promise<string>;
  /** Returns a data: URL for a local image referenced by a document. */
  readImage(path: string): Promise<string>;
  /**
   * Saves an image into `assets/` next to a saved document; returns the new
   * file's absolute path. Never overwrites existing files.
   */
  saveImageAsset(docPath: string, fileName: string, dataBase64: string): Promise<string>;
  /**
   * Asks the user where to save an exported file (native Save dialog) and
   * writes it there. Returns the chosen path, or `null` if cancelled.
   */
  exportFile(suggestedName: string, content: string, kind: ExportKind): Promise<string | null>;
  /** Like exportFile, for binary formats (Word .docx, PDF). */
  exportBinaryFile(suggestedName: string, dataBase64: string, kind: "docx" | "pdf"): Promise<string | null>;
}

/** Folder-wide operations for the open workspace. */
export interface WorkspaceApi {
  /** Markdown and image files under an approved folder (for link completion). */
  listWorkspaceFiles(root: string): Promise<string[]>;
  /** Git branch and changed files of the repository containing `root`; null without Git or a repository. */
  gitStatus(root: string): Promise<GitStatus | null>;
  /** Word, PDF, HTML and CSV/TSV files under the workspace (batch conversion). */
  listConvertibleFiles(root: string): Promise<string[]>;
  /** Searches Markdown files under an approved folder. */
  searchWorkspace(root: string, options: SearchOptions): Promise<SearchResult>;
  /** Watches a folder for changes (desktop only); `null` root stops watching. */
  watchWorkspace(root: string | null): Promise<void>;
  /** Subscribes to changes under the watched folder. */
  onFsChanged(handler: (paths: string[]) => void): Promise<() => void>;
}

/** The app's own data: settings, recent items, crash recovery and file history. */
export interface StorageApi {
  loadSettings(): Promise<unknown>;
  saveSettings(settings: unknown): Promise<void>;
  /** Managed settings set by an IT administrator (read-only), or `null`. */
  loadPolicy(): Promise<unknown>;
  listRecent(): Promise<RecentEntry[]>;
  openRecent(path: string): Promise<RecentEntry>;
  removeRecent(path: string): Promise<void>;
  loadRecovery(): Promise<RecoverySnapshot | null>;
  saveRecovery(snapshot: RecoverySnapshot): Promise<void>;
  clearRecovery(): Promise<void>;
  /** Earlier versions of a document kept by local history, newest first. */
  listHistory(path: string): Promise<HistoryEntry[]>;
  readHistory(path: string, id: number): Promise<string>;
}

/** The app itself and the operating system around it. */
export interface PlatformApi {
  appInfo(): Promise<AppInfo>;
  openExternal(url: string): Promise<void>;
  /** Shows a file or folder in the system file manager. */
  revealInFolder(path: string): Promise<void>;
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
  /** Shows `title` in the window's title bar (the page title is set separately). */
  setWindowTitle(title: string): Promise<void>;
  toggleFullScreen(): Promise<void>;
  /**
   * Protects unsaved work when the window closes. The desktop app asks
   * `canClose` (which may show Save / Don't Save) and stays open if it
   * returns false; a browser can only warn, when `hasUnsaved` is true.
   */
  guardClose(canClose: () => Promise<boolean>, hasUnsaved: () => boolean): Promise<void>;
}

export interface AiRequest {
  model: string;
  system: string;
  prompt: string;
}

/** The optional AI assistant. The API key never passes through the UI after it's saved. */
export interface AiApi {
  aiStatus(): Promise<AiStatus>;
  /** Checks and stores the Anthropic API key, or removes it (`null`). */
  aiSetKey(key: string | null): Promise<AiStatus>;
  /**
   * Sends one request to Claude. `onText` receives the answer as it's
   * written; the whole answer is returned at the end, or `null` if `signal`
   * aborted the request (which stops it, so the rest isn't generated).
   */
  aiComplete(request: AiRequest, onText?: (text: string) => void, signal?: AbortSignal): Promise<string | null>;
}

export interface Backend extends DialogsApi, FilesApi, WorkspaceApi, StorageApi, PlatformApi, AiApi {
  readonly capabilities: BackendCapabilities;
}
