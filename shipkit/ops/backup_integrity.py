"""SHA256 inventory and strict validation of a self-contained backup directory."""
import hashlib
import os
from pathlib import Path
from data_safety import DATA_TREES, data_trees, directory, relative_file, safe_tree, validate_data

CHECKSUMS = "SHA256SUMS"


def digest(file):
    value = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def persistent_data_stamp(root):
    names = data_trees(root)
    return names, {file.relative_to(root).as_posix(): digest(file)
        for name in names for file in safe_tree(root / name)}


def inventory(root):
    return {file.relative_to(root).as_posix(): file for file in safe_tree(root)
            if file.relative_to(root).as_posix() != CHECKSUMS}


def write_checksums(root):
    root = directory(root)
    rows = []
    for name, file in sorted(inventory(root).items()):
        relative_file(root, name)
        rows.append(f"{digest(file)}  {name}\n")
    file = root / CHECKSUMS
    descriptor = os.open(file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.writelines(rows)
        stream.flush()
        os.fsync(stream.fileno())


def verify_backup(value):
    root = directory(value)
    files = inventory(root)
    checksums = root / CHECKSUMS
    if checksums.is_symlink() or not checksums.is_file():
        raise ValueError("SHA256SUMS is missing")
    expected = {}
    for row in checksums.read_text().splitlines():
        if len(row) < 67 or row[64:66] != "  ":
            raise ValueError("Invalid SHA256SUMS entry")
        checksum, name = row[:64], row[66:]
        if len(checksum) != 64 or any(char not in "0123456789abcdef" for char in checksum):
            raise ValueError("Invalid SHA256 digest")
        relative_file(root, name)
        if name in expected:
            raise ValueError("Duplicate SHA256SUMS entry")
        expected[name] = checksum
    if set(files) != set(expected) or "platform.db" not in expected:
        raise ValueError("Backup inventory does not match SHA256SUMS")
    if any(digest(files[name]) != checksum for name, checksum in expected.items()):
        raise ValueError("Backup SHA256 mismatch")
    if any(name != "platform.db" and not name.startswith(tuple(f"{tree}/" for tree in DATA_TREES)) for name in files):
        raise ValueError("Unexpected backup file")
    validate_data(root, immutable=True)
    return root
