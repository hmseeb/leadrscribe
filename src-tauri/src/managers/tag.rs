use anyhow::Result;
use chrono::Utc;
use log::{debug, error};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::managers::history::Tag;

pub struct TagManager {
    app_handle: AppHandle,
    db_path: PathBuf,
}

impl TagManager {
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

    /// Get all tags
    pub async fn get_tags(&self) -> Result<Vec<Tag>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, color, created_at
             FROM tags
             ORDER BY name ASC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get("id")?,
                name: row.get("name")?,
                color: row.get("color")?,
                created_at: row.get("created_at")?,
            })
        })?;

        let mut tags = Vec::new();
        for row in rows {
            tags.push(row?);
        }

        Ok(tags)
    }

    /// Get a single tag by ID
    pub async fn get_tag(&self, id: i64) -> Result<Option<Tag>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, color, created_at
             FROM tags
             WHERE id = ?1"
        )?;

        let tag = stmt.query_row([id], |row| {
            Ok(Tag {
                id: row.get("id")?,
                name: row.get("name")?,
                color: row.get("color")?,
                created_at: row.get("created_at")?,
            })
        }).optional()?;

        Ok(tag)
    }

    /// Get tag by name (for autocomplete/search)
    pub async fn get_tag_by_name(&self, name: &str) -> Result<Option<Tag>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, color, created_at
             FROM tags
             WHERE name = ?1"
        )?;

        let tag = stmt.query_row([name], |row| {
            Ok(Tag {
                id: row.get("id")?,
                name: row.get("name")?,
                color: row.get("color")?,
                created_at: row.get("created_at")?,
            })
        }).optional()?;

        Ok(tag)
    }

    /// Search tags by partial name (for autocomplete)
    pub async fn search_tags(&self, query: &str) -> Result<Vec<Tag>> {
        let conn = self.get_connection()?;
        let search_pattern = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT id, name, color, created_at
             FROM tags
             WHERE name LIKE ?1
             ORDER BY name ASC
             LIMIT 20"
        )?;

        let rows = stmt.query_map([&search_pattern], |row| {
            Ok(Tag {
                id: row.get("id")?,
                name: row.get("name")?,
                color: row.get("color")?,
                created_at: row.get("created_at")?,
            })
        })?;

        let mut tags = Vec::new();
        for row in rows {
            tags.push(row?);
        }

        Ok(tags)
    }

    /// Create a new tag
    pub async fn create_tag(&self, name: String, color: String) -> Result<i64> {
        // Check if tag already exists
        if let Some(existing) = self.get_tag_by_name(&name).await? {
            return Ok(existing.id);
        }

        let conn = self.get_connection()?;
        let now = Utc::now().timestamp();

        conn.execute(
            "INSERT INTO tags (name, color, created_at) VALUES (?1, ?2, ?3)",
            params![name, color, now],
        )?;

        let id = conn.last_insert_rowid();
        debug!("Created tag: {} (id: {})", name, id);

        // Emit event
        if let Err(e) = self.app_handle.emit("tags-updated", ()) {
            error!("Failed to emit tags-updated event: {}", e);
        }

        Ok(id)
    }

    /// Update an existing tag
    pub async fn update_tag(&self, id: i64, name: String, color: String) -> Result<()> {
        let conn = self.get_connection()?;

        conn.execute(
            "UPDATE tags SET name = ?1, color = ?2 WHERE id = ?3",
            params![name, color, id],
        )?;

        debug!("Updated tag: {}", id);

        // Emit event
        if let Err(e) = self.app_handle.emit("tags-updated", ()) {
            error!("Failed to emit tags-updated event: {}", e);
        }

        Ok(())
    }

    /// Delete a tag
    pub async fn delete_tag(&self, id: i64) -> Result<()> {
        let conn = self.get_connection()?;

        // Remove all associations first
        conn.execute(
            "DELETE FROM transcription_tags WHERE tag_id = ?1",
            params![id],
        )?;

        // Delete the tag
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;

        debug!("Deleted tag: {}", id);

        // Emit event
        if let Err(e) = self.app_handle.emit("tags-updated", ()) {
            error!("Failed to emit tags-updated event: {}", e);
        }

        Ok(())
    }

    /// Get tags for a specific transcription
    pub async fn get_tags_for_transcription(&self, transcription_id: i64) -> Result<Vec<Tag>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color, t.created_at
             FROM tags t
             INNER JOIN transcription_tags tt ON t.id = tt.tag_id
             WHERE tt.transcription_id = ?1
             ORDER BY t.name ASC"
        )?;

        let rows = stmt.query_map([transcription_id], |row| {
            Ok(Tag {
                id: row.get("id")?,
                name: row.get("name")?,
                color: row.get("color")?,
                created_at: row.get("created_at")?,
            })
        })?;

        let mut tags = Vec::new();
        for row in rows {
            tags.push(row?);
        }

        Ok(tags)
    }

    /// Add a tag to a transcription
    pub async fn add_tag_to_transcription(&self, transcription_id: i64, tag_id: i64) -> Result<()> {
        let conn = self.get_connection()?;

        // Check if association already exists
        let exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM transcription_tags WHERE transcription_id = ?1 AND tag_id = ?2)",
            params![transcription_id, tag_id],
            |row| row.get(0),
        )?;

        if !exists {
            conn.execute(
                "INSERT INTO transcription_tags (transcription_id, tag_id) VALUES (?1, ?2)",
                params![transcription_id, tag_id],
            )?;

            debug!("Added tag {} to transcription {}", tag_id, transcription_id);

            // Emit event
            if let Err(e) = self.app_handle.emit("history-updated", ()) {
                error!("Failed to emit history-updated event: {}", e);
            }
        }

        Ok(())
    }

    /// Remove a tag from a transcription
    pub async fn remove_tag_from_transcription(&self, transcription_id: i64, tag_id: i64) -> Result<()> {
        let conn = self.get_connection()?;

        conn.execute(
            "DELETE FROM transcription_tags WHERE transcription_id = ?1 AND tag_id = ?2",
            params![transcription_id, tag_id],
        )?;

        debug!("Removed tag {} from transcription {}", tag_id, transcription_id);

        // Emit event
        if let Err(e) = self.app_handle.emit("history-updated", ()) {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(())
    }

    /// Get transcriptions by tag
    pub async fn get_transcriptions_by_tag(&self, tag_id: i64) -> Result<Vec<i64>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT transcription_id
             FROM transcription_tags
             WHERE tag_id = ?1
             ORDER BY transcription_id DESC"
        )?;

        let rows = stmt.query_map([tag_id], |row| row.get(0))?;

        let mut ids = Vec::new();
        for row in rows {
            ids.push(row?);
        }

        Ok(ids)
    }

    /// Get tag usage statistics
    pub async fn get_tag_stats(&self, tag_id: i64) -> Result<i64> {
        let conn = self.get_connection()?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transcription_tags WHERE tag_id = ?1",
            params![tag_id],
            |row| row.get(0),
        )?;

        Ok(count)
    }
}
