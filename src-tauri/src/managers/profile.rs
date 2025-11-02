use anyhow::Result;
use chrono::Utc;
use log::{debug, error};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::managers::history::Profile;

pub struct ProfileManager {
    app_handle: AppHandle,
    db_path: PathBuf,
}

impl ProfileManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_data_dir = app_handle.path().app_data_dir()?;
        let db_path = app_data_dir.join("history.db");

        Ok(Self {
            app_handle: app_handle.clone(),
            db_path,
        })
    }

    fn get_connection(&self) -> Result<Connection> {
        Ok(Connection::open(&self.db_path)?)
    }

    /// Get all profiles
    pub async fn get_profiles(&self) -> Result<Vec<Profile>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, color, icon, custom_instructions, created_at, updated_at
             FROM profiles
             ORDER BY created_at ASC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Profile {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                color: row.get("color")?,
                icon: row.get("icon")?,
                custom_instructions: row.get("custom_instructions")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?;

        let mut profiles = Vec::new();
        for row in rows {
            profiles.push(row?);
        }

        Ok(profiles)
    }

    /// Get a single profile by ID
    pub async fn get_profile(&self, id: i64) -> Result<Option<Profile>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, color, icon, custom_instructions, created_at, updated_at
             FROM profiles
             WHERE id = ?1"
        )?;

        let profile = stmt.query_row([id], |row| {
            Ok(Profile {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                color: row.get("color")?,
                icon: row.get("icon")?,
                custom_instructions: row.get("custom_instructions")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        }).optional()?;

        Ok(profile)
    }

    /// Create a new profile
    pub async fn create_profile(
        &self,
        name: String,
        description: Option<String>,
        color: String,
        icon: String,
        custom_instructions: Option<String>,
    ) -> Result<i64> {
        let conn = self.get_connection()?;
        let now = Utc::now().timestamp();

        conn.execute(
            "INSERT INTO profiles (name, description, color, icon, custom_instructions, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![name, description, color, icon, custom_instructions, now, now],
        )?;

        let id = conn.last_insert_rowid();
        debug!("Created profile: {} (id: {})", name, id);

        // Emit event
        if let Err(e) = self.app_handle.emit("profiles-updated", ()) {
            error!("Failed to emit profiles-updated event: {}", e);
        }

        Ok(id)
    }

    /// Update an existing profile
    pub async fn update_profile(
        &self,
        id: i64,
        name: String,
        description: Option<String>,
        color: String,
        icon: String,
        custom_instructions: Option<String>,
    ) -> Result<()> {
        let conn = self.get_connection()?;
        let now = Utc::now().timestamp();

        conn.execute(
            "UPDATE profiles
             SET name = ?1, description = ?2, color = ?3, icon = ?4, custom_instructions = ?5, updated_at = ?6
             WHERE id = ?7",
            params![name, description, color, icon, custom_instructions, now, id],
        )?;

        debug!("Updated profile: {}", id);

        // Emit event
        if let Err(e) = self.app_handle.emit("profiles-updated", ()) {
            error!("Failed to emit profiles-updated event: {}", e);
        }

        Ok(())
    }

    /// Delete a profile
    pub async fn delete_profile(&self, id: i64) -> Result<()> {
        // Don't allow deletion of the "None" profile (ID 1)
        if id == 1 {
            return Err(anyhow::anyhow!("Cannot delete the 'None' profile"));
        }

        let conn = self.get_connection()?;

        // Don't allow deletion if this is the only profile
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM profiles", [], |row| row.get(0))?;
        if count <= 1 {
            return Err(anyhow::anyhow!("Cannot delete the last profile"));
        }

        // Remove profile_id references from transcriptions (set to NULL)
        conn.execute(
            "UPDATE transcription_history SET profile_id = NULL WHERE profile_id = ?1",
            params![id],
        )?;

        // Delete the profile
        conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;

        debug!("Deleted profile: {}", id);

        // Emit event
        if let Err(e) = self.app_handle.emit("profiles-updated", ()) {
            error!("Failed to emit profiles-updated event: {}", e);
        }

        Ok(())
    }

    /// Get profile by name (for quick lookups)
    pub async fn get_profile_by_name(&self, name: &str) -> Result<Option<Profile>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, color, icon, custom_instructions, created_at, updated_at
             FROM profiles
             WHERE name = ?1"
        )?;

        let profile = stmt.query_row([name], |row| {
            Ok(Profile {
                id: row.get("id")?,
                name: row.get("name")?,
                description: row.get("description")?,
                color: row.get("color")?,
                icon: row.get("icon")?,
                custom_instructions: row.get("custom_instructions")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        }).optional()?;

        Ok(profile)
    }

    /// Get statistics for a profile (how many transcriptions use it)
    pub async fn get_profile_stats(&self, id: i64) -> Result<i64> {
        let conn = self.get_connection()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transcription_history WHERE profile_id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        Ok(count)
    }
}
