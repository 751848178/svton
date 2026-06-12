use base64::Engine;
use image::ImageEncoder;

/// Capture a screenshot of the primary display.
/// Returns base64-encoded PNG.
#[tauri::command]
pub async fn screenshot_display(display_index: Option<usize>) -> Result<String, String> {
    let screens = screenshots::Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let idx = display_index.unwrap_or(0).min(screens.len().saturating_sub(1));
    let screen = screens.get(idx).ok_or("No display found")?;

    let image = screen.capture().map_err(|e| format!("Screenshot failed: {}", e))?;

    let mut png_buf = Vec::new();
    image::codecs::png::PngEncoder::new(&mut png_buf)
        .write_image(image.as_raw(), image.width(), image.height(), image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("PNG encoding failed: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_buf);
    Ok(b64)
}

/// Click the mouse at the given coordinates.
#[tauri::command]
pub async fn mouse_click(x: i32, y: i32, button: Option<String>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Button, Coordinate};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let btn = match button.as_deref().unwrap_or("left") {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| format!("Move failed: {}", e))?;
    enigo.button(btn, enigo::Direction::Click).map_err(|e| format!("Click failed: {}", e))?;
    Ok(())
}

/// Move the mouse to the given coordinates.
#[tauri::command]
pub async fn mouse_move(x: i32, y: i32) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Coordinate};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| format!("Move failed: {}", e))?;
    Ok(())
}

/// Type text using the keyboard.
#[tauri::command]
pub async fn keyboard_type_text(text: String) -> Result<(), String> {
    use enigo::{Enigo, Settings, Keyboard};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    enigo.text(&text).map_err(|e| format!("Type failed: {}", e))?;
    Ok(())
}

/// Press a special key.
#[tauri::command]
pub async fn keyboard_press_key(key: String) -> Result<(), String> {
    use enigo::{Enigo, Settings, Keyboard, Key};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let key_enum = match key.to_lowercase().as_str() {
        "enter" | "return" => Key::Return,
        "tab" => Key::Tab,
        "escape" | "esc" => Key::Escape,
        "backspace" => Key::Backspace,
        "delete" => Key::Delete,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "space" => Key::Space,
        _ => return Err(format!("Unknown key: {}", key)),
    };
    enigo.key(key_enum, enigo::Direction::Click).map_err(|e| format!("Key press failed: {}", e))?;
    Ok(())
}
