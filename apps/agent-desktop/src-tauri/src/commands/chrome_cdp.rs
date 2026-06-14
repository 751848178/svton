use serde::Serialize;
use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;

#[derive(Serialize)]
pub struct CdpStatus {
    pub connected: bool,
    pub port: u16,
}

/// Check if Chrome CDP debug port is reachable.
#[tauri::command]
pub async fn check_chrome_cdp(port: Option<u16>) -> Result<CdpStatus, String> {
    let p = port.unwrap_or(9222);
    let addr = format!("127.0.0.1:{}", p);
    let timeout = Duration::from_secs(1);
    let connected = addr.parse()
        .map(|socket_addr| TcpStream::connect_timeout(&socket_addr, timeout).is_ok())
        .unwrap_or(false);
    Ok(CdpStatus { connected, port: p })
}

/// Launch Chrome with remote debugging enabled.
#[tauri::command]
pub async fn launch_chrome_debug(port: Option<u16>) -> Result<(), String> {
    let p = port.unwrap_or(9222);

    // Find Chrome executable by platform
    #[cfg(target_os = "macos")]
    let chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ];

    #[cfg(target_os = "linux")]
    let chrome_paths = [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome-stable",
    ];

    #[cfg(target_os = "windows")]
    let chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];

    let chrome_path = chrome_paths.iter()
        .find(|path| std::path::Path::new(path).exists())
        .ok_or("Chrome not found. Please install Google Chrome.")?;

    Command::new(chrome_path)
        .arg(format!("--remote-debugging-port={}", p))
        .spawn()
        .map_err(|e| format!("Failed to launch Chrome: {}", e))?;

    Ok(())
}
