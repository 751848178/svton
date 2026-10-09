"""Temporary fixtures only: no production data, services, or Agent calls."""
import json
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from backup_integrity import digest, verify_backup, write_checksums
from platform_ops import backup, restore


class OfflineOperations(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="shipkit-ops-test-")
        self.root = Path(self.temporary.name).resolve()
        self.data = self.root / "data"
        self.data.mkdir()
        self.log = self.data / "logs" / "task-test" / "build--api.log"
        self.log.parent.mkdir(parents=True)
        self.log.write_bytes("first\n中文归档\n".encode())
        process = self.data / "process-logs"
        process.mkdir()
        (process / "api.log").write_text("private process diagnostic\n")
        with closing(sqlite3.connect(self.data / "platform.db")) as database:
            database.executescript('''PRAGMA journal_mode=WAL;
                CREATE TABLE Task (id TEXT PRIMARY KEY, status TEXT, activeScope TEXT,
                    finishedAt TEXT, cleanupState TEXT);
                CREATE TABLE LogArchive (id TEXT PRIMARY KEY, taskId TEXT REFERENCES Task(id),
                    relativePath TEXT, bytes INTEGER, complete INTEGER);
                CREATE TABLE Project (id TEXT PRIMARY KEY, name TEXT);
                INSERT INTO Task VALUES ('task-test','succeeded',NULL,'finished','released');
                INSERT INTO Project VALUES ('project-test','persistent metadata');''')
            database.execute('INSERT INTO LogArchive VALUES (?,?,?,?,?)',
                ('archive-test', 'task-test', 'logs/task-test/build--api.log', self.log.stat().st_size, 1))
            database.commit()
        self.output = self.root / "backup"

    def tearDown(self):
        self.temporary.cleanup()

    def change(self, statement):
        with closing(sqlite3.connect(self.data / "platform.db")) as database:
            database.execute(statement)
            database.commit()

    def test_backup_restore_preserve_all_database_rows_and_log_bytes(self):
        backup(self.data, self.output)
        self.assertEqual(verify_backup(self.output), self.output)
        destination = self.root / "restored"
        restore(self.output, destination)
        self.assertEqual((destination / self.log.relative_to(self.data)).read_bytes(), self.log.read_bytes())
        self.assertEqual(digest(destination / "platform.db"), digest(self.output / "platform.db"))
        with closing(sqlite3.connect(destination / "platform.db")) as database:
            self.assertEqual(database.execute('SELECT name FROM Project').fetchall(), [('persistent metadata',)])
            self.assertEqual(database.execute('SELECT COUNT(*) FROM Task').fetchone(), (1,))
        self.assertFalse((self.data / ".ops.lock").exists())
        self.assertFalse((destination / "runtime.json").exists())
        self.assertEqual((destination / "platform.db").stat().st_mode & 0o777, 0o600)

    def test_corrupt_backup_refuses_verify_and_restore_without_creating_target(self):
        backup(self.data, self.output)
        file = self.output / self.log.relative_to(self.data)
        file.write_bytes(b"tampered")
        destination = self.root / "restored"
        with self.assertRaisesRegex(ValueError, "SHA256 mismatch"):
            verify_backup(self.output)
        with self.assertRaises(ValueError):
            restore(self.output, destination)
        self.assertFalse(destination.exists())

    def test_restore_revokes_sessions_only_and_leaves_source_backup_unchanged(self):
        with closing(sqlite3.connect(self.data / "platform.db")) as database:
            database.executescript("CREATE TABLE AuthSession (id TEXT PRIMARY KEY); "
                "INSERT INTO AuthSession VALUES ('revocable-session'); "
                "CREATE TABLE Audit (id TEXT PRIMARY KEY, action TEXT); "
                "INSERT INTO Audit VALUES ('audit-test','auth.login');")
        backup(self.data, self.output)
        hashes = {p.relative_to(self.output): digest(p) for p in self.output.rglob('*') if p.is_file()}
        destination = self.root / "restored"
        restore(self.output, destination)
        self.assertEqual(verify_backup(destination), destination)
        with closing(sqlite3.connect(destination / "platform.db")) as database:
            self.assertEqual(database.execute('SELECT COUNT(*) FROM AuthSession').fetchone(), (0,))
            self.assertEqual(database.execute('SELECT * FROM Audit').fetchall(), [('audit-test', 'auth.login')])
            self.assertEqual(database.execute('SELECT COUNT(*) FROM Task').fetchone(), (1,))
            self.assertEqual(database.execute('SELECT COUNT(*) FROM LogArchive').fetchone(), (1,))
        with closing(sqlite3.connect(self.output / "platform.db")) as database:
            self.assertEqual(database.execute('SELECT COUNT(*) FROM AuthSession').fetchone(), (1,))
        self.assertEqual(hashes, {p.relative_to(self.output): digest(p) for p in self.output.rglob('*') if p.is_file()})
        self.assertEqual((destination / self.log.relative_to(self.data)).read_bytes(), self.log.read_bytes())

    def test_sqlite_backup_includes_committed_wal_without_copying_sidecars(self):
        with closing(sqlite3.connect(self.data / "platform.db")) as database:
            database.execute('PRAGMA wal_autocheckpoint=0')
            database.execute("INSERT INTO Project VALUES ('wal-project','committed in WAL')")
            database.commit()
            self.assertGreater((self.data / "platform.db-wal").stat().st_size, 0)
            backup(self.data, self.output)
            with closing(sqlite3.connect(self.output / "platform.db")) as restored:
                self.assertEqual(restored.execute("SELECT name FROM Project WHERE id='wal-project'").fetchone(), ('committed in WAL',))
        self.assertFalse((self.output / "platform.db-wal").exists())
        self.assertFalse((self.output / "platform.db-shm").exists())

    def test_live_pid_and_service_lock_refuse_backup(self):
        (self.data / "runtime.json").write_text(json.dumps({"apiPid": os.getpid()}))
        with self.assertRaisesRegex(ValueError, "PID is running"):
            backup(self.data, self.output)
        (self.data / "runtime.json").unlink()
        (self.data / ".ops.lock").write_text(json.dumps({"pid": os.getpid(), "purpose": "platform"}))
        with self.assertRaisesRegex(ValueError, "lock exists"):
            backup(self.data, self.output)
        self.assertFalse(self.output.exists())
        self.assertTrue((self.data / ".ops.lock").exists())

    def test_active_and_unresolved_tasks_refuse_backup(self):
        for statement in ["UPDATE Task SET activeScope='project:prod'",
                "UPDATE Task SET activeScope=NULL,status='running'",
                "UPDATE Task SET status='interrupted',finishedAt=NULL",
                "UPDATE Task SET status='succeeded',finishedAt='finished',cleanupState='releasing'"]:
            with self.subTest(statement=statement):
                self.change(statement)
                with self.assertRaisesRegex(ValueError, "Active or unresolved"):
                    backup(self.data, self.output)
                self.assertFalse(self.output.exists())
                self.assertFalse((self.data / ".ops.lock").exists())

    def test_missing_mismatched_incomplete_and_unindexed_logs_refuse_backup(self):
        for statement in ["UPDATE LogArchive SET bytes=1", "UPDATE LogArchive SET complete=0",
                "UPDATE LogArchive SET relativePath='logs/missing.log'",
                "UPDATE LogArchive SET relativePath='../outside.log'"]:
            with self.subTest(statement=statement):
                self.change(statement)
                with self.assertRaises(ValueError):
                    backup(self.data, self.output)
                self.assertFalse(self.output.exists())
                self.change("UPDATE LogArchive SET relativePath='logs/task-test/build--api.log',complete=1,bytes=" + str(self.log.stat().st_size))
        (self.data / "logs" / "unindexed.log").write_text("not indexed")
        with self.assertRaisesRegex(ValueError, "index mismatch"):
            backup(self.data, self.output)

    def test_nested_destination_symlink_escape_and_existing_restore_are_refused(self):
        with self.assertRaisesRegex(ValueError, "inside the source"):
            backup(self.data, self.data / "nested-backup")
        outside = self.root / "outside.log"
        outside.write_text("never copy")
        self.log.unlink()
        self.log.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "Symlinks"):
            backup(self.data, self.output)
        self.assertEqual(outside.read_text(), "never copy")
        self.log.unlink()
        self.log.write_bytes("first\n中文归档\n".encode())
        backup(self.data, self.output)
        destination = self.root / "existing"
        destination.mkdir()
        sentinel = destination / "keep.txt"
        sentinel.write_text("preserve")
        with self.assertRaisesRegex(ValueError, "nonexistent"):
            restore(self.output, destination)
        self.assertEqual(sentinel.read_text(), "preserve")

    def test_rehashed_db_log_mismatch_and_extra_files_are_still_rejected(self):
        backup(self.data, self.output)
        (self.output / "SHA256SUMS").unlink()
        (self.output / self.log.relative_to(self.data)).write_bytes(b"new bytes")
        write_checksums(self.output)
        with self.assertRaisesRegex(ValueError, "archive mismatch"):
            verify_backup(self.output)
        (self.output / "unexpected.txt").write_text("extra")
        with self.assertRaisesRegex(ValueError, "inventory"):
            verify_backup(self.output)


if __name__ == "__main__":
    unittest.main()
