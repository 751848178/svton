use serde::Serialize;

#[derive(Serialize)]
pub struct PermissionStatus {
    pub accessibility: bool,
    pub screen_recording: bool,
}

// ── macOS FFI ──────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod macos_ffi {
    #![allow(improper_ctypes)]
    use std::os::raw::c_void;

    type CFStringRef = *const c_void;
    type CFDictionaryRef = *const c_void;
    type CFAllocatorRef = *const c_void;

    extern "C" {
        static kAXTrustedCheckOptionPrompt: CFStringRef;
        static kCFBooleanTrue: *const c_void;
        static kCFAllocatorDefault: CFAllocatorRef;
        static kCFTypeDictionaryKeyCallBacks: *const c_void;
        static kCFTypeDictionaryValueCallBacks: *const c_void;

        fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
        fn CFDictionaryCreate(
            allocator: CFAllocatorRef,
            keys: *const *const c_void,
            values: *const *const c_void,
            numValues: isize,
            keyCallBacks: *const c_void,
            valueCallBacks: *const c_void,
        ) -> CFDictionaryRef;
        fn CFRelease(cf: *const c_void);

        fn CGPreflightScreenCaptureAccess() -> bool;
        fn CGRequestScreenCaptureAccess() -> bool;
    }

    /// Check if accessibility permission is granted (no prompt).
    pub fn check_accessibility() -> bool {
        unsafe { AXIsProcessTrustedWithOptions(std::ptr::null()) }
    }

    /// Request accessibility permission (shows system prompt if not yet granted).
    pub fn request_accessibility() -> bool {
        unsafe {
            let keys: [*const c_void; 1] = [kAXTrustedCheckOptionPrompt as *const c_void];
            let values: [*const c_void; 1] = [kCFBooleanTrue];
            let dict = CFDictionaryCreate(
                kCFAllocatorDefault,
                keys.as_ptr(),
                values.as_ptr(),
                1,
                kCFTypeDictionaryKeyCallBacks,
                kCFTypeDictionaryValueCallBacks,
            );
            let result = AXIsProcessTrustedWithOptions(dict);
            if !dict.is_null() {
                CFRelease(dict as *const c_void);
            }
            result
        }
    }

    /// Check if screen recording permission is granted (no prompt).
    pub fn check_screen_recording() -> bool {
        unsafe { CGPreflightScreenCaptureAccess() }
    }

    /// Request screen recording permission (shows system dialog).
    pub fn request_screen_recording() -> bool {
        unsafe { CGRequestScreenCaptureAccess() }
    }
}

// ── Tauri commands ─────────────────────────────────────────

/// Check current macOS permission status for Computer Use features.
#[tauri::command]
pub async fn check_macos_permissions() -> Result<PermissionStatus, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(PermissionStatus {
            accessibility: macos_ffi::check_accessibility(),
            screen_recording: macos_ffi::check_screen_recording(),
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(PermissionStatus {
            accessibility: true,
            screen_recording: true,
        })
    }
}

/// Request accessibility permission (shows macOS system prompt).
#[tauri::command]
pub async fn request_accessibility_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(macos_ffi::request_accessibility())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

/// Request screen recording permission (shows macOS system dialog).
#[tauri::command]
pub async fn request_screen_recording_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(macos_ffi::request_screen_recording())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

/// Open macOS System Settings to a specific privacy pane.
/// pane: "accessibility" | "screen_recording"
#[tauri::command]
pub async fn open_system_settings(pane: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match pane.as_str() {
            "screen_recording" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
            _ => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        };
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open System Settings: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = pane;
        Ok(())
    }
}
