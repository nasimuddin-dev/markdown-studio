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

export const tauriBackend: Backend = {
  isNative: true,
  appInfo: () => call("app_info"),

  pickOpenFile: () => call("pick_open_file"),
  pickOpenFolder: () => call("pick_open_folder"),
  pickExportFolder: () => call("pick_export_folder"),
  pickSavePath: (suggestedName, directory) => call("pick_save_path", { suggestedName, directory }),

  pickImportFile: (kind) => call("pick_import_file", { kind }),
  readBinaryFile: (path) => call("read_binary_file", { path }),
  listRecent: () => call("list_recent"),
  openRecent: (path) => call("open_recent", { path }),
  removeRecent: (path) => call("remove_recent", { path }),

  listDir: (path) => call("list_dir", { path }),
  readTextFile: (path) => call("read_text_file", { path }),
  writeTextFile: (req: WriteRequest) => call("write_text_file", { ...req }),
  fileMtime: (path) => call("file_mtime", { path }),
  createFile: (directory, name) => call("create_file", { directory, name }),
  createFolder: (directory, name) => call("create_folder", { directory, name }),
  ensureFolder: (directory, name) => call("ensure_folder", { directory, name }),
  renamePath: (path, newName) => call("rename_path", { path, newName }),
  deletePath: (path) => call("delete_path", { path }),
  readImage: (path) => call("read_image", { path }),
  saveImageAsset: (docPath, fileName, dataBase64) => call("save_image_asset", { docPath, fileName, dataBase64 }),
  searchWorkspace: (root, options) => call("search_workspace", { root, options }),
  listWorkspaceFiles: (root) => call("list_workspace_files", { root }),
  listConvertibleFiles: (root) => call("list_convertible_files", { root }),
  openExternal: (url) => call("open_external", { url }),
  revealInFolder: (path) => call("reveal_in_folder", { path }),
  exportFile: (suggestedName, content, kind) => call("export_file", { suggestedName, content, kind }),
  exportBinaryFile: (suggestedName, dataBase64, kind) => call("export_binary_file", { suggestedName, dataBase64, kind }),

  listHistory: (path) => call("list_history", { path }),
  readHistory: (path, id) => call("read_history", { path, id }),
  loadSettings: () => call("load_settings"),
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
};
