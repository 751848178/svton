use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use std::sync::{Arc, Mutex};
use tauri;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use tokio::process::ChildStdin;
use tokio::sync::Mutex as AsyncMutex;

/// Active child processes: processId → (pid, stdin_handle)
pub struct ProcessManager {
    pub children: HashMap<String, (u32, Arc<AsyncMutex<ChildStdin>>)>,
}

pub static PROCESS_MANAGER: once_cell::sync::Lazy<Mutex<ProcessManager>> =
    once_cell::sync::Lazy::new(|| {
        Mutex::new(ProcessManager {
            children: HashMap::new(),
        })
    });

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    signal: Option<String>,
    timed_out: bool,
}

#[derive(Serialize)]
pub struct SpawnResult {
    pid: u32,
    process_id: String,
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

#[tauri::command]
pub async fn process_spawn(
    app: tauri::AppHandle,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<SpawnResult, String> {
    use tokio::process::Command as TokioCommand;

    let mut cmd = TokioCommand::new(&command);
    cmd.args(&args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    if let Some(dir) = &cwd {
        cmd.current_dir(dir);
    }
    if let Some(env_vars) = &env {
        for (k, v) in env_vars {
            cmd.env(k, v);
        }
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn: {}", e))?;
    let pid = child.id().unwrap_or(0);
    let process_id = format!("proc-{}", uuid::Uuid::new_v4());

    // Take stdin handle
    let stdin = child.stdin.take().ok_or("Failed to get stdin")?;

    // Store in process manager
    {
        let mut pm = PROCESS_MANAGER.lock().unwrap();
        pm.children.insert(process_id.clone(), (pid, Arc::new(AsyncMutex::new(stdin))));
    }

    // Spawn stdout reader
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let app_stdout = app.clone();
    let pid_stdout = process_id.clone();
    tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stdout.emit(&format!("process-stdout-{}", pid_stdout), line);
        }
    });

    // Spawn stderr reader
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
    let app_stderr = app.clone();
    let pid_stderr = process_id.clone();
    tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stderr.emit(&format!("process-stderr-{}", pid_stderr), line);
        }
    });

    // Spawn exit watcher
    let app_exit = app.clone();
    let pid_exit = process_id.clone();
    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.ok().and_then(|s| s.code());
        // Remove from process manager
        {
            let mut pm = PROCESS_MANAGER.lock().unwrap();
            pm.children.remove(&pid_exit);
        }
        let _ = app_exit.emit(
            &format!("process-exit-{}", pid_exit),
            serde_json::json!({ "code": code, "signal": null }),
        );
    });

    Ok(SpawnResult {
        pid,
        process_id,
    })
}

#[tauri::command]
pub async fn process_stdin_write(
    process_id: String,
    data: String,
) -> Result<(), String> {
    let stdin_handle = {
        let pm = PROCESS_MANAGER.lock().unwrap();
        let entry = pm.children.get(&process_id).ok_or("Process not found")?;
        entry.1.clone()
    };
    let mut stdin = stdin_handle.lock().await;
    stdin.write_all(data.as_bytes()).await.map_err(|e| format!("Write failed: {}", e))?;
    stdin.flush().await.map_err(|e| format!("Flush failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn process_kill(
    process_id: String,
    signal: Option<String>,
) -> Result<(), String> {
    let pid = {
        let pm = PROCESS_MANAGER.lock().unwrap();
        pm.children.get(&process_id).map(|(pid, _)| *pid).ok_or("Process not found")?
    };
    let sig = signal.unwrap_or_else(|| "SIGTERM".to_string());
    // Send signal via kill command
    let _ = tokio::process::Command::new("kill")
        .args([&format!("-{}", sig.trim_start_matches("SIG")), &pid.to_string()])
        .output()
        .await;
    // Remove from manager
    {
        let mut pm = PROCESS_MANAGER.lock().unwrap();
        pm.children.remove(&process_id);
    }
    Ok(())
}
