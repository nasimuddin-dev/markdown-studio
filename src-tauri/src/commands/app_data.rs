//! The app's own data: recent items, settings, crash recovery and file history.

#[allow(unused_imports)]
use super::*;

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
