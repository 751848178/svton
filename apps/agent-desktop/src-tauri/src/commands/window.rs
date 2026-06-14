/**
 * Pop-out window management for session threads.
 *
 * Creates secondary Tauri windows for individual chat sessions,
 * allowing users to keep multiple conversations visible simultaneously.
 */

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Pop out a session into a new window.
/// The frontend URL includes `?session=<id>&popout=1` so the React app
/// can render a stripped-down chat view for that session.
#[tauri::command]
pub async fn popout_session(
    session_id: String,
    app: AppHandle,
) -> Result<String, String> {
    let label = format!("popout-{}", session_id);

    // If window already exists, focus it
    if let Some(existing) = app.get_webview_window(&label) {
        existing
            .set_focus()
            .map_err(|e| e.to_string())?;
        return Ok(label);
    }

    // Build URL with session query param
    let url = format!("/?session={}&popout=1", session_id);

    let webview_url = WebviewUrl::App(url.into());

    let window = WebviewWindowBuilder::new(&app, &label, webview_url)
        .title("Svton — Session")
        .inner_size(480.0, 720.0)
        .min_inner_size(360.0, 500.0)
        .decorations(true)
        .transparent(true)
        .build()
        .map_err(|e| e.to_string())?;

    window.set_focus().map_err(|e| e.to_string())?;

    Ok(label)
}

/// Close a popout window by label.
#[tauri::command]
pub async fn close_popout(window_label: String, app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// List all popout window labels.
#[tauri::command]
pub async fn list_popouts(app: AppHandle) -> Result<Vec<String>, String> {
    let windows = app.webview_windows();
    let popouts: Vec<String> = windows
        .keys()
        .filter(|label| label.starts_with("popout-"))
        .map(|label| label.clone())
        .collect();
    Ok(popouts)
}

/// Pop out a document preview into a standalone window.
/// The frontend URL includes `?preview=1` so the React app renders
/// only the SplitScreenPanel without sidebar or chat.
#[tauri::command]
pub async fn popout_preview(
    key: String,
    app: AppHandle,
) -> Result<String, String> {
    let label = format!("preview-{}", key);

    // If window already exists, focus it
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(label);
    }

    let url = format!("/?preview=1&key={}", key);

    let webview_url = WebviewUrl::App(url.into());

    let window = WebviewWindowBuilder::new(&app, &label, webview_url)
        .title("Svton — Preview")
        .inner_size(800.0, 900.0)
        .min_inner_size(400.0, 400.0)
        .decorations(true)
        .transparent(true)
        .build()
        .map_err(|e| e.to_string())?;

    window.set_focus().map_err(|e| e.to_string())?;

    Ok(label)
}
