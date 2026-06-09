use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn storage_get(key: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_set(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_list(prefix: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list(&prefix).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_clear(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.clear().map_err(|e| e.to_string())
}
