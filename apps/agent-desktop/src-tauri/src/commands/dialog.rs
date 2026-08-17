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

#[tauri::command]
pub async fn dialog_save_file(
    app: tauri::AppHandle,
    default_name: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    Ok(app
        .dialog()
        .file()
        .set_file_name(default_name)
        .blocking_save_file()
        .map(|path| path.to_string()))
}
