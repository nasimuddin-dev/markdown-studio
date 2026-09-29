use serde::Serialize;
use std::io;

/// Error returned to the frontend. Serialized as `{ "kind": "...", "message": "..." }`
/// so the UI can map each category to an actionable message (SRS §12).
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    NotFound(String),
    PermissionDenied(String),
    /// The path is outside every location the user has approved (SEC-002/003).
    OutOfScope(String),
    InvalidPath(String),
    Encoding(String),
    /// The file changed on disk since it was last read (FR-018).
    Conflict(String),
    AlreadyExists(String),
    DiskFull(String),
    TooLarge(String),
    Io(String),
    /// The AI assistant couldn't complete a request; the message is for the user.
    Ai(String),
}

impl AppError {
    pub fn category(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "notFound",
            AppError::PermissionDenied(_) => "permissionDenied",
            AppError::OutOfScope(_) => "outOfScope",
            AppError::InvalidPath(_) => "invalidPath",
            AppError::Encoding(_) => "encoding",
            AppError::Conflict(_) => "conflict",
            AppError::AlreadyExists(_) => "alreadyExists",
            AppError::DiskFull(_) => "diskFull",
            AppError::TooLarge(_) => "tooLarge",
            AppError::Io(_) => "io",
            AppError::Ai(_) => "ai",
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let msg = match self {
            AppError::NotFound(m)
            | AppError::PermissionDenied(m)
            | AppError::OutOfScope(m)
            | AppError::InvalidPath(m)
            | AppError::Encoding(m)
            | AppError::Conflict(m)
            | AppError::AlreadyExists(m)
            | AppError::DiskFull(m)
            | AppError::TooLarge(m)
            | AppError::Io(m)
            | AppError::Ai(m) => m,
        };
        write!(f, "{}: {}", self.category(), msg)
    }
}

impl From<io::Error> for AppError {
    fn from(e: io::Error) -> Self {
        let msg = e.to_string();
        match e.kind() {
            io::ErrorKind::NotFound => AppError::NotFound(msg),
            io::ErrorKind::PermissionDenied | io::ErrorKind::ReadOnlyFilesystem => {
                AppError::PermissionDenied(msg)
            }
            io::ErrorKind::AlreadyExists => AppError::AlreadyExists(msg),
            io::ErrorKind::StorageFull | io::ErrorKind::QuotaExceeded => AppError::DiskFull(msg),
            _ => AppError::Io(msg),
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
