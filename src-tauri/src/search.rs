//! Workspace-wide search across Markdown files ("Find in Files").

use crate::error::{AppError, AppResult};
use crate::fs_ops::{self, is_markdown};
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_FILES: usize = 20_000;
const PREVIEW_CONTEXT: usize = 60;
const SKIPPED_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub query: String,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub whole_word: bool,
    #[serde(default)]
    pub regex: bool,
    #[serde(default = "default_max")]
    pub max_results: usize,
    /// Comma-separated globs: only files matching one of them are searched (empty: all).
    #[serde(default)]
    pub include: String,
    /// Comma-separated globs: files matching any of them are skipped.
    #[serde(default)]
    pub exclude: String,
}

fn default_max() -> usize {
    2000
}

/// Positions are in UTF-16 code units so they map directly onto JavaScript
/// strings and CodeMirror offsets.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    /// 1-based line number.
    pub line: usize,
    /// 0-based column (UTF-16) of the match within the line.
    pub column: usize,
    /// Match length (UTF-16).
    pub length: usize,
    pub preview: String,
    /// Match position within `preview` (UTF-16).
    pub preview_start: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMatches {
    pub path: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub files: Vec<FileMatches>,
    pub total_matches: usize,
    pub files_searched: usize,
    pub truncated: bool,
}

pub fn build_matcher(opts: &SearchOptions) -> AppResult<Regex> {
    if opts.query.is_empty() {
        return Err(AppError::InvalidPath("Search query is empty".into()));
    }
    let mut pattern = if opts.regex { opts.query.clone() } else { regex::escape(&opts.query) };
    if opts.whole_word {
        pattern = format!(r"\b(?:{pattern})\b");
    }
    RegexBuilder::new(&pattern)
        .case_insensitive(!opts.case_sensitive)
        .size_limit(1 << 20)
        .build()
        .map_err(|e| AppError::InvalidPath(format!("Invalid regular expression: {e}")))
}

/// Converts one glob to a regex over folder-relative paths with `/` separators
/// (mirrored in `src/services/pathFilter.ts`). `**` crosses folders, `*` and `?`
/// don't. A glob without `/` matches a file or folder name anywhere; one with
/// `/` is anchored at the folder. A match on a folder covers everything in it.
fn glob_regex(glob: &str) -> Option<Regex> {
    let g = glob.trim().replace('\\', "/");
    let g = g.strip_prefix("./").unwrap_or(&g).trim_end_matches('/');
    if g.is_empty() {
        return None;
    }
    let (prefix, g) = if g.contains('/') { ("^", g.trim_start_matches('/')) } else { ("(?:^|/)", g) };
    let mut body = String::new();
    let chars: Vec<char> = g.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        match chars[i] {
            '*' if chars.get(i + 1) == Some(&'*') => {
                if chars.get(i + 2) == Some(&'/') {
                    body.push_str("(?:.*/)?");
                    i += 1;
                } else {
                    body.push_str(".*");
                }
                i += 1;
            }
            '*' => body.push_str("[^/]*"),
            '?' => body.push_str("[^/]"),
            c => body.push_str(&regex::escape(&c.to_string())),
        }
        i += 1;
    }
    RegexBuilder::new(&format!("{prefix}{body}(?:/|$)")).case_insensitive(true).build().ok()
}

/// Include and exclude globs for Find in Files.
pub struct PathFilter {
    include: Vec<Regex>,
    exclude: Vec<Regex>,
}

impl PathFilter {
    pub fn new(include: &str, exclude: &str) -> Self {
        let parse = |list: &str| list.split(',').filter_map(glob_regex).collect();
        PathFilter { include: parse(include), exclude: parse(exclude) }
    }

    /// `rel` is the path relative to the searched folder, with `/` separators.
    pub fn allows(&self, rel: &str) -> bool {
        (self.include.is_empty() || self.include.iter().any(|r| r.is_match(rel))) && !self.exclude.iter().any(|r| r.is_match(rel))
    }
}

fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// Largest char boundary <= `i`.
fn floor_boundary(s: &str, mut i: usize) -> usize {
    while i > 0 && !s.is_char_boundary(i) {
        i -= 1;
    }
    i
}

fn ceil_boundary(s: &str, mut i: usize) -> usize {
    while i < s.len() && !s.is_char_boundary(i) {
        i += 1;
    }
    i.min(s.len())
}

pub fn search_text(text: &str, re: &Regex, limit: usize) -> Vec<SearchMatch> {
    let mut out = Vec::new();
    for (idx, line) in text.lines().enumerate() {
        let line = line.strip_suffix('\r').unwrap_or(line);
        for m in re.find_iter(line) {
            if m.start() == m.end() {
                continue; // zero-width matches aren't useful results
            }
            let start = floor_boundary(line, m.start().saturating_sub(PREVIEW_CONTEXT));
            let end = ceil_boundary(line, m.end() + PREVIEW_CONTEXT * 2);
            let mut preview = String::new();
            if start > 0 {
                preview.push('…');
            }
            let lead = preview.encode_utf16().count();
            preview.push_str(&line[start..end]);
            if end < line.len() {
                preview.push('…');
            }
            out.push(SearchMatch {
                line: idx + 1,
                column: utf16_len(&line[..m.start()]),
                length: utf16_len(m.as_str()),
                preview,
                preview_start: lead + utf16_len(&line[start..m.start()]),
            });
            if out.len() >= limit {
                return out;
            }
        }
    }
    out
}

/// Markdown and image files under `root`, for link completion.
pub fn workspace_files(root: &Path) -> Vec<String> {
    walk(root, &|p| is_markdown(p) || fs_ops::is_image(p)).iter().map(|p| fs_ops::path_string(p)).collect()
}

/// Documents under `root` that can be converted to Markdown (batch conversion).
pub fn convertible_files(root: &Path) -> Vec<String> {
    const EXTS: &[&str] = &["docx", "pdf", "html", "htm", "csv", "tsv"];
    walk(root, &|p| {
        p.extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| EXTS.contains(&e.to_ascii_lowercase().as_str()))
    })
    .iter()
    .map(|p| fs_ops::path_string(p))
    .collect()
}

fn collect_files(root: &Path) -> Vec<PathBuf> {
    walk(root, &is_markdown)
}

fn walk(root: &Path, keep: &dyn Fn(&Path) -> bool) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        let mut children: Vec<_> = entries.flatten().collect();
        children.sort_by_key(|e| e.file_name());
        for entry in children.into_iter().rev() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            let Ok(file_type) = entry.file_type() else { continue };
            // Symlinks are not followed, so a search can never escape the workspace.
            if file_type.is_dir() {
                if !SKIPPED_DIRS.contains(&name.as_str()) {
                    stack.push(entry.path());
                }
            } else if file_type.is_file() && keep(&entry.path()) {
                files.push(entry.path());
                if files.len() >= MAX_FILES {
                    return files;
                }
            }
        }
    }
    files.sort();
    files
}

pub fn search_workspace(root: &Path, opts: &SearchOptions) -> AppResult<SearchResult> {
    let re = build_matcher(opts)?;
    let limit = opts.max_results.clamp(1, 10_000);
    let filter = PathFilter::new(&opts.include, &opts.exclude);
    let files = collect_files(root).into_iter().filter(|p| {
        let rel = p.strip_prefix(root).unwrap_or(p).to_string_lossy().replace('\\', "/");
        filter.allows(&rel)
    });
    let mut result = SearchResult { files: Vec::new(), total_matches: 0, files_searched: 0, truncated: false };
    for path in files {
        if result.total_matches >= limit {
            result.truncated = true;
            break;
        }
        let Ok(meta) = fs::metadata(&path) else { continue };
        if meta.len() > MAX_FILE_BYTES {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else { continue };
        let Ok(text) = std::str::from_utf8(bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes)) else {
            continue;
        };
        result.files_searched += 1;
        let matches = search_text(text, &re, limit - result.total_matches);
        if !matches.is_empty() {
            result.total_matches += matches.len();
            result.files.push(FileMatches { path: fs_ops::path_string(&path), matches });
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts(q: &str) -> SearchOptions {
        SearchOptions { query: q.into(), case_sensitive: false, whole_word: false, regex: false, max_results: 100, include: String::new(), exclude: String::new() }
    }

    #[test]
    fn literal_case_and_word_modes() {
        let text = "Hello world\nhello World, worldwide\r\n";
        let re = build_matcher(&opts("world")).unwrap();
        let m = search_text(text, &re, 100);
        assert_eq!(m.len(), 3);
        assert_eq!((m[0].line, m[0].column, m[0].length), (1, 6, 5));

        let re = build_matcher(&SearchOptions { case_sensitive: true, ..opts("World") }).unwrap();
        assert_eq!(search_text(text, &re, 100).len(), 1);

        let re = build_matcher(&SearchOptions { whole_word: true, ..opts("world") }).unwrap();
        assert_eq!(search_text(text, &re, 100).len(), 2);

        // Literal mode escapes regex syntax.
        let re = build_matcher(&opts("a.b")).unwrap();
        assert_eq!(search_text("axb a.b", &re, 100).len(), 1);
    }

    #[test]
    fn regex_mode_and_errors() {
        let re = build_matcher(&SearchOptions { regex: true, ..opts(r"\d{3}") }).unwrap();
        assert_eq!(search_text("a 123 b 45 c 678", &re, 100).len(), 2);
        assert!(build_matcher(&SearchOptions { regex: true, ..opts("(") }).is_err());
        assert!(build_matcher(&opts("")).is_err());
    }

    #[test]
    fn utf16_columns_for_non_ascii() {
        let re = build_matcher(&opts("x")).unwrap();
        let m = search_text("🚀é x", &re, 100);
        // 🚀 is 2 UTF-16 units, é is 1, space 1.
        assert_eq!(m[0].column, 4);
        assert_eq!(&m[0].preview, "🚀é x");
        assert_eq!(m[0].preview_start, 4);
    }

    #[test]
    fn lists_markdown_and_images() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join("img")).unwrap();
        fs::write(tmp.path().join("a.md"), "").unwrap();
        fs::write(tmp.path().join("img").join("x.PNG"), "").unwrap();
        fs::write(tmp.path().join("notes.txt"), "").unwrap();
        let files = workspace_files(tmp.path());
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn lists_convertible_documents() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join("sub")).unwrap();
        fs::create_dir_all(tmp.path().join("node_modules")).unwrap();
        for name in ["a.DOCX", "b.pdf", "sub/c.htm", "sub/d.tsv", "e.md", "f.doc", "node_modules/g.pdf"] {
            fs::write(tmp.path().join(name), "").unwrap();
        }
        let mut names: Vec<String> = convertible_files(tmp.path())
            .iter()
            .map(|p| Path::new(p).file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(names, ["a.DOCX", "b.pdf", "c.htm", "d.tsv"]);
    }

    #[test]
    fn walks_markdown_files_and_limits_results() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join("docs")).unwrap();
        fs::create_dir_all(tmp.path().join("node_modules")).unwrap();
        fs::create_dir_all(tmp.path().join(".git")).unwrap();
        fs::write(tmp.path().join("a.md"), "needle\nneedle").unwrap();
        fs::write(tmp.path().join("docs").join("b.markdown"), "a needle").unwrap();
        fs::write(tmp.path().join("c.txt"), "needle").unwrap();
        fs::write(tmp.path().join("node_modules").join("x.md"), "needle").unwrap();
        fs::write(tmp.path().join(".git").join("y.md"), "needle").unwrap();

        let r = search_workspace(tmp.path(), &opts("needle")).unwrap();
        assert_eq!(r.files.len(), 2);
        assert_eq!(r.total_matches, 3);
        assert!(!r.truncated);

        let r = search_workspace(tmp.path(), &SearchOptions { max_results: 1, ..opts("needle") }).unwrap();
        assert_eq!(r.total_matches, 1);
        assert!(r.truncated);

        let only_docs = SearchOptions { include: "docs".into(), ..opts("needle") };
        assert_eq!(search_workspace(tmp.path(), &only_docs).unwrap().files.len(), 1);
        let no_docs = SearchOptions { exclude: "docs/**, c.txt".into(), ..opts("needle") };
        let r = search_workspace(tmp.path(), &no_docs).unwrap();
        assert_eq!(r.files.len(), 1);
        assert!(r.files[0].path.ends_with("a.md"));
    }

    #[test]
    fn path_filters_follow_glob_rules() {
        // The same cases as tests/pathFilter.test.ts.
        let f = |inc: &str, exc: &str, path: &str| PathFilter::new(inc, exc).allows(path);
        assert!(f("", "", "a.md"));
        assert!(f("docs", "", "docs/a.md"));
        assert!(f("docs", "", "x/docs/a.md"));
        assert!(!f("docs", "", "docsy/a.md"));
        assert!(f("docs/**", "", "docs/deep/a.md"));
        assert!(!f("/docs", "", "x/docs/a.md"));
        assert!(f("*.draft.md", "", "notes/x.DRAFT.md"));
        assert!(!f("*.draft.md", "", "notes/x.md"));
        assert!(f("**/api/*.md", "", "a/b/api/x.md"));
        assert!(!f("**/api/*.md", "", "a/b/api/v1/x.md"));
        assert!(f("guide?.md", "", "guide1.md"));
        assert!(!f("", "drafts, archive/", "drafts/a.md"));
        assert!(!f("", "drafts, archive/", "archive/old/a.md"));
        assert!(f("", "drafts, archive/", "docs/a.md"));
        assert!(!f("docs", "*.draft.md", "docs/x.draft.md"));
        assert!(f(" , ", "", "a.md"));
    }
}
