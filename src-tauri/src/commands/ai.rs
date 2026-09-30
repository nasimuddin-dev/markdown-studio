//! The optional AI assistant (see `crate::ai`).

#[allow(unused_imports)]
use super::*;

fn ai_status_now(state: &AppState) -> AppResult<crate::ai::AiStatus> {
    Ok(crate::ai::AiStatus {
        has_key: crate::ai::load_key(&state.config_dir)?.is_some(),
        key_storage: crate::ai::key_storage_name(),
        models: crate::ai::MODELS.to_vec(),
    })
}

#[tauri::command]
pub async fn ai_status(state: State<'_, AppState>) -> AppResult<crate::ai::AiStatus> {
    ai_status_now(&state)
}

/// Stores (after checking it with Anthropic) or, with `None`, removes the API key.
#[tauri::command]
pub async fn ai_set_key(state: State<'_, AppState>, key: Option<String>) -> AppResult<crate::ai::AiStatus> {
    match key {
        Some(key) => {
            let key = crate::ai::validate_key(&key)?;
            crate::ai::test_key(&key).await?;
            crate::ai::save_key(&state.config_dir, &key)?;
            state.logger.log("info", "ai.key", "saved");
        }
        None => {
            crate::ai::delete_key(&state.config_dir)?;
            state.logger.log("info", "ai.key", "removed");
        }
    }
    ai_status_now(&state)
}

/// A piece of a streamed AI answer, sent to the UI as it arrives.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiStreamChunk {
    request_id: u64,
    text: String,
}

/// Runs one AI command, streaming the answer to the UI (`ai-stream` events)
/// and returning the whole answer, or `null` if the user cancelled.
/// Only sizes are logged, never the text or the key.
#[tauri::command]
pub async fn ai_complete(
    app: AppHandle,
    state: State<'_, AppState>,
    request_id: u64,
    model: String,
    system: String,
    prompt: String,
    local_url: Option<String>,
) -> AppResult<Option<String>> {
    use tauri::Emitter;
    let started = std::time::Instant::now();
    let cancelled = || state.ai_cancelled.lock().map(|c| c.contains(&request_id)).unwrap_or(false);
    let emit = |text: &str| {
        let _ = app.emit("ai-stream", AiStreamChunk { request_id, text: text.to_string() });
    };
    let result = match &local_url {
        // A local model (Ollama): no key, and the text stays on this computer.
        Some(url) => crate::ai_local::complete_stream(url, &model, &system, &prompt, cancelled, emit).await,
        None => {
            let key = crate::ai::load_key(&state.config_dir)?
                .ok_or_else(|| AppError::Ai("Add your Anthropic API key in Settings → AI Assistant first.".into()))?;
            crate::ai::complete_stream(&key, &model, &system, &prompt, cancelled, emit).await
        }
    };
    if let Ok(mut c) = state.ai_cancelled.lock() {
        c.remove(&request_id);
    }
    let outcome = match &result {
        Ok(Some(_)) => "ok",
        Ok(None) => "cancelled",
        Err(_) => "failed",
    };
    state.logger.log(
        if result.is_err() { "warn" } else { "info" },
        "ai.request",
        &format!("{model}: {} chars in, {} ms, {outcome}", prompt.chars().count(), started.elapsed().as_millis()),
    );
    result
}

/// The models installed in the local Ollama at `url` (this computer only).
#[tauri::command]
pub async fn ai_local_models(url: String) -> AppResult<Vec<String>> {
    crate::ai_local::models(&url).await
}

/// Stops a running AI request (its answer is discarded).
#[tauri::command]
pub fn ai_cancel(state: State<'_, AppState>, request_id: u64) {
    if let Ok(mut c) = state.ai_cancelled.lock() {
        c.insert(request_id);
    }
}
