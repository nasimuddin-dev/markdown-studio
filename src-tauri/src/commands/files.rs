//! Reading and writing documents, folders, images and exports in approved locations.

#[allow(unused_imports)]
use super::*;

/// Lists a folder for the Explorer: subfolders and Markdown files, and
/// pictures too when `images` is set.
#[tauri::command]
pub async fn list_dir(state: State<'_, AppState>, path: String, images: Option<bool>) -> AppResult<Vec<DirEntry>> {
    let dir = state.track("fs.listDir", state.scope.check(Path::new(&path)))?;
    state.track("fs.listDir", fs_ops::list_dir(&dir, images.unwrap_or(false)))
}

#[tauri::command]
pub async fn read_text_file(state: State<'_, AppState>, path: String) -> AppResult<FileContent> {
    let file = state.track("fs.read", state.scope.check(Path::new(&path)))?;
    let mut content = state.track("fs.read", blocking(move || fs_ops::read_text(&file)).await)?;
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
    let history_root = state.history_root();
    // The copy for local history and the write itself can take a while for a
    // large file or a slow disk; they run off the async runtime's threads.
    let (snapshot_error, result) = blocking(move || {
        // Keep the version being replaced in local history (never blocks the save).
        let snapshot_error = crate::history::snapshot(&history_root, &file).err().map(|e| e.to_string());
        Ok((snapshot_error, fs_ops::write_text_atomic(&file, &content, line_ending, bom, expected_mtime, force)))
    })
    .await?;
    if let Some(e) = snapshot_error {
        state.logger.log("warn", "history.snapshot", &e);
    }
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
    let to = state.scope.check_rename_target(&from, &fs_ops::join_child(parent, &new_name))?;
    state.track("fs.rename", fs_ops::rename(&from, &to))?;
    state.scope.rename_file(&from, &to);
    state.rename_recents(&from, &to);
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
    state.rename_recents(&from, &to);
    Ok(fs_ops::path_string(&to))
}

#[tauri::command]
pub async fn delete_path(state: State<'_, AppState>, path: String) -> AppResult<()> {
    let target = state.scope.check(Path::new(&path))?;
    state.track("fs.delete", fs_ops::delete_to_trash(&target))
}

/// Saves a pasted/dropped image next to a saved document (in `assets/`, or
/// the folder named in Settings) and returns its path. The document's folder
/// must be writable in the scope.
#[tauri::command]
pub async fn save_image_asset(
    state: State<'_, AppState>,
    doc_path: String,
    file_name: String,
    data_base64: String,
    folder: Option<String>,
) -> AppResult<String> {
    use base64::Engine;
    let doc = state.scope.check(Path::new(&doc_path))?;
    let dir = doc
        .parent()
        .ok_or_else(|| AppError::InvalidPath("Document has no folder".into()))?
        .to_path_buf();
    scope::validate_file_name(&file_name)?;
    // One folder name (no separators, "." or ".."), so it stays inside the document's folder.
    let folder = folder.unwrap_or_else(|| "assets".into());
    scope::validate_file_name(&folder)?;
    let name = Path::new(&file_name);
    let stem = name.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
    let ext = name.extension().and_then(|s| s.to_str()).unwrap_or("png");
    // The target is always `<document folder>/<validated folder>/<validated name>`, a
    // location derived from an approved document, never a caller-supplied path.
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|_| AppError::InvalidPath("Invalid image data".into()))?;
    let saved = state.track("asset.save", fs_ops::save_asset(&dir, folder.trim(), stem, ext, &bytes))?;
    Ok(fs_ops::path_string(&saved))
}

/// Reads an approved file's bytes (used for importing .docx / .pdf). They go
/// to the UI as raw bytes (an `ArrayBuffer`), not as base64 inside JSON, so a
/// large import isn't held in memory several times over.
#[tauri::command]
pub async fn read_binary_file(state: State<'_, AppState>, path: String) -> AppResult<tauri::ipc::Response> {
    const MAX: u64 = 100 * 1024 * 1024;
    let file = state.scope.check(Path::new(&path))?;
    let read = blocking(move || {
        if std::fs::metadata(&file)?.len() > MAX {
            return Err(AppError::TooLarge("Files larger than 100 MB can't be imported".into()));
        }
        Ok(std::fs::read(&file)?)
    })
    .await;
    Ok(tauri::ipc::Response::new(state.track("fs.readBinary", read)?))
}

#[tauri::command]
pub async fn read_image(state: State<'_, AppState>, path: String) -> AppResult<String> {
    let file = state.scope.check_asset(Path::new(&path))?;
    blocking(move || fs_ops::read_image_data_url(&file)).await
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
        "json" => ("Markpion settings", &["json"]),
        "tex" => ("LaTeX document", &["tex"]),
        _ => return Err(AppError::InvalidPath("Unsupported export type".into())),
    };
    scope::validate_file_name(&suggested_name)?;
    let picked = file_dialog(&app)
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

/// Decodes a `%XX`-encoded header value (the UI sends file names with
/// `encodeURIComponent`, since header values must be ASCII). `None` if the
/// encoding is broken or the result isn't UTF-8.
pub(crate) fn percent_decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Exports binary content (Word .docx, PDF, .zip, .epub) to a path chosen in a
/// native Save dialog. Written atomically; the dialog confirms any overwrite.
/// The bytes arrive as the request's raw body (not base64 in JSON); the kind
/// and the suggested file name come in the `x-export-kind` and
/// `x-export-name` headers.
#[tauri::command]
pub async fn export_binary_file(app: AppHandle, state: State<'_, AppState>, request: tauri::ipc::Request<'_>) -> AppResult<Option<String>> {
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err(AppError::InvalidPath("Invalid export data".into()));
    };
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok());
    let kind = header("x-export-kind").unwrap_or_default();
    let suggested_name = header("x-export-name")
        .and_then(percent_decode)
        .ok_or_else(|| AppError::InvalidPath("Invalid export file name".into()))?;
    let (filter, ext): (&str, &str) = match kind {
        "docx" => ("Word document", "docx"),
        "pdf" => ("PDF document", "pdf"),
        "zip" => ("ZIP archive", "zip"),
        "epub" => ("EPUB e-book", "epub"),
        _ => return Err(AppError::InvalidPath("Unsupported export type".into())),
    };
    scope::validate_file_name(&suggested_name)?;
    let bytes = body.clone();
    let picked = file_dialog(&app)
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
    let target = path.clone();
    state.track("export.write", blocking(move || fs_ops::write_bytes_atomic(&target, &bytes)).await)?;
    state.logger.log("info", "export", kind);
    Ok(Some(fs_ops::path_string(&path)))
}

#[cfg(test)]
mod tests {
    use super::percent_decode;

    #[test]
    fn decodes_file_names_sent_in_headers() {
        assert_eq!(percent_decode("plan.docx").as_deref(), Some("plan.docx"));
        assert_eq!(percent_decode("Quarterly%20Report%20%C3%A9t%C3%A9.pdf").as_deref(), Some("Quarterly Report été.pdf"));
        assert_eq!(percent_decode("%E6%97%A5%E6%9C%AC.zip").as_deref(), Some("日本.zip"));
        // Broken escapes and invalid UTF-8 are refused.
        assert_eq!(percent_decode("bad%2"), None);
        assert_eq!(percent_decode("bad%zz.pdf"), None);
        assert_eq!(percent_decode("%FF.pdf"), None);
    }
}
