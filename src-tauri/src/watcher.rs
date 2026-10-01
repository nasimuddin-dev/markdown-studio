//! Live workspace watching: notifies the UI when files under the open folder
//! change on disk, so the explorer and open documents stay current without
//! polling. Events are debounced and filtered (hidden and dependency folders).
//!
//! On Windows and macOS one recursive watch covers the whole folder. On Linux
//! a recursive watch costs one kernel (inotify) watch per folder, including
//! every folder under `node_modules` and `.git`, and the per-user limit is
//! easy to hit on a large tree. There the folders the explorer can show are
//! watched one by one instead (up to [`MAX_WATCHED_DIRS`]), and folders
//! created later are added as they appear.

use crate::error::{AppError, AppResult};
use crate::fs_ops;
use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use std::collections::{BTreeSet, VecDeque};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const FS_CHANGED_EVENT: &str = "fs-changed";
const IGNORED_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];
/// Folders watched one by one (Linux). Beyond this the rest of the tree isn't
/// watched; the explorer still refreshes when the window regains focus.
const MAX_WATCHED_DIRS: usize = 4096;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsChanged {
    pub paths: Vec<String>,
}

type SharedDebouncer = Arc<Mutex<Option<Debouncer<RecommendedWatcher>>>>;

#[derive(Default)]
pub struct WorkspaceWatcher {
    current: Mutex<Option<(PathBuf, SharedDebouncer)>>,
}

fn ignored_name(name: &str) -> bool {
    name.starts_with('.') || IGNORED_DIRS.contains(&name) || name.ends_with(".markpion-tmp")
}

/// True for paths the explorer never shows (hidden entries, dependency and
/// build folders, our own temp files), relative to the watched root.
pub fn is_ignored(root: &Path, path: &Path) -> bool {
    let Ok(rel) = path.strip_prefix(root) else { return true };
    rel.components().any(|c| match c {
        Component::Normal(name) => ignored_name(&name.to_string_lossy()),
        _ => false,
    })
}

/// `dir` and the folders under it that the explorer can show (no hidden,
/// dependency or build folders; symlinks aren't followed), nearest first, at
/// most `cap`. Returns the folders and whether the tree was cut off.
pub fn watchable_dirs(dir: &Path, cap: usize) -> (Vec<PathBuf>, bool) {
    let mut out = Vec::new();
    let mut queue = VecDeque::from([dir.to_path_buf()]);
    while let Some(next) = queue.pop_front() {
        if out.len() >= cap {
            return (out, true);
        }
        if let Ok(entries) = std::fs::read_dir(&next) {
            for entry in entries.flatten() {
                let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                if is_dir && !ignored_name(&entry.file_name().to_string_lossy()) {
                    queue.push_back(entry.path());
                }
            }
        }
        out.push(next);
    }
    (out, false)
}

/// Whether folders are watched one by one (see the module comment).
fn watches_each_folder() -> bool {
    cfg!(target_os = "linux")
}

impl WorkspaceWatcher {
    pub fn watch(&self, app: AppHandle, root: PathBuf) -> AppResult<()> {
        let mut current = self.current.lock().unwrap();
        if matches!(&*current, Some((r, _)) if *r == root) {
            return Ok(());
        }
        Self::release(current.take()); // stops the previous watcher
        let each_folder = watches_each_folder();
        let shared: SharedDebouncer = Arc::new(Mutex::new(None));
        let events_root = root.clone();
        let events_shared = shared.clone();
        let mut debouncer = new_debouncer(Duration::from_millis(350), move |res: DebounceEventResult| {
            let Ok(events) = res else { return };
            let changed: Vec<PathBuf> = events.into_iter().map(|e| e.path).filter(|p| !is_ignored(&events_root, p)).collect();
            if changed.is_empty() {
                return;
            }
            if each_folder {
                // Folders created (or moved in) since the watch began. `try_lock`:
                // never wait here for a lock held by a thread that is stopping this watcher.
                if let Ok(mut slot) = events_shared.try_lock() {
                    if let Some(debouncer) = slot.as_mut() {
                        for dir in changed.iter().filter(|p| p.is_dir()) {
                            for sub in watchable_dirs(dir, 256).0 {
                                let _ = debouncer.watcher().watch(&sub, RecursiveMode::NonRecursive);
                            }
                        }
                    }
                }
            }
            let paths: BTreeSet<String> = changed.iter().map(|p| fs_ops::path_string(p)).collect();
            let _ = app.emit(FS_CHANGED_EVENT, FsChanged { paths: paths.into_iter().collect() });
        })
        .map_err(|e| AppError::Io(format!("Could not watch the folder: {e}")))?;
        if each_folder {
            let (dirs, _cut_off) = watchable_dirs(&root, MAX_WATCHED_DIRS);
            for (i, dir) in dirs.iter().enumerate() {
                let watched = debouncer.watcher().watch(dir, RecursiveMode::NonRecursive);
                // The root must be watchable; a subfolder that isn't (permissions,
                // the kernel's watch limit) is skipped rather than failing the lot.
                if i == 0 {
                    watched.map_err(|e| AppError::Io(format!("Could not watch the folder: {e}")))?;
                }
            }
        } else {
            debouncer
                .watcher()
                .watch(&root, RecursiveMode::Recursive)
                .map_err(|e| AppError::Io(format!("Could not watch the folder: {e}")))?;
        }
        *shared.lock().unwrap() = Some(debouncer);
        *current = Some((root, shared));
        Ok(())
    }

    /// Drops a watcher. The event callback holds the shared slot too, so the
    /// debouncer is taken out of it explicitly (or it would keep itself alive).
    fn release(watcher: Option<(PathBuf, SharedDebouncer)>) {
        if let Some((_, shared)) = watcher {
            let debouncer = shared.lock().unwrap().take();
            drop(debouncer);
        }
    }

    pub fn stop(&self) {
        Self::release(self.current.lock().unwrap().take());
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

    #[test]
    fn lists_the_folders_to_watch_one_by_one() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("ws");
        for dir in ["docs/guide", "notes", ".git/objects", "node_modules/pkg/lib", "target/debug"] {
            std::fs::create_dir_all(root.join(dir)).unwrap();
        }
        std::fs::write(root.join("docs").join("a.md"), "x").unwrap();
        let (dirs, cut_off) = watchable_dirs(&root, 100);
        let mut names: Vec<String> = dirs
            .iter()
            .map(|d| d.strip_prefix(&root).unwrap().to_string_lossy().replace('\\', "/"))
            .collect();
        names.sort();
        assert_eq!(names, ["", "docs", "docs/guide", "notes"]);
        assert!(!cut_off);
        // The root always comes first, and the cap is respected.
        assert_eq!(dirs[0], root);
        let (capped, cut_off) = watchable_dirs(&root, 2);
        assert_eq!(capped.len(), 2);
        assert!(cut_off);
    }
}
