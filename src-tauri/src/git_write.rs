//! Changing a repository: the staged and unstaged changes of each file, staging
//! and unstaging, and committing. Runs the user's `git` (so their identity,
//! hooks and signing settings apply) and returns its message when it refuses,
//! for example when there's nothing to commit or a hook fails.
//!
//! Callers check that `root` is the open folder and that every path is inside
//! it (see `commands::workspace`). Paths are absolute; git accepts them for
//! files inside the work tree.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Serialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitChange {
    /// Absolute path.
    pub path: String,
    /// The staged change (index against HEAD): M, A, D, R, or None.
    pub staged: Option<String>,
    /// The unstaged change (working tree against index): M, D, U (untracked), or None.
    pub unstaged: Option<String>,
    /// Both sides changed the file in a merge.
    pub conflict: bool,
}

/// Runs git in `dir`; Ok(stdout) on success, Err(message) otherwise.
fn run(dir: &Path, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(dir)
        .args(["-c", "core.quotepath=false"])
        .args(args)
        .stdin(Stdio::null())
        .env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().map_err(|e| format!("Git couldn't be started: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let msg = if err.is_empty() { String::from_utf8_lossy(&out.stdout).trim().to_string() } else { err };
        Err(if msg.is_empty() { "Git reported an error.".into() } else { msg })
    }
}

fn side(c: char) -> Option<String> {
    match c {
        ' ' => None,
        '?' => Some("U".into()),
        other => Some(other.to_string()),
    }
}

/// The repository's top folder.
fn top(root: &Path) -> Result<PathBuf, String> {
    let top = run(root, &["rev-parse", "--show-toplevel"])?;
    dunce::canonicalize(top.trim()).map_err(|e| e.to_string())
}

/// The changed files inside `root` (which may be a folder within the repository), with what's staged and what isn't.
pub fn changes(root: &Path) -> Result<Vec<GitChange>, String> {
    let top = top(root)?;
    let root = dunce::canonicalize(root).map_err(|e| e.to_string())?;
    let out = run(&root, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
    let mut entries = out.split('\0').filter(|e| !e.is_empty());
    let mut list = Vec::new();
    while let Some(entry) = entries.next() {
        if entry.len() < 4 {
            continue;
        }
        let xy: Vec<char> = entry[..2].chars().collect();
        // Porcelain paths are relative to the top folder, with "/" separators.
        let path = top.join(entry[3..].replace('/', std::path::MAIN_SEPARATOR_STR));
        // A rename's entry is followed by its old path.
        if xy[0] == 'R' || xy[0] == 'C' {
            entries.next();
        }
        let conflict = xy[0] == 'U' || xy[1] == 'U' || (xy[0] == 'A' && xy[1] == 'A') || (xy[0] == 'D' && xy[1] == 'D');
        if !path.starts_with(&root) {
            continue;
        }
        let (staged, unstaged) = if xy == ['?', '?'] { (None, Some("U".into())) } else { (side(xy[0]), side(xy[1])) };
        list.push(GitChange { path: path.to_string_lossy().into_owned(), staged, unstaged, conflict });
    }
    Ok(list)
}

/// Stages files (new, changed or deleted).
pub fn stage(root: &Path, paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args = vec!["add", "--all", "--"];
    args.extend(paths.iter().map(String::as_str));
    run(root, &args).map(|_| ())
}

/// Unstages files, keeping their changes in the working tree.
pub fn unstage(root: &Path, paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    // In a repository without commits there's no HEAD to restore from: remove them from the index.
    let has_head = run(root, &["rev-parse", "--verify", "--quiet", "HEAD"]).is_ok();
    let mut args = if has_head { vec!["restore", "--staged", "--"] } else { vec!["rm", "--cached", "--quiet", "--"] };
    args.extend(paths.iter().map(String::as_str));
    run(root, &args).map(|_| ())
}

/// Commits what's staged; returns the new commit's short hash. Hooks run, as on the command line.
pub fn commit(root: &Path, message: &str) -> Result<String, String> {
    let message = message.trim();
    if message.is_empty() {
        return Err("Write a commit message first.".into());
    }
    if run(root, &["diff", "--cached", "--quiet"]).is_ok() {
        return Err("Nothing is staged. Stage the changes to commit first.".into());
    }
    // The message as an argument: no editor opens, and git keeps the text as written.
    run(root, &["commit", "--cleanup=strip", "-m", message])?;
    Ok(run(root, &["rev-parse", "--short", "HEAD"])?.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// An absolute path in the test repository.
    fn file(dir: &tempfile::TempDir, name: &str) -> String {
        dunce::canonicalize(dir.path()).unwrap().join(name).to_string_lossy().into_owned()
    }

    fn repo() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for args in [vec!["init", "-q", "-b", "main"], vec!["config", "user.name", "Test"], vec!["config", "user.email", "test@example.com"], vec!["config", "commit.gpgsign", "false"]] {
            run(dir.path(), &args).unwrap();
        }
        dir
    }

    #[test]
    fn lists_untracked_staged_and_unstaged_changes() {
        let dir = repo();
        fs::write(dir.path().join("a.md"), "one\n").unwrap();
        fs::create_dir(dir.path().join("docs")).unwrap();
        fs::write(dir.path().join("docs/b.md"), "two\n").unwrap();
        let list = changes(dir.path()).unwrap();
        assert_eq!(list.len(), 2);
        assert!(list.iter().all(|c| c.staged.is_none() && c.unstaged.as_deref() == Some("U")));
        assert!(list.iter().any(|c| c.path.replace('\\', "/").ends_with("/docs/b.md") && Path::new(&c.path).is_absolute()));

        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        let a = changes(dir.path()).unwrap().into_iter().find(|c| c.path.ends_with("a.md")).unwrap();
        assert_eq!((a.staged.as_deref(), a.unstaged.as_deref()), (Some("A"), None));

        // Changed again after staging: both sides.
        fs::write(dir.path().join("a.md"), "one\nmore\n").unwrap();
        let a = changes(dir.path()).unwrap().into_iter().find(|c| c.path.ends_with("a.md")).unwrap();
        assert_eq!((a.staged.as_deref(), a.unstaged.as_deref()), (Some("A"), Some("M")));
    }

    #[test]
    fn lists_only_changes_inside_the_open_folder() {
        let dir = repo();
        fs::create_dir(dir.path().join("docs")).unwrap();
        fs::write(dir.path().join("docs/in.md"), "in\n").unwrap();
        fs::write(dir.path().join("out.md"), "out\n").unwrap();
        let list = changes(&dir.path().join("docs")).unwrap();
        assert_eq!(list.len(), 1);
        assert!(list[0].path.ends_with("in.md"));
    }

    #[test]
    fn stages_unstages_and_commits() {
        let dir = repo();
        fs::write(dir.path().join("a.md"), "one\n").unwrap();
        assert_eq!(commit(dir.path(), "first").unwrap_err(), "Nothing is staged. Stage the changes to commit first.");
        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        // Unstaging before the first commit (no HEAD yet) works too.
        unstage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        assert_eq!(changes(dir.path()).unwrap()[0].staged, None);
        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        assert_eq!(commit(dir.path(), "   ").unwrap_err(), "Write a commit message first.");
        let hash = commit(dir.path(), "Add a.md\n\nWith a body.").unwrap();
        assert!(hash.len() >= 7);
        assert!(changes(dir.path()).unwrap().is_empty());
        let log = run(dir.path(), &["log", "-1", "--format=%B"]).unwrap();
        assert_eq!(log.trim(), "Add a.md\n\nWith a body.");

        // A deletion is staged by staging the path.
        fs::remove_file(dir.path().join("a.md")).unwrap();
        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        assert_eq!(changes(dir.path()).unwrap()[0].staged.as_deref(), Some("D"));
        unstage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        let a = &changes(dir.path()).unwrap()[0];
        assert_eq!((a.staged.as_deref(), a.unstaged.as_deref()), (None, Some("D")));
    }

    #[test]
    fn reports_git_s_own_message_when_it_refuses() {
        let dir = tempfile::tempdir().unwrap();
        let err = changes(dir.path()).unwrap_err();
        assert!(err.to_lowercase().contains("not a git repository"), "{err}");
    }
}
