use std::path::{Path, PathBuf};
use tauri;
use tauri_plugin_opener::OpenerExt;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactOpenPathReport {
    path: String,
    line: Option<u32>,
    column: Option<u32>,
    line_focus_applied: bool,
}

#[tauri::command]
pub fn path_resolve(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if p.is_absolute() {
        Ok(p.to_string_lossy().to_string())
    } else {
        let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
        Ok(cwd.join(&p).to_string_lossy().to_string())
    }
}

#[tauri::command]
pub fn path_relative(from: String, to: String) -> Result<String, String> {
    let from_path = Path::new(&from);
    let to_path = Path::new(&to);
    to_path
        .strip_prefix(from_path)
        .map(|p| p.to_string_lossy().to_string())
        .or(Ok(to))
}

#[tauri::command]
pub fn artifact_open_path(
    app: tauri::AppHandle,
    path: String,
    working_dir: String,
    line: Option<u32>,
    column: Option<u32>,
) -> Result<ArtifactOpenPathReport, String> {
    let requested = PathBuf::from(path);
    let resolved = if requested.is_absolute() {
        requested
    } else {
        PathBuf::from(working_dir).join(requested)
    };
    app.opener()
        .open_path(resolved.to_string_lossy(), None::<&str>)
        .map_err(|error| error.to_string())?;
    Ok(ArtifactOpenPathReport {
        path: resolved.to_string_lossy().to_string(),
        line,
        column,
        line_focus_applied: false,
    })
}

#[tauri::command]
pub fn artifact_open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http(s) URLs are allowed".to_string());
    }
    app.opener()
        .open_url(parsed.to_string(), None::<&str>)
        .map_err(|error| error.to_string())
}
