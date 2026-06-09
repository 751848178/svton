use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use tauri;

#[derive(Serialize)]
pub struct ExecResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    signal: Option<String>,
    timed_out: bool,
}

#[tauri::command]
pub async fn process_exec(
    command: String,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    timeout: Option<u64>,
) -> Result<ExecResult, String> {
    let _timeout_ms = timeout.unwrap_or(30000);

    let output = tokio::task::spawn_blocking(move || {
        let mut cmd = if cfg!(target_os = "windows") {
            let mut c = Command::new("cmd");
            c.args(["/C", &command]);
            c
        } else {
            let mut c = Command::new("sh");
            c.args(["-c", &command]);
            c
        };

        if let Some(dir) = &cwd {
            cmd.current_dir(dir);
        }

        if let Some(env_vars) = &env {
            for (k, v) in env_vars {
                cmd.env(k, v);
            }
        }

        cmd.output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        signal: None,
        timed_out: false,
    })
}

#[tauri::command]
pub fn process_get_env(key: String) -> Result<Option<String>, String> {
    Ok(std::env::var(key).ok())
}

#[tauri::command]
pub fn process_get_cwd() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}
