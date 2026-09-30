//! Tauri commands exposed to the frontend. Every command that touches the
//! filesystem validates its path against [`Scope`] first.

use crate::error::{AppError, AppResult};
use crate::fs_ops::{self, DirEntry, FileContent};
use crate::scope::{self, Scope};
use crate::storage::{self, Logger};
use crate::text::LineEnding;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const MAX_RECENT: usize = 15;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecentKind {
    File,
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    pub path: String,
    pub kind: RecentKind,
}

pub struct AppState {
    pub scope: Scope,
    pub logger: Logger,
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    /// Recent files/folders are owned by the backend (not the UI) so a path can
    /// only be re-opened without a dialog if the user opened it before (FR-044).
    pub recents: Mutex<Vec<RecentEntry>>,
    /// Files/folders passed on the command line, waiting for the UI to start.
    pub pending_open: Mutex<crate::open_paths::OpenPaths>,
    /// AI requests the user cancelled; their streams stop at the next chunk.
    pub ai_cancelled: Mutex<std::collections::HashSet<u64>>,
}

impl AppState {
    fn settings_path(&self) -> PathBuf {
        self.config_dir.join("settings.json")
    }
    fn recents_path(&self) -> PathBuf {
        self.config_dir.join("recent.json")
    }
    fn history_root(&self) -> PathBuf {
        self.data_dir.join("history")
    }
    fn recovery_path(&self) -> PathBuf {
        self.data_dir.join("recovery").join("session.json")
    }

    pub fn load_recents(&self) {
        if let Ok(list) = serde_json::from_value::<Vec<RecentEntry>>(storage::read_json(&self.recents_path())) {
            *self.recents.lock().unwrap() = list;
        }
    }

    pub(crate) fn remember(&self, path: &Path, kind: RecentKind) {
        let path = fs_ops::path_string(path);
        let snapshot = {
            let mut list = self.recents.lock().unwrap();
            list.retain(|r| r.path != path);
            list.insert(0, RecentEntry { path, kind });
            list.truncate(MAX_RECENT);
            list.clone()
        };
        if let Err(e) = storage::write_json(&self.recents_path(), &serde_json::to_value(snapshot).unwrap_or(Value::Null)) {
            self.logger.log("warn", "recent.save", &e.to_string());
        }
    }

    /// Keeps recent entries pointing at a file or folder after it was renamed or moved in the app.
    pub(crate) fn rename_recents(&self, from: &Path, to: &Path) {
        let snapshot = {
            let mut list = self.recents.lock().unwrap();
            if !renamed_recents(&mut list, &fs_ops::path_string(from), &fs_ops::path_string(to)) {
                return;
            }
            list.clone()
        };
        if let Err(e) = storage::write_json(&self.recents_path(), &serde_json::to_value(snapshot).unwrap_or(Value::Null)) {
            self.logger.log("warn", "recent.save", &e.to_string());
        }
    }

    /// Logs the operation name and error category only — never document content.
    pub(crate) fn track<T>(&self, op: &str, result: AppResult<T>) -> AppResult<T> {
        if let Err(e) = &result {
            self.logger.log("error", op, &e.to_string());
        }
        result
    }
}

/// Rewrites entries for `from` (and, for a folder, everything inside it) to `to`. Returns whether any changed.
fn renamed_recents(list: &mut [RecentEntry], from: &str, to: &str) -> bool {
    let mut changed = false;
    for entry in list.iter_mut() {
        let rest = entry.path.strip_prefix(from).filter(|r| r.is_empty() || r.starts_with(['/', '\\']));
        if let Some(rest) = rest {
            entry.path = format!("{to}{rest}");
            changed = true;
        }
    }
    changed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recents_follow_renames() {
        let mut list = vec![
            RecentEntry { path: "C:\\notes\\a.md".into(), kind: RecentKind::File },
            RecentEntry { path: "C:\\notes\\ab.md".into(), kind: RecentKind::File },
            RecentEntry { path: "C:\\docs\\x.md".into(), kind: RecentKind::File },
            RecentEntry { path: "C:\\docs".into(), kind: RecentKind::Folder },
        ];
        assert!(renamed_recents(&mut list, "C:\\notes\\a.md", "C:\\notes\\b.md"));
        assert!(renamed_recents(&mut list, "C:\\docs", "C:\\guides"));
        let paths: Vec<&str> = list.iter().map(|r| r.path.as_str()).collect();
        assert_eq!(paths, ["C:\\notes\\b.md", "C:\\notes\\ab.md", "C:\\guides\\x.md", "C:\\guides"]);
        assert!(!renamed_recents(&mut list, "C:\\other", "C:\\else"));
    }
}

fn md_filter_name() -> &'static str {
    "Markdown"
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: String,
    os: String,
    arch: String,
    log_path: String,
}

#[tauri::command]
pub fn app_info(state: State<'_, AppState>) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        log_path: state.logger.redact(&state.logger.path().to_string_lossy()),
    }
}

/// A native file dialog owned by the main window, so it opens in front of it
/// (and stays there) instead of behind it.
fn file_dialog(app: &AppHandle) -> tauri_plugin_dialog::FileDialogBuilder<tauri::Wry> {
    use tauri::Manager;
    let dialog = app.dialog().file();
    match app.get_webview_window("main") {
        Some(window) => dialog.set_parent(&window),
        None => dialog,
    }
}

pub mod ai;
pub mod app_data;
pub mod dialogs;
pub mod files;
pub mod platform;
pub mod workspace;
