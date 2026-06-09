use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri;

#[derive(Serialize, Deserialize)]
pub struct FileStat {
    pub is_file: bool,
    pub is_directory: bool,
    pub size: u64,
    pub modified_at: f64,
    pub created_at: f64,
}

#[derive(Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_file: bool,
    pub is_directory: bool,
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_write_file(path: String, content: String, _binary: Option<bool>) -> Result<(), String> {
    // For now, always write as string (binary support can be added with base64 decode later)
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_edit_file(path: String, old_content: String, new_content: String) -> Result<bool, String> {
    let current = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if current.contains(&old_content) {
        let updated = current.replace(&old_content, &new_content);
        fs::write(&path, updated).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn fs_delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn fs_stat(path: String) -> Result<FileStat, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let created = metadata.created().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
    Ok(FileStat {
        is_file: metadata.is_file(),
        is_directory: metadata.is_dir(),
        size: metadata.len(),
        modified_at: modified.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64() * 1000.0,
        created_at: created.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64() * 1000.0,
    })
}

#[tauri::command]
pub async fn fs_list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries = Vec::new();
    let dir = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        entries.push(DirEntry {
            path: entry.path().to_string_lossy().to_string(),
            name,
            is_file: metadata.is_file(),
            is_directory: metadata.is_dir(),
        });
    }
    Ok(entries)
}
