//! Changing a repository: the staged and unstaged changes of each file, staging
//! and unstaging, and committing. Runs the user's `git` (so their identity,
//! hooks and signing settings apply) and returns its message when it refuses,
//! for example when there's nothing to commit or a hook fails.
//!
//! Callers check that `root` is the open folder and that every path is inside
//! it (see `commands::workspace`). Paths are absolute; git accepts them for
//! files inside the work tree.

use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

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
    run_for(dir, args, None)
}

/// Pull and push wait on the network and on credential helpers: they're stopped after this.
const NETWORK_TIMEOUT: Duration = Duration::from_secs(120);

/// Runs git, stopping it after `timeout` (None: no limit).
fn run_for(dir: &Path, args: &[&str], timeout: Option<Duration>) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(dir)
        .args(["-c", "core.quotepath=false"])
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // No terminal prompts (there's no terminal); credential helpers with their own window still work.
        .env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd.spawn().map_err(|e| format!("Git couldn't be started: {e}"))?;
    let read = |pipe: Option<Box<dyn Read + Send>>| {
        std::thread::spawn(move || {
            let mut out = Vec::new();
            if let Some(mut p) = pipe {
                let _ = p.read_to_end(&mut out);
            }
            out
        })
    };
    let stdout = read(child.stdout.take().map(|p| Box::new(p) as Box<dyn Read + Send>));
    let stderr = read(child.stderr.take().map(|p| Box::new(p) as Box<dyn Read + Send>));
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if timeout.is_none_or(|t| started.elapsed() < t) => std::thread::sleep(Duration::from_millis(20)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Git took too long (over two minutes) and was stopped. Check the network connection and try again.".into());
            }
            Err(e) => return Err(e.to_string()),
        }
    };
    let out = stdout.join().unwrap_or_default();
    let err = stderr.join().unwrap_or_default();
    if status.success() {
        Ok(String::from_utf8_lossy(&out).into_owned())
    } else {
        let err = String::from_utf8_lossy(&err).trim().to_string();
        let msg = if err.is_empty() { String::from_utf8_lossy(&out).trim().to_string() } else { err };
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

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranches {
    /// The checked-out branch; None on a detached HEAD.
    pub current: Option<String>,
    /// Local branches, sorted.
    pub branches: Vec<String>,
    /// The current branch's upstream (`origin/main`), if it has one.
    pub upstream: Option<String>,
    /// Commits to push and to pull, against the upstream.
    pub ahead: u32,
    pub behind: u32,
    /// Whether the repository has a remote to push to.
    pub has_remote: bool,
}

/// The local branches, the current one, and how it stands against its upstream.
pub fn branches(root: &Path) -> Result<GitBranches, String> {
    let current = run(root, &["symbolic-ref", "--short", "-q", "HEAD"]).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let mut list: Vec<String> = run(root, &["branch", "--format=%(refname:short)"])?.lines().map(str::trim).filter(|l| !l.is_empty()).map(String::from).collect();
    // A new repository has no branch until its first commit; show the one HEAD names.
    if let Some(c) = &current {
        if !list.contains(c) {
            list.push(c.clone());
        }
    }
    list.sort();
    let upstream = run(root, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let (mut ahead, mut behind) = (0, 0);
    if upstream.is_some() {
        let counts = run(root, &["rev-list", "--left-right", "--count", "@{u}...HEAD"])?;
        let mut parts = counts.split_whitespace().map(|n| n.parse::<u32>().unwrap_or(0));
        behind = parts.next().unwrap_or(0);
        ahead = parts.next().unwrap_or(0);
    }
    let has_remote = !run(root, &["remote"])?.trim().is_empty();
    Ok(GitBranches { current, branches: list, upstream, ahead, behind, has_remote })
}

/// A branch name git accepts (and that can't be read as an option).
fn check_branch_name(root: &Path, name: &str) -> Result<(), String> {
    if name.trim().is_empty() || name.starts_with('-') {
        return Err(format!("“{name}” isn't a valid branch name."));
    }
    run(root, &["check-ref-format", "--branch", name]).map(|_| ()).map_err(|_| format!("“{name}” isn't a valid branch name."))
}

/// Switches to another branch; git refuses when uncommitted changes would be overwritten.
pub fn switch_branch(root: &Path, name: &str) -> Result<(), String> {
    check_branch_name(root, name)?;
    run(root, &["switch", name]).map(|_| ())
}

/// Creates a branch from the current commit and switches to it.
pub fn create_branch(root: &Path, name: &str) -> Result<(), String> {
    check_branch_name(root, name)?;
    run(root, &["switch", "-c", name]).map(|_| ())
}

/// Pulls the upstream's commits, only when that needs no merge (fast-forward).
pub fn pull(root: &Path) -> Result<(), String> {
    if run(root, &["rev-parse", "--abbrev-ref", "@{u}"]).is_err() {
        return Err("This branch has no upstream to pull from. Push it first, or set one up with your Git tool.".into());
    }
    run_for(root, &["pull", "--ff-only"], Some(NETWORK_TIMEOUT)).map(|_| ()).map_err(|e| {
        if e.contains("Not possible to fast-forward") || e.contains("diverging") {
            "Your branch and its upstream both have new commits. Merge or rebase them with your Git tool, then try again.".into()
        } else {
            e
        }
    })
}

/// Pushes the current branch; the first push sets its upstream on the first remote.
pub fn push(root: &Path) -> Result<(), String> {
    if run(root, &["rev-parse", "--abbrev-ref", "@{u}"]).is_ok() {
        return run_for(root, &["push"], Some(NETWORK_TIMEOUT)).map(|_| ());
    }
    let remotes = run(root, &["remote"])?;
    let Some(remote) = remotes.lines().map(str::trim).find(|r| !r.is_empty()) else {
        return Err("This repository has no remote to push to. Add one with your Git tool first.".into());
    };
    run_for(root, &["push", "--set-upstream", remote, "HEAD"], Some(NETWORK_TIMEOUT)).map(|_| ())
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

    /// A clone of a bare "remote" (both temporary), with one commit pushed.
    fn cloned() -> (tempfile::TempDir, tempfile::TempDir) {
        let remote = tempfile::tempdir().unwrap();
        run(remote.path(), &["init", "-q", "--bare", "-b", "main"]).unwrap();
        let dir = repo();
        run(dir.path(), &["remote", "add", "origin", &remote.path().to_string_lossy()]).unwrap();
        fs::write(dir.path().join("a.md"), "one\n").unwrap();
        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        commit(dir.path(), "first").unwrap();
        (remote, dir)
    }

    #[test]
    fn pushes_a_new_branch_with_its_upstream_and_counts_commits_to_push() {
        let (_remote, dir) = cloned();
        let b = branches(dir.path()).unwrap();
        assert_eq!((b.current.as_deref(), b.upstream.as_deref(), b.has_remote), (Some("main"), None, true));
        push(dir.path()).unwrap();
        assert_eq!(branches(dir.path()).unwrap().upstream.as_deref(), Some("origin/main"));

        fs::write(dir.path().join("a.md"), "two\n").unwrap();
        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        commit(dir.path(), "second").unwrap();
        let b = branches(dir.path()).unwrap();
        assert_eq!((b.ahead, b.behind), (1, 0));
        push(dir.path()).unwrap();
        assert_eq!(branches(dir.path()).unwrap().ahead, 0);
    }

    #[test]
    fn pulls_new_commits_and_explains_diverged_branches() {
        let (remote, dir) = cloned();
        push(dir.path()).unwrap();
        // A second clone pushes a commit.
        let other = tempfile::tempdir().unwrap();
        run(other.path(), &["clone", "-q", &remote.path().to_string_lossy(), "."]).unwrap();
        for args in [vec!["config", "user.name", "Other"], vec!["config", "user.email", "other@example.com"], vec!["config", "commit.gpgsign", "false"]] {
            run(other.path(), &args).unwrap();
        }
        fs::write(other.path().join("b.md"), "from the other clone\n").unwrap();
        run(other.path(), &["add", "b.md"]).unwrap();
        run(other.path(), &["commit", "-q", "-m", "other"]).unwrap();
        run(other.path(), &["push", "-q"]).unwrap();

        run(dir.path(), &["fetch", "-q"]).unwrap();
        assert_eq!(branches(dir.path()).unwrap().behind, 1);
        pull(dir.path()).unwrap();
        assert!(dir.path().join("b.md").exists());

        // Both sides commit: no fast-forward, so pull explains instead of merging.
        fs::write(other.path().join("b.md"), "again\n").unwrap();
        run(other.path(), &["commit", "-q", "-am", "other again"]).unwrap();
        run(other.path(), &["push", "-q"]).unwrap();
        fs::write(dir.path().join("a.md"), "local\n").unwrap();
        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        commit(dir.path(), "local").unwrap();
        let err = pull(dir.path()).unwrap_err();
        assert!(err.starts_with("Your branch and its upstream both have new commits"), "{err}");
    }

    #[test]
    fn creates_and_switches_branches_and_refuses_bad_names() {
        let (_remote, dir) = cloned();
        create_branch(dir.path(), "feature/notes").unwrap();
        let b = branches(dir.path()).unwrap();
        assert_eq!(b.current.as_deref(), Some("feature/notes"));
        assert_eq!(b.branches, vec!["feature/notes".to_string(), "main".to_string()]);
        switch_branch(dir.path(), "main").unwrap();
        assert_eq!(branches(dir.path()).unwrap().current.as_deref(), Some("main"));
        for bad in ["-f", "two words", "a..b", ""] {
            assert!(create_branch(dir.path(), bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn says_when_there_is_nothing_to_push_to_or_pull_from() {
        let dir = repo();
        fs::write(dir.path().join("a.md"), "one\n").unwrap();
        stage(dir.path(), &[file(&dir, "a.md")]).unwrap();
        commit(dir.path(), "first").unwrap();
        assert!(push(dir.path()).unwrap_err().starts_with("This repository has no remote"));
        assert!(pull(dir.path()).unwrap_err().starts_with("This branch has no upstream"));
    }

    #[test]
    fn reports_git_s_own_message_when_it_refuses() {
        let dir = tempfile::tempdir().unwrap();
        let err = changes(dir.path()).unwrap_err();
        assert!(err.to_lowercase().contains("not a git repository"), "{err}");
    }
}
