//! Local AI models through Ollama (https://ollama.com), as an alternative to
//! Claude: text goes to an Ollama server on this computer and nowhere else.
//! Only loopback addresses are accepted, so a mistyped or tampered setting
//! can't send text to another machine. No key is involved.

use crate::ai::MAX_INPUT_CHARS;
use crate::error::{AppError, AppResult};
use serde_json::{json, Value};
use std::time::Duration;

/// Checks that `url` is an http(s) address on this computer and returns it
/// without a trailing slash.
pub fn check_url(url: &str) -> AppResult<reqwest::Url> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| AppError::Ai(format!("“{url}” isn't a valid address.")))?;
    let local = match parsed.host_str() {
        Some("localhost") => true,
        Some(host) => host.trim_matches(['[', ']']).parse::<std::net::IpAddr>().is_ok_and(|ip| ip.is_loopback()),
        None => false,
    };
    if !matches!(parsed.scheme(), "http" | "https") || !local {
        return Err(AppError::Ai("Local models must run on this computer (localhost, 127.0.0.1 or [::1]).".into()));
    }
    Ok(parsed)
}

fn endpoint(base: &reqwest::Url, path: &str) -> String {
    format!("{}/{path}", base.as_str().trim_end_matches('/'))
}

fn client(timeout: Duration) -> AppResult<reqwest::Client> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    reqwest::Client::builder()
        // A proxy must never see local traffic.
        .no_proxy()
        .timeout(timeout)
        .user_agent(concat!("Markpion/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| AppError::Ai(format!("Couldn't start the connection: {e}")))
}

fn unreachable(base: &reqwest::Url) -> AppError {
    AppError::Ai(format!("Couldn't reach Ollama at {base}. Make sure Ollama is running (ollama serve)."))
}

/// The names in Ollama's `/api/tags` answer.
pub fn parse_models(body: &str) -> Vec<String> {
    let v: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    v["models"]
        .as_array()
        .map(|models| models.iter().filter_map(|m| m["name"].as_str().map(String::from)).collect())
        .unwrap_or_default()
}

/// The models installed in the local Ollama.
pub async fn models(url: &str) -> AppResult<Vec<String>> {
    let base = check_url(url)?;
    let res = client(Duration::from_secs(10))?.get(endpoint(&base, "api/tags")).send().await.map_err(|_| unreachable(&base))?;
    let body = res.text().await.map_err(|_| unreachable(&base))?;
    Ok(parse_models(&body))
}

pub fn request_body(model: &str, system: &str, prompt: &str) -> Value {
    json!({
        "model": model,
        "stream": true,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": prompt },
        ],
    })
}

/// One line of Ollama's streamed (NDJSON) answer.
#[derive(Debug, PartialEq)]
pub enum LocalEvent {
    Text(String),
    Done,
    Error(String),
    Other,
}

pub fn parse_line(line: &str) -> LocalEvent {
    let v: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return LocalEvent::Other,
    };
    if let Some(error) = v["error"].as_str() {
        return LocalEvent::Error(error.to_string());
    }
    if v["done"].as_bool() == Some(true) {
        return LocalEvent::Done;
    }
    match v["message"]["content"].as_str() {
        Some(text) if !text.is_empty() => LocalEvent::Text(text.to_string()),
        _ => LocalEvent::Other,
    }
}

/// Streams an answer from the local model, like [`crate::ai::complete_stream`].
pub async fn complete_stream(
    url: &str,
    model: &str,
    system: &str,
    prompt: &str,
    cancelled: impl Fn() -> bool,
    mut on_text: impl FnMut(&str),
) -> AppResult<Option<String>> {
    use futures_util::StreamExt;
    let base = check_url(url)?;
    if model.trim().is_empty() {
        return Err(AppError::Ai("Choose a local model in Settings → AI Assistant.".into()));
    }
    if prompt.chars().count() > MAX_INPUT_CHARS {
        return Err(AppError::Ai(format!(
            "The selected text is too long ({} characters; the limit is {MAX_INPUT_CHARS}). Select less text.",
            prompt.chars().count()
        )));
    }
    // Local models can be slow, especially on the first request (loading the model).
    let res = client(Duration::from_secs(600))?
        .post(endpoint(&base, "api/chat"))
        .json(&request_body(model, system, prompt))
        .send()
        .await
        .map_err(|_| unreachable(&base))?;
    let status = res.status().as_u16();
    if status != 200 {
        let body = res.text().await.unwrap_or_default();
        let message = match parse_line(&body) {
            LocalEvent::Error(e) => e,
            _ => format!("HTTP {status}"),
        };
        return Err(AppError::Ai(format!("The local model couldn't answer: {message}")));
    }
    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    let mut answer = String::new();
    while let Some(chunk) = stream.next().await {
        if cancelled() {
            return Ok(None);
        }
        let chunk = chunk.map_err(|_| unreachable(&base))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(end) = buffer.find('\n') {
            let line: String = buffer.drain(..=end).collect();
            match parse_line(line.trim()) {
                LocalEvent::Text(t) => {
                    answer.push_str(&t);
                    on_text(&t);
                }
                LocalEvent::Error(e) => return Err(AppError::Ai(format!("The local model stopped: {e}"))),
                LocalEvent::Done | LocalEvent::Other => {}
            }
        }
    }
    if answer.trim().is_empty() {
        return Err(AppError::Ai("The local model returned no text.".into()));
    }
    Ok(Some(answer))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_this_computer() {
        for ok in ["http://localhost:11434", "http://127.0.0.1:11434/", "http://[::1]:11434", "https://localhost"] {
            assert!(check_url(ok).is_ok(), "{ok}");
        }
        for bad in ["http://example.com:11434", "http://192.168.1.5:11434", "ftp://localhost", "localhost:11434", "http://localhost.evil.com"] {
            assert!(check_url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn reads_models_and_streamed_lines() {
        assert_eq!(parse_models(r#"{"models":[{"name":"llama3.2:latest"},{"name":"qwen3:8b"}]}"#), ["llama3.2:latest", "qwen3:8b"]);
        assert!(parse_models("not json").is_empty());
        assert_eq!(parse_line(r#"{"message":{"role":"assistant","content":"Hi"},"done":false}"#), LocalEvent::Text("Hi".into()));
        assert_eq!(parse_line(r#"{"done":true,"done_reason":"stop"}"#), LocalEvent::Done);
        assert_eq!(parse_line(r#"{"error":"model 'x' not found"}"#), LocalEvent::Error("model 'x' not found".into()));
    }

    #[test]
    fn builds_a_chat_request() {
        let body = request_body("llama3.2", "Be brief.", "Fix this");
        assert_eq!(body["model"], "llama3.2");
        assert_eq!(body["messages"][0]["role"], "system");
        assert_eq!(body["messages"][1]["content"], "Fix this");
        assert_eq!(body["stream"], true);
    }
}
