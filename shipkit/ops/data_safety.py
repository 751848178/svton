"""Offline data invariants; no platform executor or network imports."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path, PurePosixPath


def directory(value):
    path = Path(value).expanduser()
    if path.is_symlink() or not path.is_dir():
        raise ValueError("Expected an existing directory, not a symlink")
    return path.resolve()


def safe_tree(root):
    if root.is_symlink():
        raise ValueError("Symlinks are not supported")
    if not root.exists():
        return []
    if not root.is_dir():
        raise ValueError("Expected a regular directory")
    files = []
    for parent, dirs, names in os.walk(root, followlinks=False):
        for name in dirs + names:
            item = Path(parent) / name
            if item.is_symlink():
                raise ValueError("Symlinks are not supported")
            if not item.is_dir() and not item.is_file():
                raise ValueError("Only regular files and directories are supported")
            if item.is_file():
                files.append(item)
    return sorted(files)


def relative_file(root, value):
    relative = PurePosixPath(value)
    if (not value or relative.is_absolute() or ".." in relative.parts
            or "\\" in value or "\n" in value or "\r" in value
            or relative.as_posix() != value):
        raise ValueError("Unsafe relative file path")
    result = root.joinpath(*relative.parts)
    if not result.resolve().is_relative_to(root):
        raise ValueError("File escapes the data directory")
    return result


@contextmanager
def maintenance_lock(root):
    lock = root / ".ops.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError("Maintenance/service lock exists; never remove a live lock") from None
    identity = os.fstat(descriptor).st_ino
    try:
        os.write(descriptor, json.dumps({"pid": os.getpid(), "purpose": "backup"}).encode())
        os.fsync(descriptor)
        yield
    finally:
        os.close(descriptor)
        if lock.exists() and lock.stat().st_ino == identity:
            lock.unlink()


@contextmanager
def open_database(root, immutable=False):
    database = root / "platform.db"
    if database.is_symlink() or not database.is_file():
        raise ValueError("Expected platform.db inside the data directory")
    for name in ("platform.db-wal", "platform.db-shm"):
        if (root / name).is_symlink():
            raise ValueError("Database sidecars cannot be symlinks")
    uri = database.as_uri() + "?mode=ro" + ("&immutable=1" if immutable else "")
    connection = sqlite3.connect(uri, uri=True, timeout=1)
    try:
        yield connection
    finally:
        connection.close()


def validate_data(root, immutable=False):
    """Match every archive row to exactly one complete log with identical bytes."""
    logs = safe_tree(root / "logs")
    safe_tree(root / "process-logs")
    with open_database(root, immutable) as database:
        if database.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("SQLite integrity check failed")
        if database.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("SQLite foreign key check failed")
        active = database.execute('''SELECT COUNT(*) FROM Task WHERE activeScope IS NOT NULL
            OR status IN ('queued','running','cancel-requested')
            OR (status='interrupted' AND finishedAt IS NULL) OR cleanupState='releasing' ''').fetchone()[0]
        if active:
            raise ValueError("Active or unresolved tasks exist; finish/reconcile them before maintenance")
        expected = set()
        for relative, size, complete in database.execute('SELECT relativePath, bytes, complete FROM LogArchive'):
            file = relative_file(root, relative)
            if not relative.startswith("logs/") or relative in expected:
                raise ValueError("Invalid or duplicate log archive index")
            if (file.is_symlink() or not file.is_file() or file.stat().st_size != size or complete != 1):
                raise ValueError("Database/log archive mismatch or incomplete archive")
            expected.add(relative)
        actual = {file.relative_to(root).as_posix() for file in logs}
        if actual != expected:
            raise ValueError("Database/log archive index mismatch")


def database_stamp(root):
    values = []
    for name in ("platform.db", "platform.db-wal"):
        item = root / name
        if item.is_symlink():
            raise ValueError("Database sidecars cannot be symlinks")
        stat = item.stat() if item.exists() else None
        values.append((name, stat.st_size, stat.st_mtime_ns) if stat else (name, None, None))
    return values
