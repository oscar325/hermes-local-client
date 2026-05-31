use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use uuid::Uuid;

// ============ 数据类型定义 ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub attachments: Vec<Attachment>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub mime_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub response: String,
    pub session_id: String,
}

// ============ 应用状态 ============

pub struct AppState {
    pub gateway_config: Mutex<Option<GatewayConfig>>,
    pub current_session: Mutex<Option<String>>,
}

// ============ Tauri Commands ============

#[tauri::command]
pub fn get_gateway_config(state: State<AppState>) -> Result<Option<GatewayConfig>, String> {
    let config = state.gateway_config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn set_gateway_config(
    state: State<AppState>,
    base_url: String,
    api_key: String,
) -> Result<(), String> {
    let mut config = state.gateway_config.lock().map_err(|e| e.to_string())?;
    *config = Some(GatewayConfig { base_url, api_key });
    Ok(())
}

#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    message: String,
    session_id: Option<String>,
    attachments: Vec<Attachment>,
) -> Result<ChatResponse, String> {
    let config = state.gateway_config.lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Gateway not configured. Please set up Gateway URL and API Key in settings.")?;
    
    let client = reqwest::Client::new();
    let session_id = session_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    
    let request_body = serde_json::json!({
        "messages": [
            {"role": "user", "content": message}
        ],
        "session_id": &session_id,
        "attachments": attachments,
    });
    
    let response = client
        .post(format!("{}/v1/chat/completions", config.base_url))
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .header("X-Hermes-Session-Id", &session_id)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send message: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Gateway error: {} - {}", status, error_text));
    }
    
    let response_body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let assistant_message = response_body
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();
    
    Ok(ChatResponse {
        response: assistant_message,
        session_id,
    })
}

#[tauri::command]
pub fn get_current_session(state: State<AppState>) -> Result<Option<String>, String> {
    let session = state.current_session.lock().map_err(|e| e.to_string())?;
    Ok(session.clone())
}

#[tauri::command]
pub fn set_current_session(state: State<AppState>, session_id: String) -> Result<(), String> {
    let mut session = state.current_session.lock().map_err(|e| e.to_string())?;
    *session = Some(session_id);
    Ok(())
}

#[tauri::command]
pub fn create_attachment(
    filename: String,
    path: String,
    mime_type: String,
    size: u64,
) -> Result<Attachment, String> {
    Ok(Attachment {
        id: Uuid::new_v4().to_string(),
        filename,
        path,
        mime_type,
        size,
    })
}
