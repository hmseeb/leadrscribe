use log::{debug, error, info};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Migrates user data from the old "handy" directory to the new "leadrscribe" directory
/// This ensures existing users don't lose their settings, history, and models
pub fn migrate_user_data(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    info!("Checking for user data migration...");

    // Get the app data directories
    let old_dir = get_old_app_data_dir()?;
    let new_dir = get_new_app_data_dir(app)?;

    debug!("Old directory: {:?}", old_dir);
    debug!("New directory: {:?}", new_dir);

    // Check if old directory exists and new directory doesn't
    if old_dir.exists() && !new_dir.exists() {
        info!(
            "Found old Handy data directory. Migrating to LeadrScribe directory..."
        );

        // Create parent directories if needed
        if let Some(parent) = new_dir.parent() {
            fs::create_dir_all(parent)?;
        }

        // Copy the entire directory
        copy_dir_recursive(&old_dir, &new_dir)?;

        info!(
            "Successfully migrated user data from {:?} to {:?}",
            old_dir, new_dir
        );
        info!("Old data directory has been preserved at {:?}", old_dir);
    } else if new_dir.exists() {
        debug!("LeadrScribe directory already exists. No migration needed.");
    } else {
        debug!("No old Handy directory found. Fresh installation.");
    }

    Ok(())
}

/// Get the old "handy" app data directory path
fn get_old_app_data_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut path = match std::env::consts::OS {
        "windows" => {
            let appdata = std::env::var("APPDATA")?;
            PathBuf::from(appdata)
        }
        "macos" => {
            let home = std::env::var("HOME")?;
            PathBuf::from(home).join("Library").join("Application Support")
        }
        "linux" => {
            let home = std::env::var("HOME")?;
            if let Ok(xdg_data) = std::env::var("XDG_DATA_HOME") {
                PathBuf::from(xdg_data)
            } else {
                PathBuf::from(home).join(".local").join("share")
            }
        }
        _ => return Err("Unsupported operating system".into()),
    };

    path.push("handy");
    Ok(path)
}

/// Get the new "leadrscribe" app data directory path
fn get_new_app_data_dir(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data_dir)
}

/// Recursively copy a directory and its contents
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // Create the destination directory
    fs::create_dir_all(dst)?;

    // Iterate through the source directory
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let file_name = entry.file_name();
        let dst_path = dst.join(&file_name);

        if src_path.is_dir() {
            // Recursively copy subdirectories
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            // Copy files
            match fs::copy(&src_path, &dst_path) {
                Ok(bytes) => debug!(
                    "Copied {} ({} bytes)",
                    file_name.to_string_lossy(),
                    bytes
                ),
                Err(e) => error!(
                    "Failed to copy {}: {}",
                    file_name.to_string_lossy(),
                    e
                ),
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_old_app_data_dir() {
        let result = get_old_app_data_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with("handy"));
    }
}
