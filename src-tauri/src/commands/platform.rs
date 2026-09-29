//! The OS around the app: launch paths, external links, the file manager and diagnostic logs.

#[allow(unused_imports)]
use super::*;

/// Returns (once) the files and folders the app was launched with.
#[tauri::command]
pub fn take_pending_opens(state: State<'_, AppState>) -> crate::open_paths::OpenPaths {
    std::mem::take(&mut *state.pending_open.lock().unwrap())
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
    let picked = file_dialog(&app)
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
