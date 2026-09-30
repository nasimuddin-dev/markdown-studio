import type { AiRequest, Backend, WriteRequest } from "./backend";
import { AppError } from "./errors";
import { basename, dirname, isMarkdownPath, join } from "./paths";
import type { AppUpdate, DirEntry, GitStatus, OpenPaths, RecentEntry, RecoverySnapshot, SearchOptions, SearchResult } from "../types";
import { buildSearchRegex, searchText } from "./search";
import { pathFilter, relativeTo } from "./pathFilter";
import { DEMO_FILES } from "./demoContent";

interface MemFile {
  content: string;
  mtime: number;
}

export interface MemoryBackendOptions {
  /** Initial files keyed by absolute POSIX path. Folders are implied. */
  files?: Record<string, string>;
  /** Persist the virtual filesystem to localStorage under this key. */
  storageKey?: string | null;
  /** Answers native-dialog requests (defaults to `window.prompt`). */
  prompt?: (message: string, defaultValue: string) => string | null;
  /** What Git status reports (tests); the demo has none. */
  git?: GitStatus;
  /** Files that are read-only "on disk" (tests). */
  readOnly?: string[];
  /** Committed text per file path, as Git would report it (tests). */
  gitHead?: Record<string, string>;
  /** Folders that are pre-approved (as if opened via a dialog). */
  approved?: string[];
  /**
   * Stands in for Claude in tests. Without it the browser demo has no AI
   * assistant: the API key belongs in the desktop app's credential store.
   */
  ai?: (request: AiRequest) => Promise<string>;
  /** A managed-settings policy, as an IT administrator would set it (tests). */
  policy?: unknown;
}

const AI_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"];
const AI_DESKTOP_ONLY = "The AI assistant is available in the Markpion desktop app, which keeps your API key in the system's credential store.";

const STORAGE_PREFIX = "markpion:";

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Browser/in-memory implementation of {@link Backend}. It mirrors the native
 * backend's rules (approved scope, no `..` traversal, conflict detection) so
 * UI behaviour can be developed and tested without the Tauri shell.
 */
export class MemoryBackend implements Backend {
  readonly capabilities;
  private files = new Map<string, MemFile>();
  private dirs = new Set<string>(["/"]);
  private roots = new Set<string>();
  private allowedFiles = new Set<string>();
  private recents: RecentEntry[] = [];
  private settings: unknown = null;
  private recovery: RecoverySnapshot | null = null;
  private clock = Date.now();
  private readonly storageKey: string | null;
  private readonly promptFn: (message: string, defaultValue: string) => string | null;
  private readonly aiFn: MemoryBackendOptions["ai"];
  private aiKey: string | null = null;
  private readonly policy: unknown;
  private readonly git: GitStatus | null;
  private readonly gitHead: Record<string, string>;
  private readonly readOnlyFiles: Set<string>;
  readonly logs: string[] = [];

  constructor(opts: MemoryBackendOptions = {}) {
    this.storageKey = opts.storageKey ?? null;
    this.promptFn = opts.prompt ?? ((m, d) => window.prompt(m, d));
    this.aiFn = opts.ai;
    this.policy = opts.policy ?? null;
    this.git = opts.git ?? null;
    this.gitHead = opts.gitHead ?? {};
    this.readOnlyFiles = new Set(opts.readOnly ?? []);
    this.capabilities = { desktop: false, trash: false, revealInFolder: false, selfUpdate: false, nativeImport: false, ai: !!opts.ai };
    if (!this.restore()) {
      for (const [path, content] of Object.entries(opts.files ?? {})) this.put(path, content);
    }
    for (const dir of opts.approved ?? []) {
      this.roots.add(dir);
      this.dirs.add(dir);
    }
  }

  // ------------------------------------------------------------ internals

  private tick() {
    this.clock = Math.max(this.clock + 1, Date.now());
    return this.clock;
  }

  private put(path: string, content: string) {
    this.files.set(path, { content, mtime: this.tick() });
    let dir = dirname(path);
    while (dir && !this.dirs.has(dir)) {
      this.dirs.add(dir);
      dir = dirname(dir);
    }
  }

  private persist() {
    const store = safeStorage();
    if (!store || !this.storageKey) return;
    try {
      store.setItem(
        STORAGE_PREFIX + this.storageKey,
        JSON.stringify({
          files: Object.fromEntries(this.files),
          dirs: [...this.dirs],
          recents: this.recents,
          settings: this.settings,
          recovery: this.recovery,
        }),
      );
    } catch {
      /* quota exceeded or storage blocked: keep working in memory */
    }
  }

  private restore(): boolean {
    const store = safeStorage();
    if (!store || !this.storageKey) return false;
    try {
      const raw = store.getItem(STORAGE_PREFIX + this.storageKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.files = new Map(Object.entries(data.files ?? {}));
      this.dirs = new Set(data.dirs ?? ["/"]);
      this.recents = data.recents ?? [];
      this.settings = data.settings ?? null;
      this.recovery = data.recovery ?? null;
      return true;
    } catch {
      return false;
    }
  }

  private validate(path: string): string {
    if (!path.startsWith("/")) throw new AppError("invalidPath", "Path must be absolute");
    if (path.split("/").includes("..")) {
      throw new AppError("invalidPath", 'Path traversal ("..") is not allowed');
    }
    return path.length > 1 ? path.replace(/\/+$/, "") : path;
  }

  private check(path: string): string {
    const p = this.validate(path);
    const inRoot = [...this.roots].some((r) => p === r || p.startsWith(r + "/"));
    if (!inRoot && !this.allowedFiles.has(p)) {
      throw new AppError("outOfScope", "This location has not been opened in Markpion.");
    }
    return p;
  }

  private remember(path: string, kind: RecentEntry["kind"]) {
    this.recents = [{ path, kind }, ...this.recents.filter((r) => r.path !== path)].slice(0, 15);
    this.persist();
  }

  private validateName(name: string) {
    const n = name.trim();
    if (!n || n === "." || n === ".." || /[\\/:*?"<>|\0]/.test(n)) {
      throw new AppError("invalidPath", "Name contains characters that are not allowed in file names");
    }
    return n;
  }

  // ------------------------------------------------------------ Backend

  async appInfo() {
    return { version: "0.20.0", os: "browser", arch: "web", logPath: "(in memory)" };
  }

  async pickOpenFile() {
    const answer = this.promptFn("Open file (path in the demo workspace):", "/demo/README.md");
    if (!answer) return null;
    const p = this.validate(answer.trim());
    if (!this.files.has(p)) throw new AppError("notFound", "File not found");
    this.allowedFiles.add(p);
    this.remember(p, "file");
    return p;
  }

  async pickOpenFolder(startDir?: string) {
    const answer = this.promptFn("Open folder:", startDir ?? "/demo");
    if (!answer) return null;
    const p = this.validate(answer.trim());
    if (!this.dirs.has(p)) throw new AppError("notFound", "Folder not found");
    this.roots.add(p);
    this.remember(p, "folder");
    return p;
  }

  async loadPolicy() {
    return this.policy;
  }

  async aiStatus() {
    return { hasKey: !!this.aiKey, keyStorage: "memory (tests)", models: AI_MODELS };
  }

  async aiSetKey(key: string | null) {
    if (!this.aiFn) throw new AppError("ai", AI_DESKTOP_ONLY);
    if (key !== null && !key.trim().startsWith("sk-ant-")) throw new AppError("ai", "That doesn't look like an Anthropic API key.");
    this.aiKey = key?.trim() ?? null;
    return this.aiStatus();
  }

  async aiComplete(request: AiRequest, onText?: (text: string) => void, signal?: AbortSignal) {
    if (!this.aiFn) throw new AppError("ai", AI_DESKTOP_ONLY);
    if (!this.aiKey) throw new AppError("ai", "Add your Anthropic API key in Settings → AI Assistant first.");
    const answer = await this.aiFn(request);
    if (signal?.aborted) return null;
    // Streams the stand-in answer word by word, like the real one.
    for (const piece of answer.match(/\S+\s*|\s+/g) ?? []) onText?.(piece);
    return answer;
  }

  // Browser host: the same behaviour a web version would have.
  async setWindowTitle() {
    /* The page title is the window title in a browser. */
  }

  async toggleFullScreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.().catch(() => {});
  }

  async guardClose(_canClose: () => Promise<boolean>, hasUnsaved: () => boolean) {
    // A browser can't show the app's own dialog when a tab closes; it can only warn.
    window.addEventListener("beforeunload", (e) => {
      if (hasUnsaved()) e.preventDefault();
    });
  }

  async pickExportFolder() {
    const answer = this.promptFn("Export to folder:", "/export");
    if (!answer) return null;
    const p = this.validate(answer.trim());
    if (this.files.has(p)) throw new AppError("invalidPath", "That is a file, not a folder");
    // Like choosing a new folder in a native dialog, it may not exist yet.
    for (let dir = p; dir && !this.dirs.has(dir); dir = dirname(dir)) this.dirs.add(dir);
    this.roots.add(p);
    this.persist();
    return p;
  }

  async pickSavePath(suggestedName: string, directory: string | null) {
    const answer = this.promptFn("Save as:", join(directory ?? "/demo", suggestedName));
    if (!answer) return null;
    let p = this.validate(answer.trim());
    if (!/\.[^/]+$/.test(basename(p))) p += ".md";
    if (!this.dirs.has(dirname(p))) throw new AppError("notFound", "Folder not found");
    this.allowedFiles.add(p);
    this.remember(p, "file");
    return p;
  }

  // The browser demo imports through a file input instead of these.
  async pickImportFile(): Promise<string | null> {
    throw new AppError("io", "Use the browser file picker in the demo.");
  }
  async readBinaryFile(path: string) {
    const p = this.check(path);
    const f = this.files.get(p);
    if (!f) throw new AppError("notFound", "File not found");
    return btoa(unescape(encodeURIComponent(f.content)));
  }

  async listRecent() {
    return [...this.recents];
  }

  async openRecent(path: string) {
    const entry = this.recents.find((r) => r.path === path);
    if (!entry) throw new AppError("outOfScope", "This item is not in the recent list.");
    const exists = entry.kind === "file" ? this.files.has(path) : this.dirs.has(path);
    if (!exists) throw new AppError("notFound", "The file or folder no longer exists.");
    if (entry.kind === "file") this.allowedFiles.add(path);
    else this.roots.add(path);
    this.remember(path, entry.kind);
    return entry;
  }

  async removeRecent(path: string) {
    this.recents = this.recents.filter((r) => r.path !== path);
    this.persist();
  }

  async listDir(path: string): Promise<DirEntry[]> {
    const dir = this.check(path);
    if (!this.dirs.has(dir)) throw new AppError("notFound", "Folder not found");
    const entries: DirEntry[] = [];
    for (const d of this.dirs) {
      if (d !== dir && dirname(d) === dir && !basename(d).startsWith(".")) {
        entries.push({ name: basename(d), path: d, isDir: true });
      }
    }
    for (const f of this.files.keys()) {
      if (dirname(f) === dir && isMarkdownPath(f) && !basename(f).startsWith(".")) {
        entries.push({ name: basename(f), path: f, isDir: false });
      }
    }
    return entries.sort((a, b) =>
      a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
  }

  async readTextFile(path: string) {
    const p = this.check(path);
    const f = this.files.get(p);
    if (!f) throw new AppError("notFound", "File not found");
    const crlf = f.content.includes("\r\n");
    return {
      path: p,
      content: f.content.replace(/\r\n/g, "\n"),
      mtime: f.mtime,
      lineEnding: crlf ? ("crlf" as const) : ("lf" as const),
      bom: false,
      readOnly: this.readOnlyFiles.has(p),
    };
  }

  private history = new Map<string, Array<{ id: number; content: string }>>();

  async listHistory(path: string) {
    const p = this.check(path);
    return (this.history.get(p) ?? []).map((v) => ({ id: v.id, size: v.content.length })).sort((a, b) => b.id - a.id);
  }

  async readHistory(path: string, id: number) {
    const p = this.check(path);
    const v = (this.history.get(p) ?? []).find((x) => x.id === id);
    if (!v) throw new AppError("notFound", "That version is no longer available.");
    return v.content.replace(/\r\n/g, "\n");
  }

  async writeTextFile(req: WriteRequest) {
    const p = this.check(req.path);
    const existing = this.files.get(p);
    if (this.readOnlyFiles.has(p)) throw new AppError("permissionDenied", "The file is read-only.");
    if (!req.force && existing && req.expectedMtime !== null && existing.mtime !== req.expectedMtime) {
      throw new AppError("conflict", "The file was changed by another program after it was opened.");
    }
    if (!this.dirs.has(dirname(p))) throw new AppError("notFound", "Folder not found");
    const content = req.lineEnding === "crlf" ? req.content.replace(/\n/g, "\r\n") : req.content;
    if (existing) {
      const versions = this.history.get(p) ?? [];
      if (versions[versions.length - 1]?.content !== existing.content) {
        versions.push({ id: this.tick(), content: existing.content });
        this.history.set(p, versions.slice(-30));
      }
    }
    this.put(p, content);
    this.persist();
    return this.files.get(p)!.mtime;
  }

  async fileMtime(path: string) {
    const p = this.check(path);
    if (this.dirs.has(p)) return 0;
    return this.files.get(p)?.mtime ?? null;
  }

  async createFile(directory: string, name: string) {
    let n = this.validateName(name);
    if (!isMarkdownPath(n)) n += ".md";
    const p = this.check(join(this.check(directory), n));
    if (this.files.has(p) || this.dirs.has(p)) throw new AppError("alreadyExists", "Already exists");
    this.put(p, "");
    this.persist();
    return p;
  }

  async createFolder(directory: string, name: string) {
    const p = this.check(join(this.check(directory), this.validateName(name)));
    if (this.files.has(p) || this.dirs.has(p)) throw new AppError("alreadyExists", "Already exists");
    this.dirs.add(p);
    this.persist();
    return p;
  }

  async ensureFolder(directory: string, name: string) {
    const p = this.check(join(this.check(directory), this.validateName(name)));
    if (this.files.has(p)) throw new AppError("alreadyExists", "A file has that name");
    if (!this.dirs.has(p)) {
      this.dirs.add(p);
      this.persist();
    }
    return p;
  }

  async renamePath(path: string, newName: string) {
    const from = this.check(path);
    const target = join(dirname(from), this.validateName(newName));
    // A file approved on its own may take a new name in its own folder (as in the native scope).
    const to = this.allowedFiles.has(from) && this.files.has(from) ? this.validate(target) : this.check(target);
    if (to !== from && (this.files.has(to) || this.dirs.has(to))) {
      throw new AppError("alreadyExists", "A file or folder with that name already exists.");
    }
    this.relocate(from, to);
    return to;
  }

  async movePath(path: string, directory: string) {
    const from = this.check(path);
    const dir = this.check(directory);
    if (!this.dirs.has(dir)) throw new AppError("invalidPath", "The destination isn't a folder.");
    if (dir === from || dir.startsWith(from + "/")) throw new AppError("invalidPath", "A folder can't be moved into itself.");
    const to = join(dir, basename(from));
    if (to === from) return to;
    if (this.files.has(to) || this.dirs.has(to)) throw new AppError("alreadyExists", `“${basename(from)}” already exists in that folder.`);
    this.relocate(from, to);
    return to;
  }

  /** Moves a file, or a folder with everything in it, to a new path. */
  private relocate(from: string, to: string) {
    if (this.files.has(from)) {
      const f = this.files.get(from)!;
      this.files.delete(from);
      this.files.set(to, f);
      if (this.allowedFiles.delete(from)) this.allowedFiles.add(to);
    } else if (this.dirs.has(from)) {
      const move = (p: string) => to + p.slice(from.length);
      this.dirs = new Set([...this.dirs].map((d) => (d === from || d.startsWith(from + "/") ? move(d) : d)));
      this.files = new Map(
        [...this.files].map(([k, v]) => [k.startsWith(from + "/") ? move(k) : k, v] as [string, MemFile]),
      );
    } else throw new AppError("notFound", "Not found");
    // Recent entries follow the rename (as in the native backend).
    this.recents = this.recents.map((r) => (r.path === from || r.path.startsWith(from + "/") ? { ...r, path: to + r.path.slice(from.length) } : r));
    this.persist();
  }

  async deletePath(path: string) {
    const p = this.check(path);
    if (this.files.delete(p)) {
      this.persist();
      return;
    }
    if (!this.dirs.has(p)) throw new AppError("notFound", "The file no longer exists.");
    this.dirs = new Set([...this.dirs].filter((d) => d !== p && !d.startsWith(p + "/")));
    this.files = new Map([...this.files].filter(([k]) => !k.startsWith(p + "/")));
    this.persist();
  }

  async gitStatus(root: string): Promise<GitStatus | null> {
    this.check(root);
    return this.git;
  }

  async gitHeadText(path: string): Promise<string | null> {
    return this.gitHead[this.check(path)] ?? null;
  }

  async listWorkspaceFiles(root: string) {
    const dir = this.check(root);
    return [...this.files.keys()]
      .filter((p) => p.startsWith(dir + "/") && /\.(md|markdown|png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(p))
      .filter((p) => !p.slice(dir.length).split("/").some((s) => s.startsWith(".")))
      .sort();
  }

  async listConvertibleFiles(root: string) {
    const dir = this.check(root);
    return [...this.files.keys()]
      .filter((p) => p.startsWith(dir + "/") && /\.(docx|pdf|html?|csv|tsv)$/i.test(p))
      .filter((p) => !p.slice(dir.length).split("/").some((s) => s.startsWith(".")))
      .sort();
  }

  async searchWorkspace(root: string, options: SearchOptions): Promise<SearchResult> {
    const dir = this.check(root);
    const re = buildSearchRegex(options);
    const limit = Math.min(Math.max(options.maxResults ?? 2000, 1), 10000);
    const result: SearchResult = { files: [], totalMatches: 0, filesSearched: 0, truncated: false };
    const allowed = pathFilter(options.include, options.exclude);
    const paths = [...this.files.keys()]
      .filter((p) => p.startsWith(dir + "/") && isMarkdownPath(p) && !p.slice(dir.length).split("/").some((s) => s.startsWith(".")))
      .filter((p) => allowed(relativeTo(dir, p)))
      .sort();
    for (const path of paths) {
      if (result.totalMatches >= limit) {
        result.truncated = true;
        break;
      }
      result.filesSearched++;
      const matches = searchText(this.files.get(path)!.content, re, limit - result.totalMatches);
      if (matches.length) {
        result.totalMatches += matches.length;
        result.files.push({ path, matches });
      }
    }
    return result;
  }

  async saveImageAsset(docPath: string, fileName: string, dataBase64: string, folder = "assets") {
    const doc = this.check(docPath);
    const name = this.validateName(fileName);
    const folderName = this.validateName(folder);
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = (dot > 0 ? name.slice(dot + 1) : "png").toLowerCase();
    if (!["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) {
      throw new AppError("invalidPath", "Only image files can be added to a document");
    }
    const dir = join(dirname(doc), folderName);
    this.check(join(dir, name));
    let target = join(dir, `${stem}.${ext}`);
    for (let n = 1; this.files.has(target); n++) target = join(dir, `${stem}-${n}.${ext}`);
    const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    this.put(target, `data:${mime};base64,${dataBase64}`);
    this.persist();
    return target;
  }

  async readImage(path: string) {
    const p = this.validate(path);
    const f = this.files.get(p);
    if (!f) throw new AppError("notFound", "Image not found");
    if (f.content.startsWith("data:image/")) return f.content;
    if (!p.endsWith(".svg")) throw new AppError("invalidPath", "Only SVG images are available in the demo");
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(f.content)));
  }

  async revealInFolder(path: string) {
    this.check(path);
    throw new AppError("io", "Showing files in a folder is only available in the desktop app.");
  }

  async openExternal(url: string) {
    if (!/^(https?:|mailto:)/i.test(url.trim())) {
      throw new AppError("invalidPath", "Only http, https and mailto links can be opened.");
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async exportFile(suggestedName: string, content: string, kind: string) {
    this.lastExport = { name: suggestedName, content };
    if (typeof URL.createObjectURL !== "function") return suggestedName;
    const type = kind === "html" ? "text/html" : "text/plain";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.lastExport = { name: suggestedName, content };
    return suggestedName;
  }

  async exportBinaryFile(suggestedName: string, dataBase64: string, kind: string) {
    this.lastExport = { name: suggestedName, content: dataBase64 };
    if (typeof URL.createObjectURL !== "function") return suggestedName;
    const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
    const type = kind === "pdf" ? "application/pdf" : kind === "zip" ? "application/zip" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type }));
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return suggestedName;
  }

  /** Test hook: the most recent export. */
  lastExport: { name: string; content: string } | null = null;

  async loadSettings() {
    return this.settings;
  }
  async saveSettings(settings: unknown) {
    this.settings = settings;
    this.persist();
  }
  async loadRecovery() {
    return this.recovery;
  }
  async saveRecovery(snapshot: RecoverySnapshot) {
    this.recovery = snapshot;
    this.persist();
  }
  async clearRecovery() {
    this.recovery = null;
    this.persist();
  }

  private fsListeners = new Set<(paths: string[]) => void>();
  private watchedRoot: string | null = null;
  async watchWorkspace(root: string | null) {
    this.watchedRoot = root ? this.check(root) : null;
  }
  async onFsChanged(handler: (paths: string[]) => void) {
    this.fsListeners.add(handler);
    return () => void this.fsListeners.delete(handler);
  }
  private notifyFs(path: string) {
    if (this.watchedRoot && path.startsWith(this.watchedRoot + "/")) this.fsListeners.forEach((h) => h([path]));
  }

  // The browser demo has no installer; updates.ts uses the GitHub API instead.
  async checkAppUpdate(): Promise<AppUpdate | null> {
    return null;
  }
  async installAppUpdate() {
    throw new AppError("io", "Updates are installed by the desktop app.");
  }
  async onUpdateProgress(_handler: (downloaded: number, total: number | null) => void) {
    return () => {};
  }

  async takePendingOpens() {
    return { files: [], folders: [] };
  }
  private openListeners = new Set<(p: OpenPaths) => void>();
  async onOpenPaths(handler: (p: OpenPaths) => void) {
    this.openListeners.add(handler);
    return () => void this.openListeners.delete(handler);
  }
  /** Test hook: simulates the OS asking the app to open paths. */
  simulateOpen(paths: OpenPaths) {
    for (const p of paths.folders) this.roots.add(p);
    for (const p of paths.files) this.allowedFiles.add(p);
    this.openListeners.forEach((h) => h(paths));
  }

  log(level: string, category: string, message: string) {
    this.logs.push(`[${level}] ${category}: ${message}`);
  }
  async exportLogs() {
    const blob = new Blob([this.logs.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "markpion-diagnostics.log";
    a.click();
    URL.revokeObjectURL(a.href);
    return "markpion-diagnostics.log";
  }

  /** Test helper: simulates another program editing a file. */
  externalWrite(path: string, content: string) {
    this.put(path, content);
    this.notifyFs(path);
  }
  /** Test helper: simulates another program deleting a file. */
  externalDelete(path: string) {
    this.files.delete(path);
    this.notifyFs(path);
  }
}

export function createDemoBackend() {
  // The sample files count as committed, so editing one shows the Git change bars.
  return new MemoryBackend({ files: DEMO_FILES, storageKey: "demo-fs", gitHead: DEMO_FILES });
}
