#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;

#[derive(serde::Serialize)]
struct FileInfo {
    name: String,
    path: String,
    content: String,
}

#[tauri::command]
fn read_file_by_path(path: String) -> Result<FileInfo, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled")
        .to_string();
    Ok(FileInfo { name, path, content })
}

#[tauri::command]
fn write_file_by_path(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![read_file_by_path, write_file_by_path])
        .build(tauri::generate_context!())
        .expect("error building app")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Ready = event {
                // Handle file opened via double-click (macOS/Linux/Windows)
                // The file path is passed as a command-line argument
                let args: Vec<String> = std::env::args().collect();
                // Skip first arg (executable path), look for actual file paths
                for arg in args.iter().skip(1) {
                    let path = arg.clone();
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        let name = std::path::Path::new(&path)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("untitled")
                            .to_string();
                        let payload = serde_json::json!({
                            "path": path,
                            "name": name,
                            "content": content
                        });
                        let _ = app_handle.emit("file-open", payload);
                    }
                }
            }
        });
}