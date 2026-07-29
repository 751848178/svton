mod commands;
mod db;
mod ws_relay;

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

    // Create WebSocket relay state (server starts in setup callback where Tokio runtime is available)
    let ws_state = ws_relay::create_relay_state();
    let ws_state_for_setup = ws_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .manage(ws_state_for_setup.clone())
        .setup(move |app| {
            let _window = app.get_webview_window("main").unwrap();

            // Start WebSocket relay server (Tokio runtime is available inside setup)
            ws_relay::start_ws_relay(ws_state_for_setup.clone());

            // Open devtools in debug builds (Cmd+Option+I also works after this)
            #[cfg(debug_assertions)]
            {
                _window.open_devtools();
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
            check_extension_connected,
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

// ============================================================
// Real Tauri command-boundary tests.
//
// These call the ACTUAL `#[tauri::command]` functions (the native boundary the
// JS `invoke()` would hit) directly — no mock platform, no Tauri runtime. They
// prove the command layer executes real OS file/process operations, which is
// the Desktop product path the `TauriPlatform` reaches via `@tauri-apps/api`.
// ============================================================
#[cfg(test)]
mod command_boundary_tests {
    use super::commands::{fs as fs_cmd, process as proc_cmd};
    use std::collections::HashMap;

    #[tokio::test]
    async fn process_exec_runs_a_real_native_command() {
        // The real `process_exec` (commands/process.rs) shells out via tokio.
        let out = if cfg!(target_os = "windows") {
            proc_cmd::process_exec("cmd /C echo hello-tauri".into(), None, None, None).await
        } else {
            proc_cmd::process_exec("echo hello-tauri".into(), None, None, None).await
        };
        let result = out.expect("process_exec should succeed");
        assert!(result.stdout.contains("hello-tauri"), "real stdout was: {}", result.stdout);
        assert_eq!(result.exit_code, Some(0));
        assert!(!result.timed_out);
    }

    #[tokio::test]
    async fn process_exec_reports_a_real_failure() {
        // `false` exits non-zero on unix; cmd /C with bad command on windows.
        let out = if cfg!(target_os = "windows") {
            proc_cmd::process_exec("cmd /C exit 3".into(), None, None, None).await
        } else {
            proc_cmd::process_exec("sh -c 'exit 7'".into(), None, None, None).await
        };
        let result = out.expect("process_exec should not error on non-zero exit");
        assert_ne!(result.exit_code, Some(0));
    }

    #[tokio::test]
    async fn process_exec_passes_cwd_and_env_to_the_real_process() {
        let mut env = HashMap::new();
        env.insert("SVTON_TEST_VAR".into(), "from-env".into());
        let cmd = if cfg!(target_os = "windows") {
            "cmd /C echo %SVTON_TEST_VAR%".into()
        } else {
            "echo $SVTON_TEST_VAR".into()
        };
        let result = proc_cmd::process_exec(cmd, None, Some(env), None)
            .await
            .expect("env exec should succeed");
        assert!(result.stdout.contains("from-env"), "env not propagated: {}", result.stdout);
    }

    #[test]
    fn process_get_env_reads_a_real_environment_variable() {
        // HOME/USERPROFILE is always set on macOS/windows hosts.
        let key = if cfg!(target_os = "windows") { "USERPROFILE" } else { "HOME" };
        let val = proc_cmd::process_get_env(key.into()).expect("get_env should succeed");
        assert!(val.is_some(), "{} should be set in the real env", key);
        assert!(!val.unwrap().is_empty());
    }

    #[tokio::test]
    async fn fs_write_then_read_round_trips_real_disk() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("svton-boundary-test.txt");
        let p = path.to_string_lossy().to_string();

        fs_cmd::fs_write_file(p.clone(), "real-disk-content".into(), None)
            .await
            .expect("write should succeed");
        assert!(fs_cmd::fs_exists(p.clone()).await.unwrap_or(false));
        let read = fs_cmd::fs_read_file(p.clone()).await.expect("read should succeed");
        assert_eq!(read, "real-disk-content");
    }

    #[tokio::test]
    async fn fs_stat_reports_real_file_metadata() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("stat-target.txt");
        std::fs::write(&path, "abc").unwrap();
        let stat = fs_cmd::fs_stat(path.to_string_lossy().to_string())
            .await
            .expect("stat should succeed");
        assert!(stat.is_file);
        assert!(!stat.is_directory);
        assert_eq!(stat.size, 3);
    }
}
