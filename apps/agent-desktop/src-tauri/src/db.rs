use rusqlite::{params, Connection};
use std::path::PathBuf;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self, String> {
        let db_path = Self::db_path()?;
        Self::new_at_path(&db_path)
    }

    /// Create a Database backed by a specific file path.
    /// Used by `new()` for production and by tests for isolation (temp file).
    pub fn new_at_path(db_path: &std::path::Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> (Database, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("create temp dir");
        let db_path = dir.path().join("test.db");
        let db = Database::new_at_path(&db_path).expect("create test db");
        (db, dir)
    }

    #[test]
    fn set_and_get() {
        let (db, _dir) = test_db();
        db.set("key1", "value1").expect("set");
        assert_eq!(db.get("key1").unwrap(), Some("value1".to_string()));
    }

    #[test]
    fn get_missing_key_returns_none() {
        let (db, _dir) = test_db();
        assert_eq!(db.get("nonexistent").unwrap(), None);
    }

    #[test]
    fn set_overwrites_existing() {
        let (db, _dir) = test_db();
        db.set("k", "v1").unwrap();
        db.set("k", "v2").unwrap();
        assert_eq!(db.get("k").unwrap(), Some("v2".to_string()));
    }

    #[test]
    fn delete_removes_key() {
        let (db, _dir) = test_db();
        db.set("del", "x").unwrap();
        assert!(db.delete("del").is_ok());
        assert_eq!(db.get("del").unwrap(), None);
    }

    #[test]
    fn delete_missing_key_is_noop() {
        let (db, _dir) = test_db();
        assert!(db.delete("never-set").is_ok());
    }

    #[test]
    fn list_all_keys_when_prefix_empty() {
        let (db, _dir) = test_db();
        db.set("alpha", "1").unwrap();
        db.set("beta", "2").unwrap();
        db.set("gamma", "3").unwrap();
        let keys = db.list("").unwrap();
        assert_eq!(keys, vec!["alpha", "beta", "gamma"]); // sorted
    }

    #[test]
    fn list_filters_by_prefix() {
        let (db, _dir) = test_db();
        db.set("agent:session:1", "x").unwrap();
        db.set("agent:session:2", "y").unwrap();
        db.set("other:key", "z").unwrap();
        let keys = db.list("agent:session:").unwrap();
        assert_eq!(keys, vec!["agent:session:1", "agent:session:2"]);
    }

    #[test]
    fn clear_removes_all() {
        let (db, _dir) = test_db();
        db.set("a", "1").unwrap();
        db.set("b", "2").unwrap();
        db.clear().unwrap();
        assert!(db.list("").unwrap().is_empty());
    }

    #[test]
    fn list_returns_sorted() {
        let (db, _dir) = test_db();
        db.set("zebra", "1").unwrap();
        db.set("apple", "2").unwrap();
        db.set("mango", "3").unwrap();
        let keys = db.list("").unwrap();
        assert_eq!(keys, vec!["apple", "mango", "zebra"]);
    }
}
