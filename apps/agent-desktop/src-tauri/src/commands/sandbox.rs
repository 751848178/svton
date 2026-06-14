/**
 * Sandbox command execution.
 *
 * macOS: Uses Seatbelt (sandbox-exec) for process isolation.
 * Linux: Uses bubblewrap (bwrap) if available.
 * Windows: Falls through to direct execution (no native sandbox yet).
 */

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SandboxMode {
    ReadOnly,
    WorkspaceWrite,
    FullAccess,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxProfileInput {
    pub mode: SandboxMode,
    pub writable_paths: Vec<String>,
    pub network_access: bool,
}

#[derive(Serialize)]
pub struct SandboxExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
}

/// Execute a command within a sandbox profile.
#[tauri::command]
pub async fn sandbox_exec(
    command: String,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
    _timeout_ms: Option<u64>,
    profile: SandboxProfileInput,
) -> Result<SandboxExecResult, String> {
    // Full access = no sandbox needed
    if matches!(profile.mode, SandboxMode::FullAccess) {
        return exec_direct(&command, cwd, env, _timeout_ms);
    }

    #[cfg(target_os = "macos")]
    {
        return exec_seatbelt(&command, cwd, env, _timeout_ms, &profile);
    }

    #[cfg(target_os = "linux")]
    {
        return exec_bwrap(&command, cwd, env, _timeout_ms, &profile);
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        // Fallback: direct execution on unsupported platforms
        return exec_direct(&command, cwd, env, _timeout_ms);
    }
}

/// Direct execution without sandbox.
fn exec_direct(
    command: &str,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
    timeout_ms: Option<u64>,
) -> Result<SandboxExecResult, String> {
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    let mut cmd = Command::new(shell);
    cmd.arg(flag).arg(command);
    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }
    if let Some(ref env_vars) = env {
        for (k, v) in env_vars {
            cmd.env(k, v);
        }
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    Ok(SandboxExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        timed_out: false,
    })
}

#[cfg(target_os = "macos")]
fn exec_seatbelt(
    command: &str,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
    _timeout_ms: Option<u64>,
    profile: &SandboxProfileInput,
) -> Result<SandboxExecResult, String> {
    // Build a Seatbelt policy profile
    let mut policy = String::new();
    policy.push_str("(version 1)\n(deny default)\n");

    // Allow basic process operations
    policy.push_str("(allow process-info* (self))\n");
    policy.push_str("(allow signal (target self))\n");
    policy.push_str("(allow sysctl-read*)\n");
    policy.push_str("(allow file-read*)\n");

    // Allow writing to specified paths
    for path in &profile.writable_paths {
        policy.push_str(&format!(
            "(allow file-write* (subpath \"{}\"))\n",
            path
        ));
    }

    // Temp directory access (needed for most tools)
    policy.push_str("(allow file-write* (subpath \"/tmp\"))\n");
    policy.push_str("(allow file-write* (subpath \"/var/folders\"))\n");

    // Network access
    if profile.network_access {
        policy.push_str("(allow network*)\n");
    } else {
        policy.push_str("(deny network*)\n");
    }

    // Write policy to temp file
    let policy_path = format!("/tmp/svton-sandbox-{}.sb", std::process::id());
    std::fs::write(&policy_path, &policy).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("sandbox-exec");
    cmd.arg("-p").arg(&policy_path);
    cmd.arg("sh").arg("-c").arg(command);

    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }
    if let Some(ref env_vars) = env {
        for (k, v) in env_vars {
            cmd.env(k, v);
        }
    }

    let output = cmd.output().map_err(|e| e.to_string())?;

    // Clean up policy file
    let _ = std::fs::remove_file(&policy_path);

    Ok(SandboxExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        timed_out: false,
    })
}

#[cfg(target_os = "linux")]
fn exec_bwrap(
    command: &str,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
    _timeout_ms: Option<u64>,
    profile: &SandboxProfileInput,
) -> Result<SandboxExecResult, String> {
    let mut args: Vec<String> = vec![];

    // Mount root filesystem read-only
    args.push("--ro-bind".into());
    args.push("/".into());
    args.push("/".into());

    // Mount /proc and /dev
    args.push("--proc".into());
    args.push("/proc".into());
    args.push("--dev".into());
    args.push("/dev".into());

    // Make working directory writable
    for path in &profile.writable_paths {
        args.push("--bind".into());
        args.push(path.clone());
        args.push(path.clone());
    }

    // Temp directory
    args.push("--bind".into());
    args.push("/tmp".into());
    args.push("/tmp".into());

    // Network isolation
    if !profile.network_access {
        args.push("--unshare-net".into());
    }

    args.push("sh".into());
    args.push("-c".into());
    args.push(command.into());

    let mut cmd = Command::new("bwrap");
    cmd.args(&args);

    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }
    if let Some(ref env_vars) = env {
        for (k, v) in env_vars {
            cmd.env(k, v);
        }
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    Ok(SandboxExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        timed_out: false,
    })
}
