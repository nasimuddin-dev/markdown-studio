//! Least-privilege filesystem scope (SEC-001, SEC-002, SEC-003, NFR-007).
//!
//! The frontend cannot touch the filesystem directly. A path becomes usable only
//! after the user selects it through a native dialog (or it is restored from a
//! recent-files list and re-approved by the user). Every command validates its
//! input path against this scope before doing any I/O.

use crate::error::{AppError, AppResult};
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

#[derive(Default)]
pub struct Scope {
    /// Workspace folders: everything beneath them is accessible.
    roots: Mutex<HashSet<PathBuf>>,
    /// Individually approved files (opened or chosen in a Save dialog).
    files: Mutex<HashSet<PathBuf>>,
}

/// Rejects relative paths and any path containing `..` before it is resolved,
/// so traversal sequences can never be used to escape an approved location.
pub fn validate_syntax(path: &Path) -> AppResult<()> {
    if path.as_os_str().is_empty() {
        return Err(AppError::InvalidPath("Path is empty".into()));
    }
    if !path.is_absolute() {
        return Err(AppError::InvalidPath("Path must be absolute".into()));
    }
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(AppError::InvalidPath(
            "Path traversal (\"..\") is not allowed".into(),
        ));
    }
    if path.to_string_lossy().contains('\0') {
        return Err(AppError::InvalidPath("Path contains a NUL byte".into()));
    }
    Ok(())
}

/// Resolves symlinks for an existing path, or for the parent of a path that does
/// not exist yet (e.g. a file about to be created).
pub fn resolve(path: &Path) -> AppResult<PathBuf> {
    validate_syntax(path)?;
    if path.exists() {
        return Ok(dunce::canonicalize(path)?);
    }
    let parent = path
        .parent()
        .ok_or_else(|| AppError::InvalidPath("Path has no parent directory".into()))?;
    let name = path
        .file_name()
        .ok_or_else(|| AppError::InvalidPath("Path has no file name".into()))?;
    Ok(dunce::canonicalize(parent)?.join(name))
}

/// Validates a bare file name used for rename/create (no separators, no `..`).
pub fn validate_file_name(name: &str) -> AppResult<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidPath("Name cannot be empty".into()));
    }
    if trimmed == "." || trimmed == ".." {
        return Err(AppError::InvalidPath("Name is not allowed".into()));
    }
    const FORBIDDEN: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
    if trimmed.chars().any(|c| FORBIDDEN.contains(&c) || c.is_control()) {
        return Err(AppError::InvalidPath(
            "Name contains characters that are not allowed in file names".into(),
        ));
    }
    Ok(())
}

impl Scope {
    pub fn allow_dir(&self, path: &Path) -> AppResult<PathBuf> {
        let resolved = resolve(path)?;
        self.roots.lock().unwrap().insert(resolved.clone());
        Ok(resolved)
    }

    pub fn allow_file(&self, path: &Path) -> AppResult<PathBuf> {
        let resolved = resolve(path)?;
        self.files.lock().unwrap().insert(resolved.clone());
        Ok(resolved)
    }

    fn in_roots(&self, resolved: &Path) -> bool {
        self.roots
            .lock()
            .unwrap()
            .iter()
            .any(|root| resolved.starts_with(root))
    }

    /// Checks that `path` is an approved file or lives inside an approved folder.
    /// Returns the resolved path to operate on.
    pub fn check(&self, path: &Path) -> AppResult<PathBuf> {
        let resolved = resolve(path)?;
        if self.files.lock().unwrap().contains(&resolved) || self.in_roots(&resolved) {
            Ok(resolved)
        } else {
            Err(AppError::OutOfScope(
                "This location has not been opened in Markpion. Use Open File or Open Folder to grant access.".into(),
            ))
        }
    }

    /// Read-only access for preview assets (images). In addition to the normal
    /// scope, allows files in the same folder tree as an approved document so that
    /// a single opened README can show its relative images.
    pub fn check_asset(&self, path: &Path) -> AppResult<PathBuf> {
        if let Ok(p) = self.check(path) {
            return Ok(p);
        }
        let resolved = resolve(path)?;
        let files = self.files.lock().unwrap();
        let allowed = files
            .iter()
            .filter_map(|f| f.parent())
            .any(|dir| resolved.starts_with(dir));
        if allowed {
            Ok(resolved)
        } else {
            Err(AppError::OutOfScope("Asset is outside the approved locations".into()))
        }
    }

    /// Where `from` may be renamed to: `to` must be in scope, except that a file
    /// approved on its own (opened or saved without its folder) may take a new
    /// name in its own folder. Renames never overwrite, and the approval moves
    /// to the new name, so no other file becomes reachable.
    pub fn check_rename_target(&self, from: &Path, to: &Path) -> AppResult<PathBuf> {
        if let Ok(p) = self.check(to) {
            return Ok(p);
        }
        let approved_file = self.files.lock().unwrap().contains(from);
        match to.parent() {
            Some(dir) if approved_file && from.parent() == Some(dir) && from.is_file() => resolve(to),
            _ => self.check(to),
        }
    }

    /// Keeps the scope consistent after a rename inside the workspace.
    pub fn rename_file(&self, from: &Path, to: &Path) {
        let mut files = self.files.lock().unwrap();
        if files.remove(from) {
            files.insert(to.to_path_buf());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn rejects_relative_and_traversal_paths() {
        assert!(validate_syntax(Path::new("notes.md")).is_err());
        let tmp = tempfile::tempdir().unwrap();
        let traversal = tmp.path().join("a").join("..").join("..").join("secret.md");
        assert!(matches!(
            validate_syntax(&traversal),
            Err(AppError::InvalidPath(_))
        ));
    }

    #[test]
    fn allows_only_paths_inside_approved_roots() {
        let tmp = tempfile::tempdir().unwrap();
        let ws = tmp.path().join("workspace");
        let outside = tmp.path().join("outside");
        fs::create_dir_all(ws.join("docs")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(ws.join("docs").join("a.md"), "# A").unwrap();
        fs::write(outside.join("b.md"), "# B").unwrap();

        let scope = Scope::default();
        scope.allow_dir(&ws).unwrap();

        assert!(scope.check(&ws.join("docs").join("a.md")).is_ok());
        // New file (does not exist yet) inside the workspace is allowed.
        assert!(scope.check(&ws.join("new.md")).is_ok());
        assert!(matches!(
            scope.check(&outside.join("b.md")),
            Err(AppError::OutOfScope(_))
        ));
        // Traversal out of the workspace is rejected even though the target exists.
        assert!(scope
            .check(&ws.join("docs").join("..").join("..").join("outside").join("b.md"))
            .is_err());
    }

    #[test]
    fn single_file_approval_does_not_open_its_folder_for_writes() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("a.md"), "a").unwrap();
        fs::write(tmp.path().join("b.md"), "b").unwrap();
        let scope = Scope::default();
        scope.allow_file(&tmp.path().join("a.md")).unwrap();
        assert!(scope.check(&tmp.path().join("a.md")).is_ok());
        assert!(scope.check(&tmp.path().join("b.md")).is_err());
        // ...but sibling assets can be read for the preview.
        assert!(scope.check_asset(&tmp.path().join("b.md")).is_ok());

        // An approved file may take a new name in its own folder, and nothing else.
        let a = scope.check(&tmp.path().join("a.md")).unwrap();
        let dir = a.parent().unwrap().to_path_buf();
        assert!(scope.check_rename_target(&a, &dir.join("renamed.md")).is_ok());
        fs::create_dir_all(dir.join("sub")).unwrap();
        assert!(scope.check_rename_target(&a, &dir.join("sub").join("x.md")).is_err());
        let b = resolve(&tmp.path().join("b.md")).unwrap();
        assert!(scope.check_rename_target(&b, &dir.join("stolen.md")).is_err());
        scope.rename_file(&a, &dir.join("renamed.md"));
        assert!(scope.check(&dir.join("renamed.md")).is_ok());
        assert!(scope.check(&a).is_err());
    }

    #[test]
    fn validates_file_names() {
        assert!(validate_file_name("notes.md").is_ok());
        assert!(validate_file_name("über café.md").is_ok());
        for bad in ["", "  ", "..", "a/b.md", "a\\b.md", "x:y.md", "a\0.md"] {
            assert!(validate_file_name(bad).is_err(), "{bad:?} should be rejected");
        }
    }
}
