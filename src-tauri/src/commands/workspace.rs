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

/// An approved file's text as of the last Git commit, for the editor's change markers; `None` when untracked.
#[tauri::command]
pub async fn git_head_text(state: State<'_, AppState>, path: String) -> AppResult<Option<String>> {
    let file = state.scope.check(Path::new(&path))?;
    tauri::async_runtime::spawn_blocking(move || crate::git::head_text(&file))
        .await
        .map_err(|e| AppError::Io(e.to_string()))
}

/// Each changed file in the open folder with what's staged (Source Control).
#[tauri::command]
pub async fn git_changes(state: State<'_, AppState>, root: String) -> AppResult<Vec<crate::git_write::GitChange>> {
    let dir = state.scope.check(Path::new(&root))?;
    super::blocking(move || crate::git_write::changes(&dir).map_err(AppError::Git)).await
}

/// Approved paths inside the open folder, for staging (deleted files can't be resolved, so they're
/// checked by their folder).
fn paths_in(state: &AppState, root: &str, paths: &[String]) -> AppResult<(std::path::PathBuf, Vec<String>)> {
    let dir = state.scope.check(Path::new(root))?;
    let mut out = Vec::new();
    for p in paths {
        let path = Path::new(p);
        let checked = match state.scope.check(path) {
            Ok(resolved) => resolved,
            Err(_) => {
                let parent = path.parent().ok_or_else(|| AppError::InvalidPath(p.clone()))?;
                state.scope.check(parent)?.join(path.file_name().ok_or_else(|| AppError::InvalidPath(p.clone()))?)
            }
        };
        if !checked.starts_with(&dir) {
            return Err(AppError::OutOfScope(p.clone()));
        }
        out.push(checked.to_string_lossy().into_owned());
    }
    Ok((dir, out))
}

/// Stages files in the open folder.
#[tauri::command]
pub async fn git_stage(state: State<'_, AppState>, root: String, paths: Vec<String>) -> AppResult<()> {
    let (dir, paths) = paths_in(&state, &root, &paths)?;
    super::blocking(move || crate::git_write::stage(&dir, &paths).map_err(AppError::Git)).await
}

/// Unstages files in the open folder, keeping their changes.
#[tauri::command]
pub async fn git_unstage(state: State<'_, AppState>, root: String, paths: Vec<String>) -> AppResult<()> {
    let (dir, paths) = paths_in(&state, &root, &paths)?;
    super::blocking(move || crate::git_write::unstage(&dir, &paths).map_err(AppError::Git)).await
}

/// Commits what's staged in the open folder's repository; returns the short hash.
#[tauri::command]
pub async fn git_commit(state: State<'_, AppState>, root: String, message: String) -> AppResult<String> {
    let dir = state.scope.check(Path::new(&root))?;
    state.logger.log("info", "git", "commit");
    super::blocking(move || crate::git_write::commit(&dir, &message).map_err(AppError::Git)).await
}

/// Git branch and changed files for an approved folder; `None` without Git or outside a repository.
#[tauri::command]
pub async fn git_status(state: State<'_, AppState>, root: String) -> AppResult<Option<crate::git::GitStatus>> {
    let dir = state.scope.check(Path::new(&root))?;
    tauri::async_runtime::spawn_blocking(move || crate::git::status(&dir))
        .await
        .map_err(|e| AppError::Io(e.to_string()))
}
