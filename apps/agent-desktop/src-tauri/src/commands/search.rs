use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize)]
pub struct GrepMatch {
    pub file: String,
    pub line: usize,
    pub column: Option<usize>,
    pub text: String,
    pub context_before: Option<Vec<String>>,
    pub context_after: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct GrepOptions {
    pub ignore_case: Option<bool>,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
    pub max_results: Option<usize>,
    pub context_lines: Option<usize>,
}

#[tauri::command]
pub async fn search_grep(
    pattern: String,
    paths: Vec<String>,
    options: Option<GrepOptions>,
) -> Result<Vec<GrepMatch>, String> {
    let opts = options.unwrap_or(GrepOptions {
        ignore_case: Some(false),
        include_pattern: None,
        exclude_pattern: None,
        max_results: Some(100),
        context_lines: Some(0),
    });
    let max = opts.max_results.unwrap_or(100);
    let ignore_case = opts.ignore_case.unwrap_or(false);

    let mut results = Vec::new();

    for search_path in &paths {
        if results.len() >= max {
            break;
        }

        let entries: Vec<String> = if Path::new(search_path).is_file() {
            vec![search_path.clone()]
        } else {
            WalkDir::new(search_path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .map(|e| e.path().to_string_lossy().to_string())
                .collect()
        };

        for file_path in entries {
            if results.len() >= max {
                break;
            }

            let content = match std::fs::read_to_string(&file_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let pattern_lower = if ignore_case {
                Some(pattern.to_lowercase())
            } else {
                None
            };

            for (line_num, line) in content.lines().enumerate() {
                if results.len() >= max {
                    break;
                }

                let matches = if let Some(ref pl) = pattern_lower {
                    line.to_lowercase().contains(pl.as_str())
                } else {
                    line.contains(pattern.as_str())
                };

                if matches {
                    results.push(GrepMatch {
                        file: file_path.clone(),
                        line: line_num + 1,
                        column: None,
                        text: line.to_string(),
                        context_before: None,
                        context_after: None,
                    });
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn search_glob(pattern: String, path: String) -> Result<Vec<String>, String> {
    let glob_pattern = globset::GlobBuilder::new(&pattern)
        .build()
        .map_err(|e| e.to_string())?
        .compile_matcher();

    let mut results = Vec::new();
    let base = Path::new(&path);

    for entry in WalkDir::new(base).into_iter().filter_map(|e| e.ok()) {
        let relative = entry
            .path()
            .strip_prefix(base)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .to_string();

        if glob_pattern.is_match(&relative) || glob_pattern.is_match(entry.path().to_string_lossy().as_ref()) {
            results.push(entry.path().to_string_lossy().to_string());
        }
    }

    Ok(results)
}
