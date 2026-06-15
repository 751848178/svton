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

/// Export the bundled Chrome CDP relay extension to a temp directory
/// and open it in the system file manager. Returns the path.
#[tauri::command]
pub async fn export_chrome_extension() -> Result<String, String> {
    // The extension files are bundled at compile time via include_dir or
    // we embed them directly. Since the extension is small, we write the
    // files inline to a temp directory.

    let temp_dir = std::env::temp_dir().join("svton-chrome-extension");
    let ext_dir = temp_dir.join("chrome-cdp-relay");

    // Remove old copy if exists
    let _ = std::fs::remove_dir_all(&ext_dir);
    std::fs::create_dir_all(&ext_dir).map_err(|e| format!("Failed to create dir: {}", e))?;

    // Write manifest.json
    std::fs::write(
        ext_dir.join("manifest.json"),
        r#"{
  "manifest_version": 3,
  "name": "Svton Chrome CDP Relay",
  "version": "1.0.0",
  "description": "Connect Svton Agent to Chrome for web automation",
  "permissions": ["debugger", "tabs", "activeTab", "storage", "nativeMessaging"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
"#,
    ).map_err(|e| format!("Failed to write manifest: {}", e))?;

    // Write background.js
    // Read extension files from the project extensions directory.
    // Try multiple relative paths to handle different build environments.
    let read_file = |name: &str| -> Result<String, String> {
        let candidates = [
            format!("extensions/chrome-cdp-relay/{}", name),
            format!("../extensions/chrome-cdp-relay/{}", name),
            format!("../../extensions/chrome-cdp-relay/{}", name),
            format!("../../../extensions/chrome-cdp-relay/{}", name),
            format!("../../../../extensions/chrome-cdp-relay/{}", name),
            format!("../../../../../extensions/chrome-cdp-relay/{}", name),
        ];
        for path in &candidates {
            if let Ok(content) = std::fs::read_to_string(path) {
                return Ok(content);
            }
        }
        Err(format!("Failed to find {}", name))
    };

    let read_bytes = |name: &str| -> Result<Vec<u8>, String> {
        let candidates = [
            format!("extensions/chrome-cdp-relay/icons/{}", name),
            format!("../extensions/chrome-cdp-relay/icons/{}", name),
            format!("../../extensions/chrome-cdp-relay/icons/{}", name),
            format!("../../../extensions/chrome-cdp-relay/icons/{}", name),
            format!("../../../../extensions/chrome-cdp-relay/icons/{}", name),
            format!("../../../../../extensions/chrome-cdp-relay/icons/{}", name),
        ];
        for path in &candidates {
            if let Ok(content) = std::fs::read(path) {
                return Ok(content);
            }
        }
        Err(format!("Failed to find icons/{}", name))
    };

    let background_js = read_file("background.js")?;
    std::fs::write(ext_dir.join("background.js"), background_js)
        .map_err(|e| format!("Failed to write background.js: {}", e))?;

    let popup_html = read_file("popup.html")?;
    let popup_js = read_file("popup.js")?;

    let icons_dir = ext_dir.join("icons");
    std::fs::create_dir_all(&icons_dir).map_err(|e| format!("Failed to create icons dir: {}", e))?;
    let icon16 = read_bytes("icon16.png")?;
    let icon48 = read_bytes("icon48.png")?;
    let icon128 = read_bytes("icon128.png")?;
    let icon48_active = read_bytes("icon48-active.png")?;
    std::fs::write(icons_dir.join("icon16.png"), &icon16).map_err(|e| format!("Failed to write icon16: {}", e))?;
    std::fs::write(icons_dir.join("icon48.png"), &icon48).map_err(|e| format!("Failed to write icon48: {}", e))?;
    std::fs::write(icons_dir.join("icon128.png"), &icon128).map_err(|e| format!("Failed to write icon128: {}", e))?;
    std::fs::write(icons_dir.join("icon48-active.png"), &icon48_active).map_err(|e| format!("Failed to write icon48-active: {}", e))?;

    // Open the directory in Finder/Explorer
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(&ext_dir).spawn().ok();
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(&ext_dir).spawn().ok();
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(&ext_dir).spawn().ok();
    }

    Ok(ext_dir.to_string_lossy().to_string())
}
