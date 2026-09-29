//! Filesystem operations. These functions operate on paths that have already
//! been validated by [`crate::scope::Scope`], and are kept free of Tauri types
//! so they can be unit tested.

use crate::error::{AppError, AppResult};
use crate::text::{self, LineEnding};
use serde::Serialize;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

pub const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown"];
const MAX_DOCUMENT_BYTES: u64 = 50 * 1024 * 1024;
const MAX_ASSET_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub mtime: u64,
    pub line_ending: LineEnding,
    pub bom: bool,
}

pub fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MARKDOWN_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

pub fn mtime(path: &Path) -> AppResult<u64> {
    let modified = fs::metadata(path)?.modified()?;
    Ok(modified
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0))
}

/// Lists folders and Markdown files directly inside `dir` (FR-012). Hidden
/// entries and common dependency/build folders are skipped.
pub fn list_dir(dir: &Path) -> AppResult<Vec<DirEntry>> {
    const SKIPPED_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];
    let mut entries = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        // Follows symlinks; broken links are skipped.
        let Ok(meta) = fs::metadata(&path) else { continue };
        if meta.is_dir() {
            if SKIPPED_DIRS.contains(&name.as_str()) {
                continue;
            }
            entries.push(DirEntry { name, path: path_string(&path), is_dir: true });
        } else if meta.is_file() && is_markdown(&path) {
            entries.push(DirEntry { name, path: path_string(&path), is_dir: false });
        }
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn read_text(path: &Path) -> AppResult<FileContent> {
    let meta = fs::metadata(path)?;
    if meta.is_dir() {
        return Err(AppError::InvalidPath("Expected a file but found a folder".into()));
    }
    if meta.len() > MAX_DOCUMENT_BYTES {
        return Err(AppError::TooLarge(format!(
            "The file is {} MB; the maximum supported size is {} MB.",
            meta.len() / 1024 / 1024,
            MAX_DOCUMENT_BYTES / 1024 / 1024
        )));
    }
    let bytes = fs::read(path)?;
    let decoded = text::decode(&bytes)?;
    Ok(FileContent {
        path: path_string(path),
        content: decoded.content,
        mtime: mtime(path)?,
        line_ending: decoded.line_ending,
        bom: decoded.bom,
    })
}

/// Safe save (SRS §10.2): write to a temporary file in the same folder, flush it
/// to disk, then atomically rename it over the target. If `expected_mtime` is
/// provided and the file on disk has changed since, the save is refused with
/// [`AppError::Conflict`] unless `force` is set (FR-018).
pub fn write_text_atomic(
    path: &Path,
    content: &str,
    line_ending: LineEnding,
    bom: bool,
    expected_mtime: Option<u64>,
    force: bool,
) -> AppResult<u64> {
    if !force {
        if let Some(expected) = expected_mtime {
            if path.exists() && mtime(path)? != expected {
                return Err(AppError::Conflict(
                    "The file was changed by another program after it was opened.".into(),
                ));
            }
        }
    }
    let dir = path
        .parent()
        .ok_or_else(|| AppError::InvalidPath("Path has no parent directory".into()))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| AppError::InvalidPath("Path has no file name".into()))?
        .to_string_lossy();
    let tmp_path = dir.join(format!(".{}.{}.markpion-tmp", file_name, std::process::id()));

    let bytes = text::encode(content, line_ending, bom);
    let result = (|| -> AppResult<()> {
        let mut tmp = File::create(&tmp_path)?;
        tmp.write_all(&bytes)?;
        tmp.sync_all()?;
        drop(tmp);
        // Keep the original file's permissions (e.g. executable bits, read-only on purpose).
        if let Ok(meta) = fs::metadata(path) {
            if meta.permissions().readonly() {
                return Err(AppError::PermissionDenied("The file is read-only.".into()));
            }
            let _ = fs::set_permissions(&tmp_path, meta.permissions());
        }
        rename_with_retry(&tmp_path, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp_path);
    }
    result?;
    mtime(path)
}

/// Renames with a few short retries: on Windows, antivirus scanners, search
/// indexers and sync clients briefly lock freshly written files, which makes
/// an otherwise valid save fail with "access denied".
fn rename_with_retry(from: &Path, to: &Path) -> std::io::Result<()> {
    const ATTEMPTS: u32 = if cfg!(windows) { 6 } else { 1 };
    let mut delay = std::time::Duration::from_millis(25);
    let mut last = None;
    for attempt in 0..ATTEMPTS {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) if attempt + 1 < ATTEMPTS && is_transient(&e) => {
                last = Some(e);
                std::thread::sleep(delay);
                delay *= 2;
            }
            Err(e) => return Err(e),
        }
    }
    Err(last.unwrap_or_else(|| std::io::Error::other("rename failed")))
}

fn is_transient(e: &std::io::Error) -> bool {
    // ERROR_ACCESS_DENIED (5), ERROR_SHARING_VIOLATION (32), ERROR_LOCK_VIOLATION (33)
    matches!(e.raw_os_error(), Some(5) | Some(32) | Some(33)) || e.kind() == std::io::ErrorKind::PermissionDenied
}

/// Writes bytes via a temporary file + rename (same safety as text saves).
pub fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let dir = path
        .parent()
        .ok_or_else(|| AppError::InvalidPath("Path has no parent directory".into()))?;
    let name = path
        .file_name()
        .ok_or_else(|| AppError::InvalidPath("Path has no file name".into()))?
        .to_string_lossy();
    let tmp = dir.join(format!(".{}.{}.markpion-tmp", name, std::process::id()));
    let result = (|| -> AppResult<()> {
        let mut f = File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        rename_with_retry(&tmp, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

pub fn create_file(path: &Path) -> AppResult<()> {
    File::options().write(true).create_new(true).open(path)?;
    Ok(())
}

pub fn create_dir(path: &Path) -> AppResult<()> {
    fs::create_dir(path)?;
    Ok(())
}

/// Creates a folder unless it already exists; fails if a file has that name.
pub fn ensure_dir(path: &Path) -> AppResult<()> {
    if path.is_dir() {
        return Ok(());
    }
    fs::create_dir(path)?;
    Ok(())
}

pub fn rename(from: &Path, to: &Path) -> AppResult<()> {
    if to.exists() && !same_file_ignoring_case(from, to) {
        return Err(AppError::AlreadyExists(
            "A file or folder with that name already exists.".into(),
        ));
    }
    fs::rename(from, to)?;
    Ok(())
}

/// Moves a file or folder into `dir`, keeping its name. Refuses to replace
/// anything, and to move a folder into itself or one of its subfolders.
/// Returns the new path.
pub fn move_into(from: &Path, dir: &Path) -> AppResult<PathBuf> {
    let name = from
        .file_name()
        .ok_or_else(|| AppError::InvalidPath("Cannot move a root folder".into()))?;
    if !dir.is_dir() {
        return Err(AppError::InvalidPath("The destination isn't a folder.".into()));
    }
    if dir.starts_with(from) {
        return Err(AppError::InvalidPath("A folder can't be moved into itself.".into()));
    }
    let to = dir.join(name);
    if to == from {
        return Ok(to);
    }
    if to.exists() {
        return Err(AppError::AlreadyExists(format!(
            "“{}” already exists in that folder.",
            name.to_string_lossy()
        )));
    }
    fs::rename(from, &to)?;
    Ok(to)
}

/// On case-insensitive filesystems renaming `a.md` to `A.md` must be allowed.
fn same_file_ignoring_case(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
}

/// Moves a file or folder to the OS trash/recycle bin so an accidental delete
/// can be undone by the user.
pub fn delete_to_trash(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Err(AppError::NotFound("The file no longer exists.".into()));
    }
    trash::delete(path).map_err(|e| AppError::Io(format!("Could not move to trash: {e}")))
}

pub const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

/// Picks a file name in `dir` that doesn't exist yet: `name.png`, `name-1.png`, ...
pub fn unique_child(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let mut candidate = dir.join(format!("{stem}.{ext}"));
    let mut n = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{stem}-{n}.{ext}"));
        n += 1;
    }
    candidate
}

/// Saves image bytes into an `assets` folder next to a document and returns
/// the new file's path. Never overwrites an existing file.
pub fn save_asset(doc_dir: &Path, stem: &str, ext: &str, bytes: &[u8]) -> AppResult<PathBuf> {
    let ext = ext.to_ascii_lowercase();
    if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
        return Err(AppError::InvalidPath("Only image files can be added to a document".into()));
    }
    if bytes.len() as u64 > MAX_ASSET_BYTES {
        return Err(AppError::TooLarge("Images larger than 20 MB can't be added".into()));
    }
    let assets = doc_dir.join("assets");
    fs::create_dir_all(&assets)?;
    let target = unique_child(&assets, stem, &ext);
    let mut file = File::options().write(true).create_new(true).open(&target)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(target)
}

pub fn read_image_data_url(path: &Path) -> AppResult<String> {
    use base64::Engine;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        _ => return Err(AppError::InvalidPath("Not a supported image type".into())),
    };
    if fs::metadata(path)?.len() > MAX_ASSET_BYTES {
        return Err(AppError::TooLarge("Image is too large to preview".into()));
    }
    let bytes = fs::read(path)?;
    Ok(format!(
        "data:{};base64,{}",
        mime,
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

pub fn join_child(dir: &Path, name: &str) -> PathBuf {
    dir.join(name.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn move_into_moves_and_refuses_clashes_and_self_moves() {
        let tmp = tempfile::tempdir().unwrap();
        let docs = tmp.path().join("docs");
        let sub = docs.join("sub");
        fs::create_dir_all(&sub).unwrap();
        let note = tmp.path().join("note.md");
        fs::write(&note, "x").unwrap();
        let moved = move_into(&note, &docs).unwrap();
        assert_eq!(moved, docs.join("note.md"));
        assert!(moved.is_file() && !note.exists());
        // Same name already there.
        fs::write(&note, "y").unwrap();
        assert!(matches!(move_into(&note, &docs), Err(AppError::AlreadyExists(_))));
        // A folder into itself or its subfolder.
        assert!(move_into(&docs, &docs).is_err());
        assert!(move_into(&docs, &sub).is_err());
        // Into a file.
        assert!(move_into(&note, &moved).is_err());
    }

    #[test]
    fn ensure_dir_creates_once_and_rejects_files() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("site");
        ensure_dir(&dir).unwrap();
        assert!(dir.is_dir());
        ensure_dir(&dir).unwrap();
        let file = tmp.path().join("page.html");
        fs::write(&file, "x").unwrap();
        assert!(ensure_dir(&file).is_err());
    }

    #[test]
    fn atomic_write_round_trips_and_detects_conflicts() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("doc.md");
        let m1 = write_text_atomic(&file, "# Hi\n", LineEnding::Crlf, false, None, false).unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"# Hi\r\n");
        let read = read_text(&file).unwrap();
        assert_eq!(read.content, "# Hi\n");
        assert_eq!(read.line_ending, LineEnding::Crlf);

        // Simulate an external edit with a different mtime.
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&file, "external").unwrap();
        let t = std::time::SystemTime::now() + std::time::Duration::from_secs(5);
        File::options().write(true).open(&file).unwrap().set_modified(t).unwrap();

        let err = write_text_atomic(&file, "mine", LineEnding::Lf, false, Some(m1), false);
        assert!(matches!(err, Err(AppError::Conflict(_))));
        assert_eq!(fs::read_to_string(&file).unwrap(), "external");

        write_text_atomic(&file, "mine", LineEnding::Lf, false, Some(m1), true).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "mine");
        // No temp files left behind.
        assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 1);
    }

    #[test]
    fn lists_only_folders_and_markdown() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("docs")).unwrap();
        fs::create_dir(tmp.path().join(".git")).unwrap();
        fs::create_dir(tmp.path().join("node_modules")).unwrap();
        fs::write(tmp.path().join("b.md"), "").unwrap();
        fs::write(tmp.path().join("A.markdown"), "").unwrap();
        fs::write(tmp.path().join("image.png"), "").unwrap();
        let names: Vec<_> = list_dir(tmp.path()).unwrap().into_iter().map(|e| e.name).collect();
        assert_eq!(names, vec!["docs", "A.markdown", "b.md"]);
    }

    #[test]
    fn rename_refuses_to_overwrite() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("a.md"), "a").unwrap();
        fs::write(tmp.path().join("b.md"), "b").unwrap();
        assert!(matches!(
            rename(&tmp.path().join("a.md"), &tmp.path().join("b.md")),
            Err(AppError::AlreadyExists(_))
        ));
        rename(&tmp.path().join("a.md"), &tmp.path().join("c.md")).unwrap();
        assert!(tmp.path().join("c.md").exists());
    }

    #[test]
    fn saves_assets_without_overwriting() {
        let tmp = tempfile::tempdir().unwrap();
        let a = save_asset(tmp.path(), "shot", "PNG", b"one").unwrap();
        let b = save_asset(tmp.path(), "shot", "png", b"two").unwrap();
        assert_eq!(a, tmp.path().join("assets").join("shot.png"));
        assert_eq!(b, tmp.path().join("assets").join("shot-1.png"));
        assert_eq!(fs::read(&a).unwrap(), b"one");
        assert!(matches!(save_asset(tmp.path(), "x", "exe", b"MZ"), Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn writes_bytes_atomically() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("out.docx");
        write_bytes_atomic(&f, b"PK\x03\x04data").unwrap();
        write_bytes_atomic(&f, b"PK\x03\x04new").unwrap();
        assert_eq!(fs::read(&f).unwrap(), b"PK\x03\x04new");
        assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 1);
    }

    #[test]
    fn create_file_does_not_clobber() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("x.md");
        create_file(&f).unwrap();
        assert!(matches!(create_file(&f), Err(AppError::AlreadyExists(_))));
    }
}
