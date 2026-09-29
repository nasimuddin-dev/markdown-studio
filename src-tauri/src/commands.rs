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

    /// Logs the operation name and error category only — never document content.
    pub(crate) fn track<T>(&self, op: &str, result: AppResult<T>) -> AppResult<T> {
        if let Err(e) = &result {
            self.logger.log("error", op, &e.to_string());
        }
        result
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

// ---------------------------------------------------------------- dialogs

#[tauri::command]
pub async fn pick_open_file(app: AppHandle, state: State<'_, AppState>) -> AppResult<Option<String>> {
    let picked = app
        .dialog()
        .file()
        .set_title("Open Markdown File")
        .add_filter(md_filter_name(), fs_ops::MARKDOWN_EXTENSIONS)
        .add_filter("All files", &["*"])
        .blocking_pick_file();
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let resolved = state.track("dialog.open", state.scope.allow_file(&path))?;
    state.remember(&resolved, RecentKind::File);
    Ok(Some(fs_ops::path_string(&resolved)))
}

#[tauri::command]
pub async fn pick_open_folder(app: AppHandle, state: State<'_, AppState>) -> AppResult<Option<String>> {
    let picked = app.dialog().file().set_title("Open Folder").blocking_pick_folder();
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let resolved = state.track("dialog.openFolder", state.scope.allow_dir(&path))?;
    state.remember(&resolved, RecentKind::Folder);
    Ok(Some(fs_ops::path_string(&resolved)))
}

#[tauri::command]
pub async fn pick_save_path(
    app: AppHandle,
    state: State<'_, AppState>,
    suggested_name: Option<String>,
    directory: Option<String>,
) -> AppResult<Option<String>> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Save Markdown File")
        .add_filter(md_filter_name(), fs_ops::MARKDOWN_EXTENSIONS)
        .set_file_name(suggested_name.unwrap_or_else(|| "Untitled.md".into()));
    if let Some(dir) = directory {
        dialog = dialog.set_directory(dir);
    }
    let Some(mut path) = dialog.blocking_save_file().and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    if path.extension().is_none() {
        path.set_extension("md");
    }
    let resolved = state.track("dialog.save", state.scope.allow_file(&path))?;
    state.remember(&resolved, RecentKind::File);
    Ok(Some(fs_ops::path_string(&resolved)))
}

/// Returns (once) the files and folders the app was launched with.
#[tauri::command]
pub fn take_pending_opens(state: State<'_, AppState>) -> crate::open_paths::OpenPaths {
    std::mem::take(&mut *state.pending_open.lock().unwrap())
}

// ---------------------------------------------------------------- recents

#[tauri::command]
pub fn list_recent(state: State<'_, AppState>) -> Vec<RecentEntry> {
    state.recents.lock().unwrap().clone()
}

/// Re-grants access to a path the user opened in an earlier session.
#[tauri::command]
pub fn open_recent(state: State<'_, AppState>, path: String) -> AppResult<RecentEntry> {
    let entry = state
        .recents
        .lock()
        .unwrap()
        .iter()
        .find(|r| r.path == path)
        .cloned()
        .ok_or_else(|| AppError::OutOfScope("This item is not in the recent list.".into()))?;
    let p = Path::new(&entry.path);
    if !p.exists() {
        return Err(AppError::NotFound("The file or folder no longer exists.".into()));
    }
    match entry.kind {
        RecentKind::File => state.scope.allow_file(p)?,
        RecentKind::Folder => state.scope.allow_dir(p)?,
    };
    state.remember(p, entry.kind.clone());
    Ok(entry)
}

#[tauri::command]
pub fn remove_recent(state: State<'_, AppState>, path: String) -> AppResult<()> {
    let snapshot = {
        let mut list = state.recents.lock().unwrap();
        list.retain(|r| r.path != path);
        list.clone()
    };
    storage::write_json(&state.recents_path(), &serde_json::to_value(snapshot).unwrap_or(Value::Null))
}

// ---------------------------------------------------------------- files

#[tauri::command]
pub async fn list_dir(state: State<'_, AppState>, path: String) -> AppResult<Vec<DirEntry>> {
    let dir = state.track("fs.listDir", state.scope.check(Path::new(&path)))?;
    state.track("fs.listDir", fs_ops::list_dir(&dir))
}

#[tauri::command]
pub async fn read_text_file(state: State<'_, AppState>, path: String) -> AppResult<FileContent> {
    let file = state.track("fs.read", state.scope.check(Path::new(&path)))?;
    let mut content = state.track("fs.read", fs_ops::read_text(&file))?;
    content.path = path;
    Ok(content)
}

#[tauri::command]
pub async fn write_text_file(
    state: State<'_, AppState>,
    path: String,
    content: String,
    line_ending: LineEnding,
    bom: bool,
    expected_mtime: Option<u64>,
    force: bool,
) -> AppResult<u64> {
    let file = state.track("fs.write", state.scope.check(Path::new(&path)))?;
    // Keep the version being replaced in local history (never blocks the save).
    if let Err(e) = crate::history::snapshot(&state.history_root(), &file) {
        state.logger.log("warn", "history.snapshot", &e.to_string());
    }
    let result = fs_ops::write_text_atomic(&file, &content, line_ending, bom, expected_mtime, force);
    if result.is_ok() {
        state.logger.log("info", "fs.write", "saved document");
    }
    state.track("fs.write", result)
}

/// Returns the modification time, or `None` if the file no longer exists.
#[tauri::command]
pub async fn file_mtime(state: State<'_, AppState>, path: String) -> AppResult<Option<u64>> {
    let file = state.scope.check(Path::new(&path))?;
    if !file.exists() {
        return Ok(None);
    }
    Ok(Some(fs_ops::mtime(&file)?))
}

#[tauri::command]
pub async fn create_file(state: State<'_, AppState>, directory: String, name: String) -> AppResult<String> {
    scope::validate_file_name(&name)?;
    let dir = state.scope.check(Path::new(&directory))?;
    let mut target = fs_ops::join_child(&dir, &name);
    if !fs_ops::is_markdown(&target) {
        target.set_extension("md");
    }
    let target = state.scope.check(&target)?;
    state.track("fs.create", fs_ops::create_file(&target))?;
    Ok(fs_ops::path_string(&target))
}

#[tauri::command]
pub async fn create_folder(state: State<'_, AppState>, directory: String, name: String) -> AppResult<String> {
    scope::validate_file_name(&name)?;
    let dir = state.scope.check(Path::new(&directory))?;
    let target = state.scope.check(&fs_ops::join_child(&dir, &name))?;
    state.track("fs.createFolder", fs_ops::create_dir(&target))?;
    Ok(fs_ops::path_string(&target))
}

#[tauri::command]
pub async fn rename_path(state: State<'_, AppState>, path: String, new_name: String) -> AppResult<String> {
    scope::validate_file_name(&new_name)?;
    let from = state.scope.check(Path::new(&path))?;
    let parent = from
        .parent()
        .ok_or_else(|| AppError::InvalidPath("Cannot rename a root folder".into()))?;
    let to = state.scope.check(&fs_ops::join_child(parent, &new_name))?;
    state.track("fs.rename", fs_ops::rename(&from, &to))?;
    state.scope.rename_file(&from, &to);
    Ok(fs_ops::path_string(&to))
}

#[tauri::command]
pub async fn delete_path(state: State<'_, AppState>, path: String) -> AppResult<()> {
    let target = state.scope.check(Path::new(&path))?;
    state.track("fs.delete", fs_ops::delete_to_trash(&target))
}

/// Saves a pasted/dropped image next to a saved document (in `assets/`) and
/// returns its path. The document's folder must be writable in the scope.
#[tauri::command]
pub async fn save_image_asset(
    state: State<'_, AppState>,
    doc_path: String,
    file_name: String,
    data_base64: String,
) -> AppResult<String> {
    use base64::Engine;
    let doc = state.scope.check(Path::new(&doc_path))?;
    let dir = doc
        .parent()
        .ok_or_else(|| AppError::InvalidPath("Document has no folder".into()))?
        .to_path_buf();
    scope::validate_file_name(&file_name)?;
    let name = Path::new(&file_name);
    let stem = name.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
    let ext = name.extension().and_then(|s| s.to_str()).unwrap_or("png");
    // The target is always `<document folder>/assets/<validated name>`, a
    // location derived from an approved document, never a caller-supplied path.
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|_| AppError::InvalidPath("Invalid image data".into()))?;
    let saved = state.track("asset.save", fs_ops::save_asset(&dir, stem, ext, &bytes))?;
    Ok(fs_ops::path_string(&saved))
}

/// Kinds of documents that can be imported (converted to Markdown).
fn import_filter(kind: &str) -> AppResult<(&'static str, &'static [&'static str])> {
    match kind {
        "docx" => Ok(("Word document", &["docx"])),
        "html" => Ok(("Web page", &["html", "htm"])),
        "pdf" => Ok(("PDF document", &["pdf"])),
        "csv" => Ok(("Spreadsheet data (CSV/TSV)", &["csv", "tsv"])),
        _ => Err(AppError::InvalidPath("Unsupported import type".into())),
    }
}

/// Native Open dialog for a document to import; the chosen file becomes readable.
#[tauri::command]
pub async fn pick_import_file(app: AppHandle, state: State<'_, AppState>, kind: String) -> AppResult<Option<String>> {
    let (name, exts) = import_filter(&kind)?;
    let picked = app
        .dialog()
        .file()
        .set_title("Import")
        .add_filter(name, exts)
        .blocking_pick_file();
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let resolved = state.track("dialog.import", state.scope.allow_file(&path))?;
    Ok(Some(fs_ops::path_string(&resolved)))
}

/// Reads an approved file as base64 (used for importing .docx / .pdf).
#[tauri::command]
pub async fn read_binary_file(state: State<'_, AppState>, path: String) -> AppResult<String> {
    use base64::Engine;
    const MAX: u64 = 100 * 1024 * 1024;
    let file = state.scope.check(Path::new(&path))?;
    let meta = std::fs::metadata(&file)?;
    if meta.len() > MAX {
        return Err(AppError::TooLarge("Files larger than 100 MB can't be imported".into()));
    }
    let bytes = state.track("fs.readBinary", std::fs::read(&file).map_err(AppError::from))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub async fn read_image(state: State<'_, AppState>, path: String) -> AppResult<String> {
    let file = state.scope.check_asset(Path::new(&path))?;
    fs_ops::read_image_data_url(&file)
}

/// Shows a file or folder in the system file manager (Explorer / Finder).
#[tauri::command]
pub fn reveal_in_folder(app: AppHandle, state: State<'_, AppState>, path: String) -> AppResult<()> {
    let target = state.scope.check(Path::new(&path))?;
    let result = app
        .opener()
        .reveal_item_in_dir(&target)
        .map_err(|e| AppError::Io(e.to_string()));
    state.track("shell.reveal", result)
}

/// Opens a link in the user's default browser (SEC-005). Only web and mail
/// links are allowed; `file:`, `javascript:` and custom schemes are refused.
#[tauri::command]
pub fn open_external(app: AppHandle, state: State<'_, AppState>, url: String) -> AppResult<()> {
    let lower = url.trim().to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")) {
        return Err(AppError::InvalidPath("Only http, https and mailto links can be opened.".into()));
    }
    let result = app
        .opener()
        .open_url(url.trim(), None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()));
    state.track("shell.openUrl", result)
}

/// Exports rendered content (e.g. HTML) to a location the user picks in a
/// native Save dialog. The dialog itself is the user's consent for the path.
#[tauri::command]
pub async fn export_file(
    app: AppHandle,
    state: State<'_, AppState>,
    suggested_name: String,
    content: String,
    kind: String,
) -> AppResult<Option<String>> {
    let (filter, exts): (&str, &[&str]) = match kind.as_str() {
        "html" => ("HTML document", &["html", "htm"]),
        _ => return Err(AppError::InvalidPath("Unsupported export type".into())),
    };
    scope::validate_file_name(&suggested_name)?;
    let picked = app
        .dialog()
        .file()
        .set_title("Export")
        .add_filter(filter, exts)
        .set_file_name(suggested_name)
        .blocking_save_file();
    let Some(mut path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    if path.extension().is_none() {
        path.set_extension(exts[0]);
    }
    scope::validate_syntax(&path)?;
    let result = fs_ops::write_text_atomic(&path, &content, LineEnding::Lf, false, None, true);
    state.track("export.write", result)?;
    state.logger.log("info", "export", &kind);
    Ok(Some(fs_ops::path_string(&path)))
}

/// Lists Markdown and image files under an approved folder (link completion).
#[tauri::command]
pub async fn list_workspace_files(state: State<'_, AppState>, root: String) -> AppResult<Vec<String>> {
    let dir = state.scope.check(Path::new(&root))?;
    tauri::async_runtime::spawn_blocking(move || crate::search::workspace_files(&dir))
        .await
        .map_err(|e| AppError::Io(e.to_string()))
}

/// Lists Word, PDF, HTML and CSV files under an approved folder ("Convert Folder to Markdown").
#[tauri::command]
pub async fn list_convertible_files(state: State<'_, AppState>, root: String) -> AppResult<Vec<String>> {
    let dir = state.scope.check(Path::new(&root))?;
    tauri::async_runtime::spawn_blocking(move || crate::search::convertible_files(&dir))
        .await
        .map_err(|e| AppError::Io(e.to_string()))
}

/// Searches Markdown files under an approved folder ("Find in Files").
#[tauri::command]
pub async fn search_workspace(
    state: State<'_, AppState>,
    root: String,
    options: crate::search::SearchOptions,
) -> AppResult<crate::search::SearchResult> {
    let dir = state.scope.check(Path::new(&root))?;
    if !dir.is_dir() {
        return Err(AppError::InvalidPath("Search root is not a folder".into()));
    }
    // Searching can take a while on large trees; keep it off the async runtime threads.
    let result = tauri::async_runtime::spawn_blocking(move || crate::search::search_workspace(&dir, &options))
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;
    state.track("search", result)
}

/// Starts watching an approved folder; changes are reported as `fs-changed` events.
#[tauri::command]
pub fn watch_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    watcher: State<'_, crate::watcher::WorkspaceWatcher>,
    root: String,
) -> AppResult<()> {
    let dir = state.scope.check(Path::new(&root))?;
    if !dir.is_dir() {
        return Err(AppError::InvalidPath("Not a folder".into()));
    }
    state.track("watch", watcher.watch(app, dir))
}

#[tauri::command]
pub fn unwatch_workspace(watcher: State<'_, crate::watcher::WorkspaceWatcher>) {
    watcher.stop();
}

/// Earlier versions of a document kept by local history, newest first.
#[tauri::command]
pub async fn list_history(state: State<'_, AppState>, path: String) -> AppResult<Vec<crate::history::HistoryEntry>> {
    let file = state.scope.check(Path::new(&path))?;
    crate::history::list(&state.history_root(), &file)
}

/// Text of one history version (decoded like a document: UTF-8, LF).
#[tauri::command]
pub async fn read_history(state: State<'_, AppState>, path: String, id: u64) -> AppResult<String> {
    let file = state.scope.check(Path::new(&path))?;
    let bytes = crate::history::read(&state.history_root(), &file, id)?;
    Ok(crate::text::decode(&bytes)?.content)
}

/// Exports binary content (Word .docx, PDF) to a path chosen in a native
/// Save dialog. Written atomically; the dialog confirms any overwrite.
#[tauri::command]
pub async fn export_binary_file(
    app: AppHandle,
    state: State<'_, AppState>,
    suggested_name: String,
    data_base64: String,
    kind: String,
) -> AppResult<Option<String>> {
    use base64::Engine;
    let (filter, ext): (&str, &str) = match kind.as_str() {
        "docx" => ("Word document", "docx"),
        "pdf" => ("PDF document", "pdf"),
        _ => return Err(AppError::InvalidPath("Unsupported export type".into())),
    };
    scope::validate_file_name(&suggested_name)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|_| AppError::InvalidPath("Invalid export data".into()))?;
    let picked = app
        .dialog()
        .file()
        .set_title("Export")
        .add_filter(filter, &[ext])
        .set_file_name(suggested_name)
        .blocking_save_file();
    let Some(mut path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    if path.extension().is_none() {
        path.set_extension(ext);
    }
    scope::validate_syntax(&path)?;
    state.track("export.write", fs_ops::write_bytes_atomic(&path, &bytes))?;
    state.logger.log("info", "export", &kind);
    Ok(Some(fs_ops::path_string(&path)))
}

// ---------------------------------------------------------------- settings & recovery

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Value {
    storage::read_json(&state.settings_path())
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: Value) -> AppResult<()> {
    state.track("settings.save", storage::write_json(&state.settings_path(), &settings))
}

#[tauri::command]
pub fn load_recovery(state: State<'_, AppState>) -> Value {
    storage::read_json(&state.recovery_path())
}

#[tauri::command]
pub async fn save_recovery(state: State<'_, AppState>, snapshot: Value) -> AppResult<()> {
    storage::write_json(&state.recovery_path(), &snapshot)
}

#[tauri::command]
pub fn clear_recovery(state: State<'_, AppState>) -> AppResult<()> {
    match std::fs::remove_file(state.recovery_path()) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.into()),
        _ => Ok(()),
    }
}

// ---------------------------------------------------------------- diagnostics

#[tauri::command]
pub fn log_event(state: State<'_, AppState>, level: String, category: String, message: String) {
    let level = match level.as_str() {
        "error" | "warn" | "info" | "debug" => level,
        _ => "info".into(),
    };
    if level == "debug" && !cfg!(debug_assertions) {
        return;
    }
    state.logger.log(&level, &category, &message);
}

#[tauri::command]
pub async fn export_logs(app: AppHandle, state: State<'_, AppState>) -> AppResult<Option<String>> {
    let picked = app
        .dialog()
        .file()
        .set_title("Export Diagnostic Logs")
        .add_filter("Log file", &["log", "txt"])
        .set_file_name("markpion-diagnostics.log")
        .blocking_save_file();
    let Some(dest) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let mut out = format!(
        "Markpion {} ({} {})\n\n",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        std::env::consts::ARCH
    );
    let rotated = state.logger.path().with_extension("log.1");
    for p in [rotated.as_path(), state.logger.path()] {
        if let Ok(s) = std::fs::read_to_string(p) {
            out.push_str(&s);
        }
    }
    std::fs::write(&dest, out)?;
    Ok(Some(fs_ops::path_string(&dest)))
}
