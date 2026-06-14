/**
 * Chronicle — screen capture and memory commands (macOS-focused).
 *
 * Periodically captures the screen, performs OCR, and records the active
 * window context. The TypeScript ChronicleManager handles scheduling and
 * LLM summarization; these commands provide the native capture primitives.
 */

use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleCapture {
    pub image_base64: String,
    pub timestamp: i64,
    pub active_app: Option<String>,
    pub window_title: Option<String>,
}

/// Capture the current screen and return as base64 JPEG.
#[tauri::command]
pub async fn chronicle_capture() -> Result<ChronicleCapture, String> {
    use screenshots::Screen;

    let screen = Screen::all()
        .map_err(|e| e.to_string())?
        .into_iter()
        .next()
        .ok_or("No display found")?;

    let img = screen
        .capture()
        .map_err(|e| e.to_string())?;

    // Encode directly as JPEG using the screenshots-reexported image crate
    use screenshots::image::codecs::jpeg::JpegEncoder;
    use screenshots::image::ImageEncoder;

    let mut buf = Vec::new();
    JpegEncoder::new_with_quality(&mut buf, 70)
        .write_image(
            img.as_raw(),
            img.width(),
            img.height(),
            screenshots::image::ColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;

    use base64::Engine;
    let image_base64 = base64::engine::general_purpose::STANDARD.encode(&buf);

    // Get active window info (macOS)
    let (active_app, window_title) = get_active_window_info();

    Ok(ChronicleCapture {
        image_base64,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0),
        active_app,
        window_title,
    })
}

/// Get the frontmost app name and window title.
#[tauri::command]
pub async fn chronicle_active_window() -> Result<(Option<String>, Option<String>), String> {
    Ok(get_active_window_info())
}

/// Perform OCR on a base64-encoded image using macOS Vision framework.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn chronicle_ocr(image_base64: String) -> Result<String, String> {
    // Use the `shortcuts` CLI to run a macOS Vision OCR shortcut
    // This is a fallback approach; a proper implementation would use
    // the Vision framework via FFI or Swift bridging
    let script = format!(
        r#"
        import Cocoa
        import Vision
        let imgData = Data(base64Encoded: "{}")
        guard let data = imgData else {{ exit(1) }}
        guard let img = NSImage(data: data) else {{ exit(1) }}
        guard let cgImg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {{ exit(1) }}
        let req = VNRecognizeTextRequest()
        req.recognitionLevel = .accurate
        let handler = VNImageRequestHandler(cgImage: cgImg)
        try? handler.perform([req])
        if let results = req.results as? [VNRecognizedTextObservation] {{
            let text = results.compactMap {{ $0.topCandidates(1).first?.string }}.joined(separator: "\n")
            print(text)
        }}
        "#,
        image_base64
    );

    let output = Command::new("swift")
        .arg("-e")
        .arg(&script)
        .output();

    match output {
        Ok(result) => {
            let text = String::from_utf8_lossy(&result.stdout).to_string();
            Ok(text)
        }
        Err(_) => Ok(String::new()),
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn chronicle_ocr(_image_base64: String) -> Result<String, String> {
    Ok(String::new())
}

/// Get active window info using AppleScript (macOS).
#[cfg(target_os = "macos")]
fn get_active_window_info() -> (Option<String>, Option<String>) {
    let script = r#"
        tell application "System Events"
            set frontApp to name of first process whose frontmost is true
            try
                set windowTitle to title of front window of frontApp
            on error
                set windowTitle to ""
            end try
            return frontApp & "|" & windowTitle
        end tell
    "#;

    let output = Command::new("osascript").arg("-e").arg(script).output();

    match output {
        Ok(result) if result.status.success() => {
            let raw = String::from_utf8_lossy(&result.stdout).trim().to_string();
            let parts: Vec<&str> = raw.splitn(2, '|').collect();
            let app = parts.first().map(|s| s.to_string());
            let title = parts.get(1).filter(|s| !s.is_empty()).map(|s| s.to_string());
            (app, title)
        }
        _ => (None, None),
    }
}

#[cfg(not(target_os = "macos"))]
fn get_active_window_info() -> (Option<String>, Option<String>) {
    (None, None)
}
