import { invoke } from "@tauri-apps/api/core";
import type { Backend, WriteRequest } from "./backend";
import { toAppError } from "./errors";
import type { OpenPaths, RecoverySnapshot } from "../types";

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toAppError(e);
  }
}

let nextAiRequestId = 1;

const currentWindow = async () => (await import("@tauri-apps/api/window")).getCurrentWindow();

export const tauriBackend: Backend = {
  capabilities: { desktop: true, trash: true, revealInFolder: true, selfUpdate: true, nativeImport: true, ai: true },
  appInfo: () => call("app_info"),

  pickOpenFile: () => call("pick_open_file"),
  pickOpenFolder: (startDir) => call("pick_open_folder", { startDir: startDir ?? null }),
  pickExportFolder: () => call("pick_export_folder"),
  aiStatus: () => call("ai_status"),
  aiSetKey: (key) => call("ai_set_key", { key }),
  aiLocalModels: (url) => call("ai_local_models", { url }),
  aiComplete: async ({ model, system, prompt, localUrl }, onText, signal) => {
    const requestId = nextAiRequestId++;
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<{ requestId: number; text: string }>("ai-stream", (e) => {
      if (e.payload.requestId === requestId) onText?.(e.payload.text);
    });
    const cancel = () => void call("ai_cancel", { requestId });
    signal?.addEventListener("abort", cancel);
    try {
      return await call<string | null>("ai_complete", { requestId, model, system, prompt, localUrl: localUrl ?? null });
    } finally {
      unlisten();
      signal?.removeEventListener("abort", cancel);
    }
  },
  pickSavePath: (suggestedName, directory) => call("pick_save_path", { suggestedName, directory }),

  pickImportFile: (kind) => call("pick_import_file", { kind }),
  readBinaryFile: (path) => call("read_binary_file", { path }),
  listRecent: () => call("list_recent"),
  openRecent: (path) => call("open_recent", { path }),
  removeRecent: (path) => call("remove_recent", { path }),

  listDir: (path, options) => call("list_dir", { path, images: !!options?.images }),
  readTextFile: (path) => call("read_text_file", { path }),
  writeTextFile: (req: WriteRequest) => call("write_text_file", { ...req }),
  fileMtime: (path) => call("file_mtime", { path }),
  createFile: (directory, name) => call("create_file", { directory, name }),
  createFolder: (directory, name) => call("create_folder", { directory, name }),
  ensureFolder: (directory, name) => call("ensure_folder", { directory, name }),
  renamePath: (path, newName) => call("rename_path", { path, newName }),
  movePath: (path, directory) => call("move_path", { path, directory }),
  deletePath: (path) => call("delete_path", { path }),
  readImage: (path) => call("read_image", { path }),
  saveImageAsset: (docPath, fileName, dataBase64, folder) => call("save_image_asset", { docPath, fileName, dataBase64, folder: folder ?? null }),
  searchWorkspace: (root, options) => call("search_workspace", { root, options }),
  listWorkspaceFiles: (root) => call("list_workspace_files", { root }),
  gitStatus: (root) => call("git_status", { root }),
  gitHeadText: (path) => call("git_head_text", { path }),
  listConvertibleFiles: (root) => call("list_convertible_files", { root }),
  openExternal: (url) => call("open_external", { url }),
  revealInFolder: (path) => call("reveal_in_folder", { path }),
  exportFile: (suggestedName, content, kind) => call("export_file", { suggestedName, content, kind }),
  exportBinaryFile: (suggestedName, dataBase64, kind) => call("export_binary_file", { suggestedName, dataBase64, kind }),

  listHistory: (path) => call("list_history", { path }),
  readHistory: (path, id) => call("read_history", { path, id }),
  loadSettings: () => call("load_settings"),
  loadPolicy: () => call("load_policy"),
  saveSettings: (settings) => call("save_settings", { settings }),
  loadRecovery: async () => (await call<RecoverySnapshot | null>("load_recovery")) ?? null,
  saveRecovery: (snapshot) => call("save_recovery", { snapshot }),
  clearRecovery: () => call("clear_recovery"),

  watchWorkspace: (root) => (root ? call("watch_workspace", { root }) : call("unwatch_workspace")),
  onFsChanged: async (handler) => {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<{ paths: string[] }>("fs-changed", (e) => handler(e.payload.paths));
  },
  takePendingOpens: () => call("take_pending_opens"),
  onOpenPaths: async (handler) => {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<OpenPaths>("open-paths", (e) => handler(e.payload));
  },
  setNativeMenu: (menus) => call("set_native_menu", { menus }),
  onMenuCommand: async (handler) => {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<string>("menu-command", (e) => handler(e.payload));
  },

  checkAppUpdate: () => call("check_app_update"),
  installAppUpdate: () => call("install_app_update"),
  onUpdateProgress: async (handler) => {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<{ downloaded: number; total: number | null }>("update-progress", (e) => handler(e.payload.downloaded, e.payload.total ?? null));
  },

  log: (level, category, message) => {
    invoke("log_event", { level, category, message }).catch(() => {});
  },
  exportLogs: () => call("export_logs"),
  setWindowTitle: async (title) => {
    await (await currentWindow()).setTitle(title);
  },
  toggleFullScreen: async () => {
    const win = await currentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
  },
  guardClose: async (canClose) => {
    await (await currentWindow()).onCloseRequested(async (event) => {
      if (!(await canClose())) event.preventDefault();
    });
  },
};
