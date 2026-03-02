#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::fs;
use std::path::Path;

use base64::Engine;
use serde::Deserialize;

#[derive(Deserialize)]
struct DesktopFilePayload {
  path: String,
  base64: String,
}

fn validate_relative_path(value: &str) -> Result<&Path, String> {
  let relative = Path::new(value);
  if relative.is_absolute() {
    return Err("Absolute paths are not allowed.".to_string());
  }

  if relative
    .components()
    .any(|component| matches!(component, std::path::Component::ParentDir))
  {
    return Err("Path traversal is not allowed.".to_string());
  }

  Ok(relative)
}

#[tauri::command]
fn save_generated_files(files: Vec<DesktopFilePayload>) -> Result<String, String> {
  if files.is_empty() {
    return Err("No files to save.".to_string());
  }

  let output_dir = rfd::FileDialog::new()
    .set_title("Choose output directory")
    .pick_folder()
    .ok_or_else(|| "Export canceled by user.".to_string())?;

  for file in files {
    let safe_relative = validate_relative_path(&file.path)?;
    let target = output_dir.join(safe_relative);

    if let Some(parent) = target.parent() {
      fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let bytes = base64::engine::general_purpose::STANDARD
      .decode(file.base64)
      .map_err(|err| err.to_string())?;

    fs::write(&target, bytes).map_err(|err| err.to_string())?;
  }

  Ok(output_dir.to_string_lossy().to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![save_generated_files])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
