use base64::Engine;
use image::ImageEncoder;
use std::thread;
use std::time::Duration;

/// Capture a screenshot of the primary display.
/// Returns base64-encoded JPEG (resized to max 1280px width for efficiency).
#[tauri::command]
pub async fn screenshot_display(display_index: Option<usize>) -> Result<String, String> {
    let screens = screenshots::Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let idx = display_index.unwrap_or(0).min(screens.len().saturating_sub(1));
    let screen = screens.get(idx).ok_or("No display found")?;

    let img = screen.capture().map_err(|e| format!("Screenshot failed: {}", e))?;

    // Resize to max 1280px width to reduce size
    let max_width = 1280u32;
    let (orig_w, orig_h) = (img.width(), img.height());
    let (new_w, new_h) = if orig_w > max_width {
        let ratio = max_width as f32 / orig_w as f32;
        (max_width, (orig_h as f32 * ratio).round() as u32)
    } else {
        (orig_w, orig_h)
    };

    let rgba = image::RgbaImage::from_raw(orig_w, orig_h, img.as_raw().to_vec())
        .ok_or("Failed to create image buffer")?;
    let resized = image::imageops::resize(&rgba, new_w, new_h, image::imageops::FilterType::Lanczos3);

    // Encode as JPEG quality 80 (much smaller than PNG)
    let rgb = image::DynamicImage::ImageRgba8(resized).to_rgb8();
    let mut jpg_buf = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpg_buf, 80)
        .write_image(&rgb, new_w, new_h, image::ExtendedColorType::Rgb8)
        .map_err(|e| format!("JPEG encoding failed: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&jpg_buf);
    Ok(b64)
}

/// Click the mouse at the given coordinates.
#[tauri::command]
pub async fn mouse_click(x: i32, y: i32, button: Option<String>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Button, Coordinate};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let btn = parse_button(button.as_deref().unwrap_or("left"))?;
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| format!("Move failed: {}", e))?;
    enigo.button(btn, enigo::Direction::Click).map_err(|e| format!("Click failed: {}", e))?;
    Ok(())
}

/// Double-click the mouse at the given coordinates.
#[tauri::command]
pub async fn mouse_double_click(x: i32, y: i32, button: Option<String>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Button, Coordinate};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let btn = parse_button(button.as_deref().unwrap_or("left"))?;
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| format!("Move failed: {}", e))?;
    enigo.button(btn, enigo::Direction::Click).map_err(|e| format!("Click 1 failed: {}", e))?;
    thread::sleep(Duration::from_millis(50));
    enigo.button(btn, enigo::Direction::Click).map_err(|e| format!("Click 2 failed: {}", e))?;
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

/// Press and hold the mouse button at the given coordinates.
#[tauri::command]
pub async fn mouse_down(x: i32, y: i32, button: Option<String>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Button, Coordinate};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let btn = parse_button(button.as_deref().unwrap_or("left"))?;
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| format!("Move failed: {}", e))?;
    enigo.button(btn, enigo::Direction::Press).map_err(|e| format!("Press failed: {}", e))?;
    Ok(())
}

/// Release the mouse button at the given coordinates.
#[tauri::command]
pub async fn mouse_up(x: i32, y: i32, button: Option<String>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Button, Coordinate};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let btn = parse_button(button.as_deref().unwrap_or("left"))?;
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| format!("Move failed: {}", e))?;
    enigo.button(btn, enigo::Direction::Release).map_err(|e| format!("Release failed: {}", e))?;
    Ok(())
}

/// Drag from one point to another.
#[tauri::command]
pub async fn mouse_drag(start_x: i32, start_y: i32, end_x: i32, end_y: i32, button: Option<String>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Button, Coordinate};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let btn = parse_button(button.as_deref().unwrap_or("left"))?;

    // Move to start position and press
    enigo.move_mouse(start_x, start_y, Coordinate::Abs).map_err(|e| format!("Move to start failed: {}", e))?;
    thread::sleep(Duration::from_millis(50));
    enigo.button(btn, enigo::Direction::Press).map_err(|e| format!("Press failed: {}", e))?;
    thread::sleep(Duration::from_millis(50));

    // Move to end position in steps for smooth dragging
    let steps = 10;
    let dx = (end_x - start_x) as f64 / steps as f64;
    let dy = (end_y - start_y) as f64 / steps as f64;
    for i in 1..=steps {
        let nx = (start_x as f64 + dx * i as f64).round() as i32;
        let ny = (start_y as f64 + dy * i as f64).round() as i32;
        enigo.move_mouse(nx, ny, Coordinate::Abs).map_err(|e| format!("Move step {} failed: {}", i, e))?;
        thread::sleep(Duration::from_millis(10));
    }

    // Release at end position
    thread::sleep(Duration::from_millis(50));
    enigo.button(btn, enigo::Direction::Release).map_err(|e| format!("Release failed: {}", e))?;
    Ok(())
}

/// Scroll at the given position.
#[tauri::command]
pub async fn scroll(x: i32, y: i32, direction: String, amount: Option<i32>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Mouse, Coordinate, Axis};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;
    let amt = amount.unwrap_or(3);

    // Move to position first
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| format!("Move failed: {}", e))?;

    let (length, axis) = match direction.to_lowercase().as_str() {
        "up" => (-amt, Axis::Vertical),
        "down" => (amt, Axis::Vertical),
        "left" => (-amt, Axis::Horizontal),
        "right" => (amt, Axis::Horizontal),
        _ => return Err(format!("Unknown scroll direction: {}. Use up/down/left/right", direction)),
    };

    enigo.scroll(length, axis).map_err(|e| format!("Scroll failed: {}", e))?;
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

/// Press a special key, optionally with modifier keys.
#[tauri::command]
pub async fn keyboard_press_key(key: String, modifiers: Option<Vec<String>>) -> Result<(), String> {
    use enigo::{Enigo, Settings, Keyboard, Key};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init failed: {}", e))?;

    let key_enum = parse_key(&key)?;

    // Parse and press modifier keys
    let mods = parse_modifiers(modifiers.unwrap_or_default())?;
    for m in &mods {
        enigo.key(*m, enigo::Direction::Press).map_err(|e| format!("Modifier press failed: {}", e))?;
    }
    thread::sleep(Duration::from_millis(20));

    // Press and release the main key
    enigo.key(key_enum, enigo::Direction::Click).map_err(|e| format!("Key press failed: {}", e))?;
    thread::sleep(Duration::from_millis(20));

    // Release modifier keys in reverse order
    for m in mods.iter().rev() {
        enigo.key(*m, enigo::Direction::Release).map_err(|e| format!("Modifier release failed: {}", e))?;
    }

    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────

fn parse_button(name: &str) -> Result<enigo::Button, String> {
    match name {
        "right" => Ok(enigo::Button::Right),
        "middle" => Ok(enigo::Button::Middle),
        "left" => Ok(enigo::Button::Left),
        _ => Err(format!("Unknown button: {}", name)),
    }
}

fn parse_key(key: &str) -> Result<enigo::Key, String> {
    match key.to_lowercase().as_str() {
        "enter" | "return" => Ok(enigo::Key::Return),
        "tab" => Ok(enigo::Key::Tab),
        "escape" | "esc" => Ok(enigo::Key::Escape),
        "backspace" => Ok(enigo::Key::Backspace),
        "delete" => Ok(enigo::Key::Delete),
        "up" => Ok(enigo::Key::UpArrow),
        "down" => Ok(enigo::Key::DownArrow),
        "left" => Ok(enigo::Key::LeftArrow),
        "right" => Ok(enigo::Key::RightArrow),
        "home" => Ok(enigo::Key::Home),
        "end" => Ok(enigo::Key::End),
        "pageup" => Ok(enigo::Key::PageUp),
        "pagedown" => Ok(enigo::Key::PageDown),
        "space" => Ok(enigo::Key::Space),
        "f1" => Ok(enigo::Key::F1),
        "f2" => Ok(enigo::Key::F2),
        "f3" => Ok(enigo::Key::F3),
        "f4" => Ok(enigo::Key::F4),
        "f5" => Ok(enigo::Key::F5),
        "f6" => Ok(enigo::Key::F6),
        "f7" => Ok(enigo::Key::F7),
        "f8" => Ok(enigo::Key::F8),
        "f9" => Ok(enigo::Key::F9),
        "f10" => Ok(enigo::Key::F10),
        "f11" => Ok(enigo::Key::F11),
        "f12" => Ok(enigo::Key::F12),
        _ => Err(format!("Unknown key: {}", key)),
    }
}

fn parse_modifiers(names: Vec<String>) -> Result<Vec<enigo::Key>, String> {
    let mut mods = Vec::new();
    for name in &names {
        let k = match name.to_lowercase().as_str() {
            "ctrl" | "control" => enigo::Key::Control,
            "alt" | "option" => enigo::Key::Alt,
            "shift" => enigo::Key::Shift,
            "meta" | "cmd" | "command" | "super" | "win" => enigo::Key::Meta,
            _ => return Err(format!("Unknown modifier: {}", name)),
        };
        mods.push(k);
    }
    Ok(mods)
}
