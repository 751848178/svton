use std::path::{Path, PathBuf};
use tauri;

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
