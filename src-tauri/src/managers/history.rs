use anyhow::Result;
use chrono::{DateTime, Local, Utc};
use log::{debug, error};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

use crate::audio_toolkit::save_wav_file;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub file_name: String,
    pub timestamp: i64,
    pub saved: bool,
    pub title: String,
    pub transcription_text: String,
    pub ghostwritten_text: Option<String>,
    pub profile_id: Option<i64>,
    pub notes: Option<String>,
    pub duration_seconds: Option<f64>,
    pub word_count: Option<i32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Profile {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: String,
    pub custom_instructions: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub created_at: i64,
}

pub struct HistoryManager {
    app_handle: AppHandle,
    recordings_dir: PathBuf,
    db_path: PathBuf,
}

impl HistoryManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        // Create recordings directory in app data dir
        let app_data_dir = app_handle.path().app_data_dir()?;
        let recordings_dir = app_data_dir.join("recordings");
        let db_path = app_data_dir.join("history.db");

        // Ensure recordings directory exists
        if !recordings_dir.exists() {
            fs::create_dir_all(&recordings_dir)?;
            debug!("Created recordings directory: {:?}", recordings_dir);
        }

        let manager = Self {
            app_handle: app_handle.clone(),
            recordings_dir,
            db_path,
        };

        // Initialize database
        manager.init_database()?;

        Ok(manager)
    }

    pub fn get_migrations() -> Vec<Migration> {
        vec![
            Migration {
                version: 1,
                description: "create_transcription_history_table",
                sql: "CREATE TABLE IF NOT EXISTS transcription_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_name TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    saved BOOLEAN NOT NULL DEFAULT 0,
                    title TEXT NOT NULL,
                    transcription_text TEXT NOT NULL
                );",
                kind: MigrationKind::Up,
            },
            Migration {
                version: 2,
                description: "add_ghostwritten_text_column",
                sql: "ALTER TABLE transcription_history ADD COLUMN ghostwritten_text TEXT;",
                kind: MigrationKind::Up,
            },
            Migration {
                version: 3,
                description: "create_profiles_table",
                sql: "CREATE TABLE IF NOT EXISTS profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    color TEXT NOT NULL DEFAULT '#3B82F6',
                    icon TEXT NOT NULL DEFAULT '📝',
                    custom_instructions TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );",
                kind: MigrationKind::Up,
            },
            Migration {
                version: 4,
                description: "create_tags_tables",
                sql: "CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    color TEXT NOT NULL DEFAULT '#3B82F6',
                    created_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS transcription_tags (
                    transcription_id INTEGER NOT NULL,
                    tag_id INTEGER NOT NULL,
                    PRIMARY KEY (transcription_id, tag_id),
                    FOREIGN KEY (transcription_id) REFERENCES transcription_history(id) ON DELETE CASCADE,
                    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
                );",
                kind: MigrationKind::Up,
            },
            Migration {
                version: 5,
                description: "add_metadata_columns",
                sql: "ALTER TABLE transcription_history ADD COLUMN profile_id INTEGER REFERENCES profiles(id);
                ALTER TABLE transcription_history ADD COLUMN notes TEXT;
                ALTER TABLE transcription_history ADD COLUMN duration_seconds REAL;
                ALTER TABLE transcription_history ADD COLUMN word_count INTEGER;",
                kind: MigrationKind::Up,
            },
            Migration {
                version: 6,
                description: "create_fts_search",
                sql: "CREATE VIRTUAL TABLE IF NOT EXISTS transcription_fts USING fts5(
                    transcription_text,
                    ghostwritten_text,
                    notes,
                    content='transcription_history',
                    content_rowid='id'
                );

                CREATE TRIGGER IF NOT EXISTS transcription_ai AFTER INSERT ON transcription_history BEGIN
                    INSERT INTO transcription_fts(rowid, transcription_text, ghostwritten_text, notes)
                    VALUES (new.id, new.transcription_text, new.ghostwritten_text, new.notes);
                END;

                CREATE TRIGGER IF NOT EXISTS transcription_au AFTER UPDATE ON transcription_history BEGIN
                    UPDATE transcription_fts SET
                        transcription_text = new.transcription_text,
                        ghostwritten_text = new.ghostwritten_text,
                        notes = new.notes
                    WHERE rowid = new.id;
                END;

                CREATE TRIGGER IF NOT EXISTS transcription_ad AFTER DELETE ON transcription_history BEGIN
                    DELETE FROM transcription_fts WHERE rowid = old.id;
                END;",
                kind: MigrationKind::Up,
            },
        ]
    }

    fn init_database(&self) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;

        // Create transcription_history table with all columns
        conn.execute(
            "CREATE TABLE IF NOT EXISTS transcription_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                saved BOOLEAN NOT NULL DEFAULT 0,
                title TEXT NOT NULL,
                transcription_text TEXT NOT NULL,
                ghostwritten_text TEXT,
                profile_id INTEGER REFERENCES profiles(id),
                notes TEXT,
                duration_seconds REAL,
                word_count INTEGER
            )",
            [],
        )?;

        // Create profiles table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT NOT NULL DEFAULT '#3B82F6',
                icon TEXT NOT NULL DEFAULT '📝',
                custom_instructions TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // Create tags tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#3B82F6',
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS transcription_tags (
                transcription_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (transcription_id, tag_id),
                FOREIGN KEY (transcription_id) REFERENCES transcription_history(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create FTS5 virtual table
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS transcription_fts USING fts5(
                transcription_text,
                ghostwritten_text,
                notes,
                content='transcription_history',
                content_rowid='id'
            )",
            [],
        )?;

        // Create triggers for FTS sync
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS transcription_ai AFTER INSERT ON transcription_history BEGIN
                INSERT INTO transcription_fts(rowid, transcription_text, ghostwritten_text, notes)
                VALUES (new.id, new.transcription_text, new.ghostwritten_text, new.notes);
            END",
            [],
        )?;

        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS transcription_au AFTER UPDATE ON transcription_history BEGIN
                UPDATE transcription_fts SET
                    transcription_text = new.transcription_text,
                    ghostwritten_text = new.ghostwritten_text,
                    notes = new.notes
                WHERE rowid = new.id;
            END",
            [],
        )?;

        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS transcription_ad AFTER DELETE ON transcription_history BEGIN
                DELETE FROM transcription_fts WHERE rowid = old.id;
            END",
            [],
        )?;

        // Check and add missing columns for existing databases
        self.migrate_existing_columns(&conn)?;

        // Initialize default profiles if none exist
        self.init_default_profiles(&conn)?;

        debug!("Database initialized at: {:?}", self.db_path);
        Ok(())
    }

    fn migrate_existing_columns(&self, conn: &Connection) -> Result<()> {
        // Helper to check if column exists
        let has_column = |table: &str, column: &str| -> bool {
            conn.query_row(
                &format!("SELECT name FROM pragma_table_info('{}') WHERE name='{}'", table, column),
                [],
                |row| row.get::<_, String>(0),
            ).is_ok()
        };

        // Add ghostwritten_text if missing
        if !has_column("transcription_history", "ghostwritten_text") {
            conn.execute("ALTER TABLE transcription_history ADD COLUMN ghostwritten_text TEXT", [])?;
            debug!("Added ghostwritten_text column");
        }

        // Add profile_id if missing
        if !has_column("transcription_history", "profile_id") {
            conn.execute("ALTER TABLE transcription_history ADD COLUMN profile_id INTEGER REFERENCES profiles(id)", [])?;
            debug!("Added profile_id column");
        }

        // Add notes if missing
        if !has_column("transcription_history", "notes") {
            conn.execute("ALTER TABLE transcription_history ADD COLUMN notes TEXT", [])?;
            debug!("Added notes column");
        }

        // Add duration_seconds if missing
        if !has_column("transcription_history", "duration_seconds") {
            conn.execute("ALTER TABLE transcription_history ADD COLUMN duration_seconds REAL", [])?;
            debug!("Added duration_seconds column");
        }

        // Add word_count if missing
        if !has_column("transcription_history", "word_count") {
            conn.execute("ALTER TABLE transcription_history ADD COLUMN word_count INTEGER", [])?;
            debug!("Added word_count column");
        }

        Ok(())
    }

    fn init_default_profiles(&self, conn: &Connection) -> Result<()> {
        // Check if any profiles exist
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM profiles", [], |row| row.get(0))?;

        if count == 0 {
            let now = Utc::now().timestamp();

            // Insert default profiles
            let default_profiles = vec![
                ("Meeting", "📊", "#3B82F6", "Perfect for team meetings and discussions. Formats output with bullet points and formal tone.", "Format this transcription as meeting notes with clear bullet points. Use formal business language."),
                ("Note", "📝", "#10B981", "Quick capture for personal notes and thoughts. Casual and conversational.", "Keep this casual and conversational. Format as natural note-taking."),
                ("Code", "💻", "#8B5CF6", "Technical vocabulary and code formatting. Preserves punctuation and technical terms.", "This is technical content. Preserve code formatting, technical terms, and punctuation exactly."),
                ("Email", "✉️", "#F59E0B", "Formal email composition. Proper capitalization and paragraph structure.", "Format this as a professional email. Use proper capitalization, formal tone, and clear paragraph structure."),
            ];

            let profile_count = default_profiles.len();

            for (name, icon, color, description, instructions) in default_profiles {
                conn.execute(
                    "INSERT INTO profiles (name, description, icon, color, custom_instructions, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![name, description, icon, color, instructions, now, now],
                )?;
            }

            debug!("Initialized {} default profiles", profile_count);
        }

        Ok(())
    }

    fn get_connection(&self) -> Result<Connection> {
        Ok(Connection::open(&self.db_path)?)
    }

    /// Save a transcription to history (both database and WAV file)
    pub async fn save_transcription(
        &self,
        audio_samples: Vec<f32>,
        transcription_text: String,
        ghostwritten_text: Option<String>,
        profile_id: Option<i64>,
        duration_seconds: Option<f64>,
    ) -> Result<()> {
        // If history limit is 0, do not save at all.
        if crate::settings::get_history_limit(&self.app_handle) == 0 {
            return Ok(());
        }

        let timestamp = Utc::now().timestamp();
        let file_name = format!("leadrscribe-{}.wav", timestamp);
        let title = self.format_timestamp_title(timestamp);

        // Calculate word count
        let word_count = transcription_text.split_whitespace().count() as i32;

        // Save WAV file
        let file_path = self.recordings_dir.join(&file_name);
        save_wav_file(file_path, &audio_samples).await?;

        // Save to database with new fields
        self.save_to_database(
            file_name,
            timestamp,
            title,
            transcription_text,
            ghostwritten_text,
            profile_id,
            duration_seconds,
            word_count,
        )?;

        // Clean up old entries
        self.cleanup_old_entries()?;

        // Emit history updated event
        if let Err(e) = self.app_handle.emit("history-updated", ()) {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(())
    }

    fn save_to_database(
        &self,
        file_name: String,
        timestamp: i64,
        title: String,
        transcription_text: String,
        ghostwritten_text: Option<String>,
        profile_id: Option<i64>,
        duration_seconds: Option<f64>,
        word_count: i32,
    ) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute(
            "INSERT INTO transcription_history
             (file_name, timestamp, saved, title, transcription_text, ghostwritten_text, profile_id, duration_seconds, word_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![file_name, timestamp, false, title, transcription_text, ghostwritten_text, profile_id, duration_seconds, word_count],
        )?;

        debug!("Saved transcription to database with word_count: {}", word_count);
        Ok(())
    }

    fn cleanup_old_entries(&self) -> Result<()> {
        let conn = self.get_connection()?;

        // Get all entries that are not saved, ordered by timestamp desc
        let mut stmt = conn.prepare(
            "SELECT id, file_name FROM transcription_history WHERE saved = 0 ORDER BY timestamp DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>("id")?, row.get::<_, String>("file_name")?))
        })?;

        let mut entries: Vec<(i64, String)> = Vec::new();
        for row in rows {
            entries.push(row?);
        }

        let limit = crate::settings::get_history_limit(&self.app_handle);
        if entries.len() > limit {
            let entries_to_delete = &entries[limit..];

            for (id, file_name) in entries_to_delete {
                // Delete database entry
                conn.execute(
                    "DELETE FROM transcription_history WHERE id = ?1",
                    params![id],
                )?;

                // Delete WAV file
                let file_path = self.recordings_dir.join(file_name);
                if file_path.exists() {
                    if let Err(e) = fs::remove_file(&file_path) {
                        error!("Failed to delete WAV file {}: {}", file_name, e);
                    } else {
                        debug!("Deleted old WAV file: {}", file_name);
                    }
                }
            }

            debug!("Cleaned up {} old history entries", entries_to_delete.len());
        }

        Ok(())
    }

    pub async fn get_history_entries(&self) -> Result<Vec<HistoryEntry>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, file_name, timestamp, saved, title, transcription_text, ghostwritten_text,
             profile_id, notes, duration_seconds, word_count
             FROM transcription_history ORDER BY timestamp DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(HistoryEntry {
                id: row.get("id")?,
                file_name: row.get("file_name")?,
                timestamp: row.get("timestamp")?,
                saved: row.get("saved")?,
                title: row.get("title")?,
                transcription_text: row.get("transcription_text")?,
                ghostwritten_text: row.get("ghostwritten_text")?,
                profile_id: row.get("profile_id")?,
                notes: row.get("notes")?,
                duration_seconds: row.get("duration_seconds")?,
                word_count: row.get("word_count")?,
            })
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row?);
        }

        Ok(entries)
    }

    pub async fn toggle_saved_status(&self, id: i64) -> Result<()> {
        let conn = self.get_connection()?;

        // Get current saved status
        let current_saved: bool = conn.query_row(
            "SELECT saved FROM transcription_history WHERE id = ?1",
            params![id],
            |row| row.get("saved"),
        )?;

        let new_saved = !current_saved;

        conn.execute(
            "UPDATE transcription_history SET saved = ?1 WHERE id = ?2",
            params![new_saved, id],
        )?;

        debug!("Toggled saved status for entry {}: {}", id, new_saved);

        // Emit history updated event
        if let Err(e) = self.app_handle.emit("history-updated", ()) {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(())
    }

    pub fn get_audio_file_path(&self, file_name: &str) -> PathBuf {
        self.recordings_dir.join(file_name)
    }

    pub async fn get_entry_by_id(&self, id: i64) -> Result<Option<HistoryEntry>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, file_name, timestamp, saved, title, transcription_text, ghostwritten_text,
             profile_id, notes, duration_seconds, word_count
             FROM transcription_history WHERE id = ?1",
        )?;

        let entry = stmt
            .query_row([id], |row| {
                Ok(HistoryEntry {
                    id: row.get("id")?,
                    file_name: row.get("file_name")?,
                    timestamp: row.get("timestamp")?,
                    saved: row.get("saved")?,
                    title: row.get("title")?,
                    transcription_text: row.get("transcription_text")?,
                    ghostwritten_text: row.get("ghostwritten_text")?,
                    profile_id: row.get("profile_id")?,
                    notes: row.get("notes")?,
                    duration_seconds: row.get("duration_seconds")?,
                    word_count: row.get("word_count")?,
                })
            })
            .optional()?;

        Ok(entry)
    }

    pub async fn delete_entry(&self, id: i64) -> Result<()> {
        let conn = self.get_connection()?;

        // Get the entry to find the file name
        if let Some(entry) = self.get_entry_by_id(id).await? {
            // Delete the audio file first
            let file_path = self.get_audio_file_path(&entry.file_name);
            if file_path.exists() {
                if let Err(e) = fs::remove_file(&file_path) {
                    error!("Failed to delete audio file {}: {}", entry.file_name, e);
                    // Continue with database deletion even if file deletion fails
                }
            }
        }

        // Delete from database
        conn.execute(
            "DELETE FROM transcription_history WHERE id = ?1",
            params![id],
        )?;

        debug!("Deleted history entry with id: {}", id);

        // Emit history updated event
        if let Err(e) = self.app_handle.emit("history-updated", ()) {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(())
    }

    fn format_timestamp_title(&self, timestamp: i64) -> String {
        if let Some(utc_datetime) = DateTime::from_timestamp(timestamp, 0) {
            // Convert UTC to local timezone
            let local_datetime = utc_datetime.with_timezone(&Local);
            local_datetime.format("%B %e, %Y - %l:%M%p").to_string()
        } else {
            format!("Recording {}", timestamp)
        }
    }

    pub fn update_history_limit(&self) -> Result<()> {
        self.cleanup_old_entries()?;
        Ok(())
    }

    /// Full-text search using FTS5
    ///
    /// # Arguments
    /// * `query` - Search query (supports FTS5 syntax like "word1 AND word2", "word*", etc.)
    /// * `limit` - Maximum number of results to return
    ///
    /// # Returns
    /// Vector of HistoryEntry items matching the search query, ordered by relevance
    pub async fn search_transcriptions(&self, query: &str, limit: usize) -> Result<Vec<HistoryEntry>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT h.id, h.file_name, h.timestamp, h.saved, h.title,
                    h.transcription_text, h.ghostwritten_text, h.profile_id,
                    h.notes, h.duration_seconds, h.word_count
             FROM transcription_history h
             INNER JOIN transcription_fts fts ON h.id = fts.rowid
             WHERE transcription_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2"
        )?;

        let entries = stmt.query_map(params![query, limit as i64], |row| {
            Ok(HistoryEntry {
                id: row.get("id")?,
                file_name: row.get("file_name")?,
                timestamp: row.get("timestamp")?,
                saved: row.get("saved")?,
                title: row.get("title")?,
                transcription_text: row.get("transcription_text")?,
                ghostwritten_text: row.get("ghostwritten_text")?,
                profile_id: row.get("profile_id")?,
                notes: row.get("notes")?,
                duration_seconds: row.get("duration_seconds")?,
                word_count: row.get("word_count")?,
            })
        })?;

        let mut result = Vec::new();
        for entry in entries {
            result.push(entry?);
        }

        Ok(result)
    }

    /// Get transcriptions filtered by profile
    pub async fn get_by_profile(&self, profile_id: i64, limit: usize) -> Result<Vec<HistoryEntry>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT id, file_name, timestamp, saved, title, transcription_text,
                    ghostwritten_text, profile_id, notes, duration_seconds, word_count
             FROM transcription_history
             WHERE profile_id = ?1
             ORDER BY timestamp DESC
             LIMIT ?2"
        )?;

        let entries = stmt.query_map(params![profile_id, limit as i64], |row| {
            Ok(HistoryEntry {
                id: row.get("id")?,
                file_name: row.get("file_name")?,
                timestamp: row.get("timestamp")?,
                saved: row.get("saved")?,
                title: row.get("title")?,
                transcription_text: row.get("transcription_text")?,
                ghostwritten_text: row.get("ghostwritten_text")?,
                profile_id: row.get("profile_id")?,
                notes: row.get("notes")?,
                duration_seconds: row.get("duration_seconds")?,
                word_count: row.get("word_count")?,
            })
        })?;

        let mut result = Vec::new();
        for entry in entries {
            result.push(entry?);
        }

        Ok(result)
    }

    /// Get transcriptions within a date range
    pub async fn get_by_date_range(
        &self,
        start_timestamp: i64,
        end_timestamp: i64,
        limit: usize,
    ) -> Result<Vec<HistoryEntry>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT id, file_name, timestamp, saved, title, transcription_text,
                    ghostwritten_text, profile_id, notes, duration_seconds, word_count
             FROM transcription_history
             WHERE timestamp >= ?1 AND timestamp <= ?2
             ORDER BY timestamp DESC
             LIMIT ?3"
        )?;

        let entries = stmt.query_map(params![start_timestamp, end_timestamp, limit as i64], |row| {
            Ok(HistoryEntry {
                id: row.get("id")?,
                file_name: row.get("file_name")?,
                timestamp: row.get("timestamp")?,
                saved: row.get("saved")?,
                title: row.get("title")?,
                transcription_text: row.get("transcription_text")?,
                ghostwritten_text: row.get("ghostwritten_text")?,
                profile_id: row.get("profile_id")?,
                notes: row.get("notes")?,
                duration_seconds: row.get("duration_seconds")?,
                word_count: row.get("word_count")?,
            })
        })?;

        let mut result = Vec::new();
        for entry in entries {
            result.push(entry?);
        }

        Ok(result)
    }

    /// Get only saved/favorited transcriptions
    pub async fn get_saved_only(&self, limit: usize) -> Result<Vec<HistoryEntry>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT id, file_name, timestamp, saved, title, transcription_text,
                    ghostwritten_text, profile_id, notes, duration_seconds, word_count
             FROM transcription_history
             WHERE saved = 1
             ORDER BY timestamp DESC
             LIMIT ?1"
        )?;

        let entries = stmt.query_map(params![limit as i64], |row| {
            Ok(HistoryEntry {
                id: row.get("id")?,
                file_name: row.get("file_name")?,
                timestamp: row.get("timestamp")?,
                saved: row.get("saved")?,
                title: row.get("title")?,
                transcription_text: row.get("transcription_text")?,
                ghostwritten_text: row.get("ghostwritten_text")?,
                profile_id: row.get("profile_id")?,
                notes: row.get("notes")?,
                duration_seconds: row.get("duration_seconds")?,
                word_count: row.get("word_count")?,
            })
        })?;

        let mut result = Vec::new();
        for entry in entries {
            result.push(entry?);
        }

        Ok(result)
    }

    /// Update notes for a transcription
    pub async fn update_notes(&self, id: i64, notes: Option<String>) -> Result<()> {
        let conn = self.get_connection()?;

        conn.execute(
            "UPDATE transcription_history SET notes = ?1 WHERE id = ?2",
            params![notes, id],
        )?;

        debug!("Updated notes for entry {}", id);

        // Emit event
        if let Err(e) = self.app_handle.emit("history-updated", ()) {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(())
    }

    /// Get statistics for the history
    pub async fn get_stats(&self) -> Result<HistoryStats> {
        let conn = self.get_connection()?;

        let total_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transcription_history",
            [],
            |row| row.get(0),
        )?;

        let total_duration: f64 = conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0.0) FROM transcription_history",
            [],
            |row| row.get(0),
        )?;

        let total_words: i64 = conn.query_row(
            "SELECT COALESCE(SUM(word_count), 0) FROM transcription_history",
            [],
            |row| row.get(0),
        )?;

        let saved_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transcription_history WHERE saved = 1",
            [],
            |row| row.get(0),
        )?;

        Ok(HistoryStats {
            total_count,
            total_duration_seconds: total_duration,
            total_words,
            saved_count,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryStats {
    pub total_count: i64,
    pub total_duration_seconds: f64,
    pub total_words: i64,
    pub saved_count: i64,
}
