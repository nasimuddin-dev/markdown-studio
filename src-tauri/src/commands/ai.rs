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

/// Runs one AI command. Only sizes are logged, never the text or the key.
#[tauri::command]
pub async fn ai_complete(state: State<'_, AppState>, model: String, system: String, prompt: String) -> AppResult<String> {
    let key = crate::ai::load_key(&state.config_dir)?
        .ok_or_else(|| AppError::Ai("Add your Anthropic API key in Settings → AI Assistant first.".into()))?;
    let started = std::time::Instant::now();
    let result = crate::ai::complete(&key, &model, &system, &prompt).await;
    state.logger.log(
        if result.is_ok() { "info" } else { "warn" },
        "ai.request",
        &format!("{model}: {} chars in, {} ms, {}", prompt.chars().count(), started.elapsed().as_millis(), if result.is_ok() { "ok" } else { "failed" }),
    );
    result
}
