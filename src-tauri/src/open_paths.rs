//! Opening files handed to the app by the operating system: command-line
//! arguments (file association / "Open with"), a second launch while the app
//! is running (single instance), files dropped on the window, and macOS
//! "open document" events.
//!
//! These paths come from an explicit user action outside the webview, so they
//! are added to the approved scope here, never by the frontend.

use crate::commands::{AppState, RecentKind};
use crate::fs_ops;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

pub const OPEN_PATHS_EVENT: &str = "open-paths";

#[derive(Debug, Default, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenPaths {
    pub files: Vec<String>,
    pub folders: Vec<String>,
}

impl OpenPaths {
    pub fn is_empty(&self) -> bool {
        self.files.is_empty() && self.folders.is_empty()
    }

    /// Adds `other`'s paths after these, skipping ones already listed.
    pub fn append(&mut self, other: OpenPaths) {
        for file in other.files {
            if !self.files.contains(&file) {
                self.files.push(file);
            }
        }
        for folder in other.folders {
            if !self.folders.contains(&folder) {
                self.folders.push(folder);
            }
        }
    }
}

/// Turns launch arguments into candidate paths (flags are ignored). Relative
/// paths are resolved against the working directory of the launching process.
pub fn paths_from_args<I: IntoIterator<Item = String>>(args: I, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .filter(|a| !a.is_empty() && !a.starts_with('-'))
        .map(|a| {
            let a = a.strip_prefix("file://").map(str::to_string).unwrap_or(a);
            let p = PathBuf::from(&a);
            if p.is_absolute() {
                p
            } else {
                cwd.join(p)
            }
        })
        .collect()
}

/// Approves existing Markdown files and folders and returns their paths.
pub fn accept(state: &AppState, paths: impl IntoIterator<Item = PathBuf>) -> OpenPaths {
    let mut out = OpenPaths::default();
    for path in paths {
        let Ok(resolved) = dunce::canonicalize(&path) else { continue };
        if resolved.is_dir() {
            if state.scope.allow_dir(&resolved).is_ok() {
                state.remember(&resolved, RecentKind::Folder);
                out.folders.push(fs_ops::path_string(&resolved));
            }
        } else if resolved.is_file() && fs_ops::is_markdown(&resolved) {
            if state.scope.allow_file(&resolved).is_ok() {
                state.remember(&resolved, RecentKind::File);
                out.files.push(fs_ops::path_string(&resolved));
            }
        }
    }
    if !out.is_empty() {
        state.logger.log(
            "info",
            "os.open",
            &format!("{} file(s), {} folder(s)", out.files.len(), out.folders.len()),
        );
    }
    out
}

/// Approves the paths and tells the UI to open them, bringing the window forward.
///
/// While the UI is still starting it isn't listening for the event yet (a
/// second file double-clicked right after the first, or several files opened
/// at once, arrive in that window). Those paths wait with the launch paths
/// and are handed over when the UI asks for them, so none is dropped.
pub fn open_in_ui(app: &AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
    use std::sync::atomic::Ordering;
    let state = app.state::<AppState>();
    let accepted = accept(&state, paths);
    if accepted.is_empty() {
        return;
    }
    {
        // Checked under the same lock `take_pending_opens` holds while it marks the UI ready.
        let mut pending = state.pending_open.lock().unwrap();
        if !state.ui_ready.load(Ordering::SeqCst) {
            pending.append(accepted);
            return;
        }
    }
    let _ = app.emit(OPEN_PATHS_EVENT, accepted);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queued_paths_keep_their_order_without_duplicates() {
        let mut pending = OpenPaths { files: vec!["a.md".into()], folders: vec![] };
        pending.append(OpenPaths { files: vec!["b.md".into(), "a.md".into()], folders: vec!["docs".into()] });
        pending.append(OpenPaths { files: vec![], folders: vec!["docs".into()] });
        assert_eq!(pending, OpenPaths { files: vec!["a.md".into(), "b.md".into()], folders: vec!["docs".into()] });
    }

    #[test]
    fn parses_launch_arguments() {
        let cwd = Path::new(if cfg!(windows) { "C:\\work" } else { "/work" });
        let args = vec![
            "--flag".to_string(),
            "notes.md".to_string(),
            String::new(),
            if cfg!(windows) { "D:\\a.md".to_string() } else { "/a.md".to_string() },
        ];
        let got = paths_from_args(args, cwd);
        assert_eq!(got.len(), 2);
        assert_eq!(got[0], cwd.join("notes.md"));
        assert!(got[1].is_absolute());
    }
}
