//! Folder-wide operations: file lists, search and live watching.

#[allow(unused_imports)]
use super::*;

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

/// Git branch and changed files for an approved folder; `None` without Git or outside a repository.
#[tauri::command]
pub async fn git_status(state: State<'_, AppState>, root: String) -> AppResult<Option<crate::git::GitStatus>> {
    let dir = state.scope.check(Path::new(&root))?;
    tauri::async_runtime::spawn_blocking(move || crate::git::status(&dir))
        .await
        .map_err(|e| AppError::Io(e.to_string()))
}
