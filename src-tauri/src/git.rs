//! Read-only Git status for the open folder: the branch and each changed
//! file's state, shown in the Explorer and status bar. Runs the user's `git`
//! with optional locks and fsmonitor hooks disabled; returns `None` when Git
//! isn't installed or the folder isn't in a repository.

use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitFile {
    /// Absolute path.
    pub path: String,
    /// One letter: M modified, A added, D deleted, R renamed, U untracked, C conflict.
    pub status: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    /// The branch name, or `None` on a detached HEAD.
    pub branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<GitFile>,
}

const TIMEOUT: Duration = Duration::from_secs(10);
/// Very large change sets are cut off; the Explorer only needs what's visible.
const MAX_FILES: usize = 5000;

fn git(dir: &Path, args: &[&str]) -> Option<Vec<u8>> {
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(dir)
        .args(["-c", "core.fsmonitor=false", "-c", "core.quotepath=false", "--no-optional-locks"])
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd.spawn().ok()?;
    let mut stdout = child.stdout.take()?;
    let reader = std::thread::spawn(move || {
        let mut out = Vec::new();
        stdout.read_to_end(&mut out).map(|_| out)
    });
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let out = reader.join().ok()?.ok()?;
                return status.success().then_some(out);
            }
            Ok(None) if started.elapsed() < TIMEOUT => std::thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
}

/// Maps a porcelain XY code to one letter.
fn letter(xy: &str) -> &'static str {
    let (x, y) = (xy.chars().next().unwrap_or(' '), xy.chars().nth(1).unwrap_or(' '));
    if xy == "??" {
        "U"
    } else if x == 'U' || y == 'U' || xy == "AA" || xy == "DD" {
        "C"
    } else if x == 'R' || y == 'R' {
        "R"
    } else if x == 'A' {
        "A"
    } else if x == 'D' || y == 'D' {
        "D"
    } else {
        "M"
    }
}

/// Parses `git status --porcelain=v1 -z --branch` output; paths are joined to `top`.
pub fn parse_status(out: &[u8], top: &Path) -> GitStatus {
    let text = String::from_utf8_lossy(out);
    let mut entries = text.split('\0').filter(|s| !s.is_empty());
    let mut status = GitStatus { branch: None, ahead: 0, behind: 0, files: Vec::new() };
    while let Some(entry) = entries.next() {
        if let Some(head) = entry.strip_prefix("## ") {
            // "main...origin/main [ahead 1, behind 2]", "No commits yet on main", "HEAD (no branch)"
            let (name, rest) = head.split_once(" [").unwrap_or((head, ""));
            let name = name.strip_prefix("No commits yet on ").unwrap_or(name);
            let local = name.split("...").next().unwrap_or(name);
            status.branch = (!local.starts_with("HEAD")).then(|| local.to_string());
            for part in rest.trim_end_matches(']').split(", ") {
                if let Some(n) = part.strip_prefix("ahead ") {
                    status.ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = part.strip_prefix("behind ") {
                    status.behind = n.parse().unwrap_or(0);
                }
            }
            continue;
        }
        if entry.len() < 4 {
            continue;
        }
        let (xy, rel) = (&entry[..2], &entry[3..]);
        if xy.starts_with('R') || xy.starts_with('C') {
            entries.next(); // the original path of a rename or copy
        }
        if status.files.len() < MAX_FILES {
            let path: PathBuf = rel.trim_end_matches('/').split('/').fold(top.to_path_buf(), |p, seg| p.join(seg));
            status.files.push(GitFile { path: crate::fs_ops::path_string(&path), status: letter(xy).to_string() });
        }
    }
    status
}

/// Status of the repository containing `dir`, or `None` (no Git, not a repository, timed out).
pub fn status(dir: &Path) -> Option<GitStatus> {
    let top = git(dir, &["rev-parse", "--show-toplevel"])?;
    let top = PathBuf::from(String::from_utf8_lossy(&top).trim());
    let out = git(dir, &["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"])?;
    Some(parse_status(&out, &top))
}

/// Committed files larger than this aren't compared in the editor.
const MAX_HEAD_BYTES: usize = 5 * 1024 * 1024;

/// The text of `file` as of the last commit (`HEAD`), for the editor's change
/// markers; `None` when it isn't tracked, isn't text, is too large, or there's
/// no Git or repository. Line endings are normalized to `\n` and a BOM removed.
pub fn head_text(file: &Path) -> Option<String> {
    let dir = file.parent()?;
    let name = file.file_name()?.to_str()?;
    // `HEAD:./name` is resolved relative to `-C dir`, whatever the repository root.
    let out = git(dir, &["show", &format!("HEAD:./{name}")])?;
    if out.len() > MAX_HEAD_BYTES {
        return None;
    }
    let text = String::from_utf8(out).ok()?;
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
    Some(text.replace("\r\n", "\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_branch_counts_and_file_states() {
        let out = b"## main...origin/main [ahead 2, behind 1]\0 M docs/a.md\0?? new file.md\0R  b.md\0old.md\0A  c.md\0UU d.md\0 D gone.md\0";
        let s = parse_status(out, Path::new("/repo"));
        assert_eq!(s.branch.as_deref(), Some("main"));
        assert_eq!((s.ahead, s.behind), (2, 1));
        let got: Vec<(String, String)> = s.files.iter().map(|f| (f.path.replace('\\', "/"), f.status.clone())).collect();
        let want = [("/repo/docs/a.md", "M"), ("/repo/new file.md", "U"), ("/repo/b.md", "R"), ("/repo/c.md", "A"), ("/repo/d.md", "C"), ("/repo/gone.md", "D")];
        assert_eq!(got, want.map(|(p, l)| (p.to_string(), l.to_string())));
    }

    #[test]
    fn handles_new_repositories_and_detached_heads() {
        assert_eq!(parse_status(b"## No commits yet on main\0", Path::new("/r")).branch.as_deref(), Some("main"));
        assert_eq!(parse_status(b"## HEAD (no branch)\0", Path::new("/r")).branch, None);
    }

    #[test]
    fn reads_a_real_repository_when_git_is_installed() {
        let dir = std::env::temp_dir().join(format!("markpion-git-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        if git(&dir, &["init", "-q", "-b", "work"]).is_none() {
            let _ = std::fs::remove_dir_all(&dir);
            return; // no git on this machine
        }
        std::fs::write(dir.join("note.md"), "x").unwrap();
        let s = status(&dir).unwrap();
        assert_eq!(s.branch.as_deref(), Some("work"));
        assert_eq!(s.files.len(), 1);
        assert_eq!(s.files[0].status, "U");
        assert!(s.files[0].path.ends_with("note.md"));

        // The committed text, from a subfolder too; nothing for untracked files.
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("sub").join("n é.md"), "\u{feff}one\r\ntwo\r\n").unwrap();
        assert!(head_text(&dir.join("sub").join("n é.md")).is_none());
        let commit = ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.autocrlf=false", "commit", "-q", "-m", "x"];
        git(&dir, &["-c", "core.autocrlf=false", "add", "-A"]).unwrap();
        git(&dir, &commit).unwrap();
        std::fs::write(dir.join("sub").join("n é.md"), "changed").unwrap();
        assert_eq!(head_text(&dir.join("sub").join("n é.md")).as_deref(), Some("one\ntwo\n"));
        assert_eq!(head_text(&dir.join("note.md")).as_deref(), Some("x"));
        assert!(head_text(&dir.join("missing.md")).is_none());
        let _ = std::fs::remove_dir_all(&dir);
        assert!(status(&std::env::temp_dir().join("markpion-no-such-dir")).is_none());
    }
}
