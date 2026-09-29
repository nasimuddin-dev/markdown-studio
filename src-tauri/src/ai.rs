//! Optional AI writing assistant, using Anthropic's Claude API.
//!
//! Off until the user turns it on and enters their own API key. The key is
//! kept in the OS credential store (Windows Credential Manager, macOS
//! Keychain; on Linux a file readable only by the user in the app's settings
//! folder) and is only ever read here, in the native process: the web view
//! never sees it, and requests go straight to api.anthropic.com. Text is sent
//! only when the user runs an AI command; nothing is logged but its size.

use crate::error::{AppError, AppResult};
use serde::Serialize;
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;

const API_BASE: &str = "https://api.anthropic.com/v1";
const API_VERSION: &str = "2023-06-01";
/// Server-side refusal fallback ("default" form): a declined request is retried
/// on the model Anthropic recommends for that category, inside the same call.
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";

/// Models the Settings offer (the default first).
pub const MODELS: [&str; 3] = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"];
/// A request's text is limited so a stray "select all" can't send a huge document.
pub const MAX_INPUT_CHARS: usize = 200_000;
const MAX_OUTPUT_TOKENS: u32 = 16_000;

// ------------------------------------------------------------------ key storage

#[cfg(any(windows, target_os = "macos"))]
fn entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new("Markpion", "anthropic-api-key").map_err(|e| AppError::Ai(format!("The credential store isn't available: {e}")))
}

/// Where the key is kept, for the Settings text.
pub fn key_storage_name() -> &'static str {
    if cfg!(windows) {
        "Windows Credential Manager"
    } else if cfg!(target_os = "macos") {
        "the macOS Keychain"
    } else {
        "a file only your account can read, in Markpion's settings folder"
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
fn key_file(config_dir: &Path) -> std::path::PathBuf {
    config_dir.join("ai-key")
}

pub fn load_key(config_dir: &Path) -> AppResult<Option<String>> {
    #[cfg(any(windows, target_os = "macos"))]
    {
        let _ = config_dir;
        match entry()?.get_password() {
            Ok(k) => Ok(Some(k)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(AppError::Ai(format!("Couldn't read the API key from {}: {e}", key_storage_name()))),
        }
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        match std::fs::read_to_string(key_file(config_dir)) {
            Ok(k) if !k.trim().is_empty() => Ok(Some(k.trim().to_string())),
            Ok(_) => Ok(None),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
}

pub fn save_key(config_dir: &Path, key: &str) -> AppResult<()> {
    #[cfg(any(windows, target_os = "macos"))]
    {
        let _ = config_dir;
        entry()?
            .set_password(key)
            .map_err(|e| AppError::Ai(format!("Couldn't save the API key in {}: {e}", key_storage_name())))
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        std::fs::create_dir_all(config_dir)?;
        let mut f = std::fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(key_file(config_dir))?;
        f.write_all(key.as_bytes())?;
        Ok(())
    }
}

pub fn delete_key(config_dir: &Path) -> AppResult<()> {
    #[cfg(any(windows, target_os = "macos"))]
    {
        let _ = config_dir;
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(AppError::Ai(format!("Couldn't remove the API key: {e}"))),
        }
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        match std::fs::remove_file(key_file(config_dir)) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}

/// Checks the shape of an Anthropic API key before storing it.
pub fn validate_key(key: &str) -> AppResult<String> {
    let key = key.trim();
    if !key.starts_with("sk-ant-") || key.len() < 20 || key.len() > 400 || key.chars().any(|c| c.is_whitespace()) {
        return Err(AppError::Ai(
            "That doesn't look like an Anthropic API key (they start with “sk-ant-”). Create one at console.anthropic.com.".into(),
        ));
    }
    Ok(key.to_string())
}

// ------------------------------------------------------------------ requests

/// Whether a model takes `output_config.effort` and server-side fallbacks.
fn is_current_generation(model: &str) -> bool {
    model == "claude-opus-5-5" || model == "claude-sonnet-5-5"
}

/// The Messages API request for one AI command.
pub fn request_body(model: &str, system: &str, prompt: &str) -> Value {
    let mut body = json!({
        "model": model,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "system": system,
        "messages": [{ "role": "user", "content": prompt }],
    });
    if is_current_generation(model) {
        // Writing edits don't need deep reasoning; low effort keeps them quick.
        body["output_config"] = json!({ "effort": "low" });
        body["fallbacks"] = json!("default");
    }
    body
}

/// The beta header a request needs, if any.
pub fn beta_header(model: &str) -> Option<&'static str> {
    is_current_generation(model).then_some(FALLBACK_BETA)
}

/// The text of a successful response, or an error the user can act on.
pub fn parse_response(status: u16, body: &str) -> AppResult<String> {
    let v: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    if status == 200 {
        let stop = v["stop_reason"].as_str().unwrap_or("");
        if stop == "refusal" {
            return Err(AppError::Ai(
                "Claude declined this request. Try rewording the instruction or selecting different text.".into(),
            ));
        }
        let text: String = v["content"]
            .as_array()
            .map(|blocks| {
                blocks
                    .iter()
                    .filter(|b| b["type"] == "text")
                    .filter_map(|b| b["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default();
        if stop == "max_tokens" {
            return Err(AppError::Ai("The answer was too long and got cut off. Select less text and try again.".into()));
        }
        if text.trim().is_empty() {
            return Err(AppError::Ai("Claude returned an empty answer. Try again.".into()));
        }
        return Ok(text);
    }
    let api_message = v["error"]["message"].as_str().unwrap_or("").to_string();
    let error_type = v["error"]["type"].as_str().unwrap_or("");
    let message = match (status, error_type) {
        (401, _) | (_, "authentication_error") => {
            "The API key was rejected. Check it in Settings → AI Assistant.".to_string()
        }
        (402, _) | (_, "billing_error") => {
            "Your Anthropic account can't be billed (for example, no credit left). Check it at console.anthropic.com.".to_string()
        }
        (403, _) | (_, "permission_error") => format!("This API key isn't allowed to use this model. {api_message}"),
        (404, _) | (_, "not_found_error") => format!("The model isn't available for this API key. Choose another in Settings. {api_message}"),
        (413, _) => "The selected text is too long for one request. Select less text.".to_string(),
        (429, _) | (_, "rate_limit_error") => "Too many requests right now. Wait a moment and try again.".to_string(),
        (529, _) | (_, "overloaded_error") => "Claude is busy right now. Try again in a moment.".to_string(),
        (s, _) if s >= 500 => "The Claude API had a problem. Try again in a moment.".to_string(),
        _ => format!("The request was rejected: {api_message}"),
    };
    Err(AppError::Ai(message.trim().to_string()))
}

fn retryable(status: u16) -> bool {
    status == 429 || status == 529 || (500..600).contains(&status)
}

fn client() -> AppResult<reqwest::Client> {
    // reqwest is built without a bundled crypto provider (like the updater's); make sure one is installed.
    let _ = rustls::crypto::ring::default_provider().install_default();
    reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .user_agent(concat!("Markpion/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| AppError::Ai(format!("Couldn't start a secure connection: {e}")))
}

fn network_error(e: reqwest::Error) -> AppError {
    if e.is_timeout() {
        AppError::Ai("Claude took too long to answer. Try again, or select less text.".into())
    } else {
        AppError::Ai("Couldn't reach the Claude API. Check your internet connection (and proxy settings).".into())
    }
}

/// One server-sent event of a streamed answer, reduced to what the app needs.
#[derive(Debug, PartialEq)]
pub enum StreamEvent {
    /// More answer text. Text is never taken back: after a mid-answer refusal
    /// fallback, the next model continues from it (a `fallback` block marks the
    /// switch and is ignored here).
    Text(String),
    /// Why generation stopped (from `message_delta`).
    Stop(String),
    /// The API reported an error inside the stream (e.g. overloaded).
    Error { error_type: String, message: String },
    Other,
}

/// Parses the `data:` JSON of one server-sent event.
pub fn parse_stream_event(data: &str) -> StreamEvent {
    let v: Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return StreamEvent::Other,
    };
    match v["type"].as_str().unwrap_or("") {
        "content_block_delta" if v["delta"]["type"] == "text_delta" => {
            StreamEvent::Text(v["delta"]["text"].as_str().unwrap_or("").to_string())
        }
        "message_delta" => match v["delta"]["stop_reason"].as_str() {
            Some(reason) => StreamEvent::Stop(reason.to_string()),
            None => StreamEvent::Other,
        },
        "error" => StreamEvent::Error {
            error_type: v["error"]["type"].as_str().unwrap_or("").to_string(),
            message: v["error"]["message"].as_str().unwrap_or("").to_string(),
        },
        _ => StreamEvent::Other,
    }
}

/// Splits complete server-sent events off the front of `buffer`, returning their `data:` payloads.
pub fn drain_sse_events(buffer: &mut String) -> Vec<String> {
    let mut out = Vec::new();
    loop {
        let normalized = buffer.replace("\r\n", "\n");
        let Some(end) = normalized.find("\n\n") else {
            *buffer = normalized;
            return out;
        };
        let event = &normalized[..end];
        let data: Vec<&str> = event
            .lines()
            .filter_map(|l| l.strip_prefix("data:"))
            .map(|d| d.strip_prefix(' ').unwrap_or(d))
            .collect();
        if !data.is_empty() {
            out.push(data.join("\n"));
        }
        *buffer = normalized[end + 2..].to_string();
    }
}

/// Like [`complete`], but streams the answer: `on_text` receives each piece as
/// it arrives, and `cancelled` is checked between pieces (stopping the
/// download ends the request, so the rest isn't generated or billed).
pub async fn complete_stream(
    key: &str,
    model: &str,
    system: &str,
    prompt: &str,
    cancelled: impl Fn() -> bool,
    mut on_text: impl FnMut(&str),
) -> AppResult<Option<String>> {
    use futures_util::StreamExt;
    if !MODELS.contains(&model) {
        return Err(AppError::Ai(format!("Unknown model “{model}”.")));
    }
    if prompt.chars().count() > MAX_INPUT_CHARS {
        return Err(AppError::Ai(format!(
            "The selected text is too long ({} characters; the limit is {MAX_INPUT_CHARS}). Select less text.",
            prompt.chars().count()
        )));
    }
    let http = client()?;
    let mut body = request_body(model, system, prompt);
    body["stream"] = json!(true);
    let mut attempt = 0;
    let res = loop {
        let mut req = http
            .post(format!("{API_BASE}/messages"))
            .header("x-api-key", key)
            .header("anthropic-version", API_VERSION)
            .json(&body);
        if let Some(beta) = beta_header(model) {
            req = req.header("anthropic-beta", beta);
        }
        let res = req.send().await.map_err(network_error)?;
        let status = res.status().as_u16();
        if status == 200 {
            break res;
        }
        let wait = res
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(2 << attempt)
            .min(20);
        let text = res.text().await.map_err(network_error)?;
        if retryable(status) && attempt < 2 && !cancelled() {
            attempt += 1;
            tokio::time::sleep(Duration::from_secs(wait)).await;
            continue;
        }
        return parse_response(status, &text).map(Some);
    };

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    let mut answer = String::new();
    let mut stop = String::new();
    while let Some(chunk) = stream.next().await {
        if cancelled() {
            return Ok(None);
        }
        let chunk = chunk.map_err(network_error)?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        for data in drain_sse_events(&mut buffer) {
            match parse_stream_event(&data) {
                StreamEvent::Text(t) => {
                    answer.push_str(&t);
                    on_text(&t);
                }
                StreamEvent::Stop(reason) => stop = reason,
                StreamEvent::Error { error_type, message } => {
                    let status = match error_type.as_str() {
                        "overloaded_error" => 529,
                        "rate_limit_error" => 429,
                        "api_error" => 500,
                        _ => 400,
                    };
                    let body = json!({ "error": { "type": error_type, "message": message } }).to_string();
                    return parse_response(status, &body).map(Some);
                }
                StreamEvent::Other => {}
            }
        }
    }
    // Reuse the non-streaming checks (refusal, truncation, empty answer).
    let final_message = json!({ "content": [{ "type": "text", "text": answer }], "stop_reason": stop }).to_string();
    parse_response(200, &final_message).map(Some)
}

/// Checks a key with a free request (lists one model).
pub async fn test_key(key: &str) -> AppResult<()> {
    let res = client()?
        .get(format!("{API_BASE}/models?limit=1"))
        .header("x-api-key", key)
        .header("anthropic-version", API_VERSION)
        .send()
        .await
        .map_err(network_error)?;
    let status = res.status().as_u16();
    if status == 200 {
        return Ok(());
    }
    let body = res.text().await.unwrap_or_default();
    parse_response(status, &body).map(|_| ())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    pub has_key: bool,
    pub key_storage: &'static str,
    pub models: Vec<&'static str>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_requests_per_model() {
        let b = request_body("claude-opus-5-5", "sys", "hi");
        assert_eq!(b["model"], "claude-opus-5-5");
        assert_eq!(b["system"], "sys");
        assert_eq!(b["messages"][0]["content"], "hi");
        assert_eq!(b["output_config"]["effort"], "low");
        assert_eq!(b["fallbacks"], "default");
        assert!(b.get("thinking").is_none());
        assert_eq!(beta_header("claude-opus-5-5"), Some(FALLBACK_BETA));
        // Haiku 4.5 takes neither effort nor fallbacks.
        let h = request_body("claude-haiku-4-5", "sys", "hi");
        assert!(h.get("output_config").is_none() && h.get("fallbacks").is_none());
        assert_eq!(beta_header("claude-haiku-4-5"), None);
    }

    #[test]
    fn reads_text_and_explains_failures() {
        let ok = r#"{"content":[{"type":"thinking","thinking":""},{"type":"text","text":"Hello "},{"type":"text","text":"world"}],"stop_reason":"end_turn"}"#;
        assert_eq!(parse_response(200, ok).unwrap(), "Hello world");
        let refusal = r#"{"content":[],"stop_reason":"refusal","stop_details":{"category":"cyber"}}"#;
        assert!(matches!(parse_response(200, refusal), Err(AppError::Ai(m)) if m.contains("declined")));
        let cut = r#"{"content":[{"type":"text","text":"partial"}],"stop_reason":"max_tokens"}"#;
        assert!(matches!(parse_response(200, cut), Err(AppError::Ai(m)) if m.contains("cut off")));
        let bad_key = r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#;
        assert!(matches!(parse_response(401, bad_key), Err(AppError::Ai(m)) if m.contains("API key was rejected")));
        let busy = r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#;
        assert!(matches!(parse_response(529, busy), Err(AppError::Ai(m)) if m.contains("busy")));
        assert!(matches!(parse_response(502, "<html>"), Err(AppError::Ai(m)) if m.contains("problem")));
        assert!(retryable(429) && retryable(529) && retryable(503) && !retryable(400) && !retryable(401));
    }

    /// Talks to the real API with an invalid key (no cost). Run with `cargo test -- --ignored`.
    #[tokio::test(flavor = "current_thread")]
    #[ignore]
    async fn live_api_rejects_an_invalid_key() {
        let err = test_key("sk-ant-invalid-key-for-markpion-tests").await.unwrap_err();
        assert!(matches!(&err, AppError::Ai(m) if m.contains("API key was rejected")), "{err:?}");
        let err = complete_stream("sk-ant-invalid-key-for-markpion-tests", "claude-opus-5-5", "s", "hi", || false, |_| {}).await.unwrap_err();
        assert!(matches!(&err, AppError::Ai(m) if m.contains("API key was rejected")), "{err:?}");
    }

    #[test]
    fn parses_streamed_events() {
        let mut buf = String::from(
            "event: message_start\ndata: {\"type\":\"message_start\"}\n\nevent: content_block_delta\r\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hel\"}}\r\n\r\nevent: content_block_delta\ndata: {\"type\":\"content_block_del",
        );
        let events = drain_sse_events(&mut buf);
        assert_eq!(events.len(), 2);
        assert_eq!(parse_stream_event(&events[0]), StreamEvent::Other);
        assert_eq!(parse_stream_event(&events[1]), StreamEvent::Text("Hel".into()));
        // The incomplete event stays buffered until the rest arrives.
        assert!(buf.starts_with("event: content_block_delta"));
        buf.push_str("ta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"lo\"}}\n\n");
        assert_eq!(parse_stream_event(&drain_sse_events(&mut buf)[0]), StreamEvent::Text("lo".into()));
        // Thinking deltas, fallback markers and pings are ignored.
        assert_eq!(parse_stream_event(r#"{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"x"}}"#), StreamEvent::Other);
        assert_eq!(parse_stream_event(r#"{"type":"content_block_start","content_block":{"type":"fallback"}}"#), StreamEvent::Other);
        assert_eq!(parse_stream_event(r#"{"type":"message_delta","delta":{"stop_reason":"end_turn"}}"#), StreamEvent::Stop("end_turn".into()));
        assert_eq!(
            parse_stream_event(r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#),
            StreamEvent::Error { error_type: "overloaded_error".into(), message: "Overloaded".into() }
        );
    }

    #[test]
    fn validates_key_shape() {
        assert_eq!(validate_key("  sk-ant-api03-abcdefghijklmnop  ").unwrap(), "sk-ant-api03-abcdefghijklmnop");
        assert!(validate_key("hello").is_err());
        assert!(validate_key("sk-ant-with space inside-xxxxxx").is_err());
    }
}
