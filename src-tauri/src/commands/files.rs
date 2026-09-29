//! Reading and writing documents, folders, images and exports in approved locations.

#[allow(unused_imports)]
use super::*;

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

/// Creates a subfolder unless it already exists (for exports that mirror a folder tree).
#[tauri::command]
pub async fn ensure_folder(state: State<'_, AppState>, directory: String, name: String) -> AppResult<String> {
    scope::validate_file_name(&name)?;
    let dir = state.scope.check(Path::new(&directory))?;
    let target = state.scope.check(&fs_ops::join_child(&dir, &name))?;
    state.track("fs.ensureFolder", fs_ops::ensure_dir(&target))?;
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

/// Moves a file or folder into another folder (file explorer drag and drop, Move To).
#[tauri::command]
pub async fn move_path(state: State<'_, AppState>, path: String, directory: String) -> AppResult<String> {
    let from = state.scope.check(Path::new(&path))?;
    let dir = state.scope.check(Path::new(&directory))?;
    // `dir` is an approved folder (move_into refuses anything else), so the
    // destination inside it is in scope too.
    let to = state.track("fs.move", fs_ops::move_into(&from, &dir))?;
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
