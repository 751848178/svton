use rusqlite::{params, Connection};
use std::path::PathBuf;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self, String> {
        let db_path = Self::db_path()?;
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .map_err(|e| e.to_string())?;
        Ok(Self { conn })
    }

    pub fn get(&self, key: &str) -> Result<Option<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM kv_store WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row(params![key], |row| row.get::<_, String>(0))
            .ok();
        Ok(result)
    }

    pub fn set(&self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
                params![key, value],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete(&self, key: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM kv_store WHERE key = ?1", params![key])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list(&self, prefix: &str) -> Result<Vec<String>, String> {
        let mut stmt = if prefix.is_empty() {
            self.conn
                .prepare("SELECT key FROM kv_store ORDER BY key")
                .map_err(|e| e.to_string())?
        } else {
            self.conn
                .prepare("SELECT key FROM kv_store WHERE key LIKE ?1 ORDER BY key")
                .map_err(|e| e.to_string())?
        };

        let keys: Vec<String> = if prefix.is_empty() {
            stmt.query_map([], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|k| k.ok())
                .collect()
        } else {
            let pattern = format!("{}%", prefix);
            stmt.query_map(params![pattern], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|k| k.ok())
                .collect()
        };

        Ok(keys)
    }

    pub fn clear(&self) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM kv_store", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn db_path() -> Result<PathBuf, String> {
        let dir = dirs::data_dir().ok_or("Cannot determine data directory")?;
        let svton_dir = dir.join("svton-agent");
        std::fs::create_dir_all(&svton_dir).map_err(|e| e.to_string())?;
        Ok(svton_dir.join("storage.db"))
    }
}
