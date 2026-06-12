#[tauri::command]
pub async fn dialog_open_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder_path = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .map(|p| p.to_string());

    Ok(folder_path)
}

#[tauri::command]
pub async fn dialog_open_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .blocking_pick_file()
        .map(|p| p.to_string());

    Ok(file_path)
}
