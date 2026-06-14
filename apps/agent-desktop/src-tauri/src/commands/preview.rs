/**
 * Document preview commands.
 *
 * Provides server-side rendering of PDF, Excel, and PowerPoint files
 * for in-app preview.
 */

use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    pub kind: String,        // "images" | "structured" | "text"
    pub images: Vec<String>, // base64 PNGs (for kind="images")
    pub data: String,        // JSON string (for kind="structured") or plain text (for kind="text")
}

/// Preview a PDF file by converting pages to images using pdftoppm (if available).
#[tauri::command]
pub async fn preview_pdf(
    path: String,
    from_page: Option<u32>,
    to_page: Option<u32>,
) -> Result<PreviewResponse, String> {
    // Try pdftoppm first (poppler-utils)
    let from = from_page.unwrap_or(1);
    let to = to_page.unwrap_or(10); // limit to 10 pages by default

    let temp_dir = format!("/tmp/svton-preview-{}", std::process::id());
    let _ = std::fs::create_dir(&temp_dir);

    let output = Command::new("pdftoppm")
        .arg("-png")
        .arg("-f").arg(from.to_string())
        .arg("-l").arg(to.to_string())
        .arg("-r").arg("150") // DPI
        .arg(&path)
        .arg(format!("{}/page", temp_dir))
        .output();

    match output {
        Ok(result) if result.status.success() => {
            let mut images = Vec::new();

            // Read generated PNG files
            if let Ok(entries) = std::fs::read_dir(&temp_dir) {
                for entry in entries.flatten() {
                    let file_path = entry.path();
                    if let Ok(data) = std::fs::read(&file_path) {
                        use base64::Engine;
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                        images.push(b64);
                    }
                }
            }

            // Cleanup
            let _ = std::fs::remove_dir_all(&temp_dir);

            if images.is_empty() {
                Ok(PreviewResponse {
                    kind: "text".into(),
                    images: vec![],
                    data: "Failed to render PDF pages. Install poppler-utils for PDF preview.".into(),
                })
            } else {
                Ok(PreviewResponse {
                    kind: "images".into(),
                    images,
                    data: String::new(),
                })
            }
        }
        _ => {
            // Fallback: extract text using Python or pdftotext
            let text_output = Command::new("pdftotext")
                .arg(&path)
                .arg("-")
                .output();

            match text_output {
                Ok(result) if result.status.success() => {
                    let text = String::from_utf8_lossy(&result.stdout).to_string();
                    Ok(PreviewResponse {
                        kind: "text".into(),
                        images: vec![],
                        data: text.chars().take(50000).collect(),
                    })
                }
                _ => Ok(PreviewResponse {
                    kind: "text".into(),
                    images: vec![],
                    data: "PDF preview requires poppler-utils (pdftoppm or pdftotext) to be installed.".into(),
                })
            }
        }
    }
}

/// Preview an Excel file by extracting cell data.
/// Uses Python with openpyxl if available, otherwise returns a message.
#[tauri::command]
pub async fn preview_excel(path: String) -> Result<PreviewResponse, String> {
    let script = format!(
        r#"
import json, sys
try:
    from openpyxl import load_workbook
    wb = load_workbook("{}", read_only=True, data_only=True)
    result = {{}}
    for sheet_name in wb.sheetnames[:5]:  # limit to 5 sheets
        ws = wb[sheet_name]
        rows = []
        for i, row in enumerate(ws.iter_rows(max_row=100, values_only=True)):
            rows.append([str(c) if c is not None else "" for c in row])
        result[sheet_name] = rows
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
"#,
        path.replace("\"", "\\\"")
    );

    let output = Command::new("python3")
        .arg("-c")
        .arg(&script)
        .output();

    match output {
        Ok(result) if result.status.success() => {
            let data = String::from_utf8_lossy(&result.stdout).to_string();
            Ok(PreviewResponse {
                kind: "structured".into(),
                images: vec![],
                data,
            })
        }
        _ => Ok(PreviewResponse {
            kind: "text".into(),
            images: vec![],
            data: "Excel preview requires Python3 with openpyxl installed (pip install openpyxl).".into(),
        }),
    }
}

/// Preview a PowerPoint file by extracting text from slides.
/// Uses Python with python-pptx if available.
#[tauri::command]
pub async fn preview_pptx(path: String) -> Result<PreviewResponse, String> {
    let script = format!(
        r#"
import json, sys
try:
    from pptx import Presentation
    prs = Presentation("{}")
    slides = []
    for i, slide in enumerate(prs.slides[:20]):
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text:
                texts.append(shape.text)
        slides.append({{"slide": i + 1, "content": " | ".join(texts)}})
    print(json.dumps({{"slides": slides}}))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
"#,
        path.replace("\"", "\\\"")
    );

    let output = Command::new("python3")
        .arg("-c")
        .arg(&script)
        .output();

    match output {
        Ok(result) if result.status.success() => {
            let data = String::from_utf8_lossy(&result.stdout).to_string();
            Ok(PreviewResponse {
                kind: "structured".into(),
                images: vec![],
                data,
            })
        }
        _ => Ok(PreviewResponse {
            kind: "text".into(),
            images: vec![],
            data: "PowerPoint preview requires Python3 with python-pptx installed (pip install python-pptx).".into(),
        }),
    }
}
