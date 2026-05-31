mod commands;

use commands::chat::{self, AppState};
use std::sync::Mutex;
use tauri::Manager;
use tauri::WebviewWindow;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            gateway_config: Mutex::new(None),
            current_session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            chat::get_gateway_config,
            chat::set_gateway_config,
            chat::send_message,
            chat::get_current_session,
            chat::set_current_session,
            chat::create_attachment,
        ])
        .setup(|app| {
            let window: WebviewWindow<_> = app.get_webview_window("main").unwrap();
            let _ = window.set_title("Hermes Local");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
