mod commands;
mod db;

use commands::*;
use db::Database;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Database>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database = Database::new().expect("Failed to initialize database");
    let state = AppState {
        db: Mutex::new(database),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Open devtools in debug builds (Cmd+Option+I also works after this)
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Filesystem
            fs_read_file,
            fs_write_file,
            fs_edit_file,
            fs_delete_file,
            fs_exists,
            fs_stat,
            fs_list_dir,
            // Process
            process_exec,
            process_get_env,
            process_get_cwd,
            process_spawn,
            process_stdin_write,
            process_kill,
            // Search
            search_grep,
            search_glob,
            // Storage
            storage_get,
            storage_set,
            storage_delete,
            storage_list,
            storage_clear,
            // Dialog
            dialog_open_folder,
            dialog_open_file,
            // Path
            path_resolve,
            path_relative,
            // Computer Use
            screenshot_display,
            mouse_click,
            mouse_double_click,
            mouse_move,
            mouse_down,
            mouse_up,
            mouse_drag,
            scroll,
            keyboard_type_text,
            keyboard_press_key,
            // macOS Permissions
            check_macos_permissions,
            request_accessibility_permission,
            request_screen_recording_permission,
            open_system_settings,
            // Chrome CDP
            check_chrome_cdp,
            launch_chrome_debug,
            export_chrome_extension,
            // Sandbox
            sandbox_exec,
            // Window (pop-out threads)
            popout_session,
            close_popout,
            list_popouts,
            popout_preview,
            // Document preview
            preview_pdf,
            preview_excel,
            preview_pptx,
            // Chronicle (screen memory)
            chronicle_capture,
            chronicle_active_window,
            chronicle_ocr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
