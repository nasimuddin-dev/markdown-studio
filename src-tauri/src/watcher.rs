//! Live workspace watching: notifies the UI when files under the open folder
//! change on disk, so the explorer and open documents stay current without
//! polling. Events are debounced and filtered (hidden and dependency folders).

use crate::error::{AppError, AppResult};
use crate::fs_ops;
use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const FS_CHANGED_EVENT: &str = "fs-changed";
const IGNORED_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsChanged {
    pub paths: Vec<String>,
}

#[derive(Default)]
pub struct WorkspaceWatcher {
    current: Mutex<Option<(PathBuf, Debouncer<RecommendedWatcher>)>>,
}

/// True for paths the explorer never shows (hidden entries, dependency and
/// build folders, our own temp files), relative to the watched root.
pub fn is_ignored(root: &Path, path: &Path) -> bool {
    let Ok(rel) = path.strip_prefix(root) else { return true };
    rel.components().any(|c| match c {
        Component::Normal(name) => {
            let n = name.to_string_lossy();
            n.starts_with('.') || IGNORED_DIRS.contains(&n.as_ref()) || n.ends_with(".markpion-tmp")
        }
        _ => false,
    })
}

impl WorkspaceWatcher {
    pub fn watch(&self, app: AppHandle, root: PathBuf) -> AppResult<()> {
        let mut current = self.current.lock().unwrap();
        if matches!(&*current, Some((r, _)) if *r == root) {
            return Ok(());
        }
        *current = None; // stops the previous watcher
        let events_root = root.clone();
        let mut debouncer = new_debouncer(Duration::from_millis(350), move |res: DebounceEventResult| {
            let Ok(events) = res else { return };
            let paths: BTreeSet<String> = events
                .into_iter()
                .filter(|e| !is_ignored(&events_root, &e.path))
                .map(|e| fs_ops::path_string(&e.path))
                .collect();
            if !paths.is_empty() {
                let _ = app.emit(FS_CHANGED_EVENT, FsChanged { paths: paths.into_iter().collect() });
            }
        })
        .map_err(|e| AppError::Io(format!("Could not watch the folder: {e}")))?;
        debouncer
            .watcher()
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|e| AppError::Io(format!("Could not watch the folder: {e}")))?;
        *current = Some((root, debouncer));
        Ok(())
    }

    pub fn stop(&self) {
        *self.current.lock().unwrap() = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignores_hidden_dependency_and_temp_paths() {
        let root = Path::new(if cfg!(windows) { "C:\\ws" } else { "/ws" });
        assert!(!is_ignored(root, &root.join("docs").join("a.md")));
        assert!(is_ignored(root, &root.join(".git").join("index")));
        assert!(is_ignored(root, &root.join("node_modules").join("x.md")));
        assert!(is_ignored(root, &root.join(".a.md.123.markpion-tmp")));
        assert!(is_ignored(root, Path::new("/elsewhere/a.md")));
    }
}
