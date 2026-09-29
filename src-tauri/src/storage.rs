//! Settings, crash recovery and diagnostic logs, all stored in the platform's
//! application data locations (FR-062, FR-063, FR-004, SRS §16).

use crate::error::AppResult;
use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_LOG_BYTES: u64 = 1024 * 1024;

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Bundle identifier used before the app was renamed from Markdown Studio to Markpion.
pub const LEGACY_IDENTIFIER: &str = "com.markdownstudio.app";

/// Copies settings, recent files, recovery and history from the directory used
/// under the old identifier (a sibling of `dir`) the first time `dir` is used,
/// so upgrading from Markdown Studio keeps them. The old directory is left in
/// place; the browser engine's cache (`EBWebView`) is not copied.
pub fn migrate_legacy_dir(dir: &Path) {
    let Some(legacy) = dir.parent().map(|p| p.join(LEGACY_IDENTIFIER)) else { return };
    if dir.exists() || !legacy.is_dir() || legacy == dir {
        return;
    }
    let _ = copy_dir(&legacy, dir);
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            if entry.file_name() != "EBWebView" {
                copy_dir(&entry.path(), &target)?;
            }
        } else if kind.is_file() {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// Where IT administrators put the managed-settings policy (read-only for the app).
pub fn policy_path() -> PathBuf {
    if cfg!(windows) {
        let base = std::env::var_os("ProgramData").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
        base.join("Markpion").join("policy.json")
    } else if cfg!(target_os = "macos") {
        PathBuf::from("/Library/Application Support/Markpion/policy.json")
    } else {
        PathBuf::from("/etc/markpion/policy.json")
    }
}

/// Reads a managed-settings policy: `Ok(None)` if there's none; an error
/// message if it exists but can't be used (too large, not a JSON object).
pub fn read_policy(path: &Path) -> Result<Option<Value>, String> {
    const MAX_POLICY_BYTES: u64 = 64 * 1024;
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return Ok(None),
    };
    if meta.len() > MAX_POLICY_BYTES {
        return Err(format!("policy file is larger than {MAX_POLICY_BYTES} bytes"));
    }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}')) {
        Ok(v) if v.is_object() => Ok(Some(v)),
        Ok(_) => Err("policy file must contain a JSON object".into()),
        Err(e) => Err(format!("policy file isn't valid JSON: {e}")),
    }
}

/// Writes JSON through a temporary file so a crash mid-write cannot corrupt it.
pub fn write_json(path: &Path, value: &Value) -> AppResult<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(value).unwrap_or_default())?;
    fs::rename(&tmp, path)?;
    Ok(())
}

/// Reads JSON. A missing file yields `Null`. A corrupt file is renamed aside
/// (so it can still be recovered by hand) and `Null` is returned so the caller
/// falls back to safe defaults (SRS §12, "Corrupt configuration").
pub fn read_json(path: &Path) -> Value {
    let Ok(bytes) = fs::read(path) else {
        return Value::Null;
    };
    match serde_json::from_slice(&bytes) {
        Ok(v) => v,
        Err(_) => {
            let aside = path.with_extension(format!("corrupt-{}.json", now_secs()));
            let _ = fs::rename(path, aside);
            Value::Null
        }
    }
}

pub struct Logger {
    path: PathBuf,
    home: Option<String>,
}

impl Logger {
    pub fn new(dir: PathBuf, home: Option<PathBuf>) -> Self {
        let _ = fs::create_dir_all(&dir);
        Logger {
            path: dir.join("markpion.log"),
            home: home.map(|h| h.to_string_lossy().into_owned()),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Replaces the user's home directory with `~` so logs shared for support
    /// don't reveal account names (SRS §16).
    pub fn redact(&self, msg: &str) -> String {
        match &self.home {
            Some(home) if !home.is_empty() => msg.replace(home.as_str(), "~"),
            _ => msg.to_string(),
        }
    }

    pub fn log(&self, level: &str, category: &str, message: &str) {
        if let Ok(meta) = fs::metadata(&self.path) {
            if meta.len() > MAX_LOG_BYTES {
                let _ = fs::rename(&self.path, self.path.with_extension("log.1"));
            }
        }
        let line = format!(
            "{} [{}] v{} {}: {}\n",
            now_secs(),
            level.to_uppercase(),
            env!("CARGO_PKG_VERSION"),
            category,
            self.redact(message).replace('\n', " ")
        );
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&self.path) {
            let _ = f.write_all(line.as_bytes());
        }
        if cfg!(debug_assertions) {
            eprint!("{line}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_policies_and_rejects_bad_ones() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("policy.json");
        assert_eq!(read_policy(&p), Ok(None));
        fs::write(&p, "\u{feff}{\"settings\":{\"aiEnabled\":false},\"locked\":[\"aiEnabled\"]}").unwrap();
        assert_eq!(read_policy(&p).unwrap().unwrap()["locked"][0], "aiEnabled");
        fs::write(&p, "[1,2]").unwrap();
        assert!(read_policy(&p).is_err());
        fs::write(&p, "{ nope").unwrap();
        assert!(read_policy(&p).is_err());
        fs::write(&p, "x".repeat(70 * 1024)).unwrap();
        assert!(read_policy(&p).unwrap_err().contains("larger"));
    }

    #[test]
    fn legacy_dir_is_copied_once_without_webview_cache() {
        let tmp = tempfile::tempdir().unwrap();
        let legacy = tmp.path().join(LEGACY_IDENTIFIER);
        fs::create_dir_all(legacy.join("history").join("a")).unwrap();
        fs::create_dir_all(legacy.join("EBWebView")).unwrap();
        fs::write(legacy.join("settings.json"), "{}").unwrap();
        fs::write(legacy.join("history").join("a").join("1.md"), "x").unwrap();
        let dir = tmp.path().join("com.markpion.app");
        migrate_legacy_dir(&dir);
        assert_eq!(fs::read_to_string(dir.join("settings.json")).unwrap(), "{}");
        assert!(dir.join("history").join("a").join("1.md").is_file());
        assert!(!dir.join("EBWebView").exists());
        assert!(legacy.join("settings.json").is_file());
        // Once the new directory exists, it is never overwritten.
        fs::write(dir.join("settings.json"), "{\"new\":1}").unwrap();
        migrate_legacy_dir(&dir);
        assert_eq!(fs::read_to_string(dir.join("settings.json")).unwrap(), "{\"new\":1}");
    }

    #[test]
    fn corrupt_json_falls_back_to_null_and_is_preserved() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("settings.json");
        fs::write(&p, "{ not json").unwrap();
        assert_eq!(read_json(&p), Value::Null);
        assert!(!p.exists());
        assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 1);
    }

    #[test]
    fn json_round_trip() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("nested").join("settings.json");
        let v = serde_json::json!({ "theme": "dark", "fontSize": 15 });
        write_json(&p, &v).unwrap();
        assert_eq!(read_json(&p), v);
    }

    #[test]
    fn redacts_home_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let logger = Logger::new(tmp.path().to_path_buf(), Some(PathBuf::from("/home/alice")));
        assert_eq!(logger.redact("open /home/alice/notes.md"), "open ~/notes.md");
    }
}
