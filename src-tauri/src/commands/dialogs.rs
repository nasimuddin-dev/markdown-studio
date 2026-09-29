//! Native pickers. Each approves what the user chose in the path scope.

#[allow(unused_imports)]
use super::*;

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

/// Asks for a folder to export into (an HTML site). The folder is approved for
/// writing but, unlike Open Folder, not opened or added to recent folders.
#[tauri::command]
pub async fn pick_export_folder(app: AppHandle, state: State<'_, AppState>) -> AppResult<Option<String>> {
    let picked = app.dialog().file().set_title("Export to Folder").blocking_pick_folder();
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let resolved = state.track("dialog.exportFolder", state.scope.allow_dir(&path))?;
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
