#!/usr/bin/env python3
"""Offline backup, verify, and restore. Never starts services or remote jobs."""
import argparse
import os
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path
from backup_integrity import digest, verify_backup, write_checksums
from data_safety import database_stamp, directory, maintenance_lock, open_database, safe_tree, validate_data
from process_state import stopped


def new_destination(value, source):
    item = Path(value).expanduser()
    if item.is_symlink() or item.exists():
        raise ValueError("Destination must be a new, nonexistent directory")
    parent = directory(item.parent)
    target = parent / item.name
    if target == source or target.is_relative_to(source):
        raise ValueError("Destination cannot be inside the source directory")
    return target


def private_copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    shutil.copyfile(source, target)
    os.chmod(target, 0o600)
    with target.open("rb") as stream:
        os.fsync(stream.fileno())


def backup(source_value, output_value, stopped_container=None):
    source = directory(source_value)
    output = new_destination(output_value, source)
    stopped(source, stopped_container)
    with maintenance_lock(source):
        stopped(source, stopped_container)
        validate_data(source)
        stamp = database_stamp(source)
        output.mkdir(mode=0o700)
        try:
            with open_database(source) as original:
                with closing(sqlite3.connect(output / "platform.db")) as snapshot:
                    original.backup(snapshot)
            os.chmod(output / "platform.db", 0o600)
            for name in ("logs", "process-logs"):
                (output / name).mkdir(mode=0o700)
                for file in safe_tree(source / name):
                    target = output / file.relative_to(source)
                    private_copy(file, target)
                    if digest(file) != digest(target):
                        raise ValueError("Source log changed during backup")
            stopped(source, stopped_container)
            validate_data(source)
            if database_stamp(source) != stamp:
                raise ValueError("Source database changed during backup")
            write_checksums(output)
            verify_backup(output)
            stopped(source, stopped_container)
        except BaseException:
            shutil.rmtree(output)
            raise
    return output


def restore(backup_value, destination_value):
    source = verify_backup(backup_value)
    target = new_destination(destination_value, source)
    target.mkdir(mode=0o700)
    try:
        for file in safe_tree(source):
            private_copy(file, target / file.relative_to(source))
        for name in ("logs", "process-logs"):
            (target / name).mkdir(exist_ok=True, mode=0o700)
        verify_backup(target)
        # A rollback of session records must never resurrect logged-out cookies.
        with closing(sqlite3.connect(target / "platform.db")) as database:
            exists = database.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='AuthSession'").fetchone()
            if exists:
                database.execute('DELETE FROM AuthSession')
                database.commit()
        (target / "SHA256SUMS").unlink()
        write_checksums(target)
        verify_backup(target)
    except BaseException:
        shutil.rmtree(target)
        raise
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("backup", help="Back up a stopped platform into a new directory")
    create.add_argument("--source", required=True)
    create.add_argument("--output", required=True)
    create.add_argument("--stopped-container", help="Explicit Docker identity for a stopped container data owner")
    check = commands.add_parser("verify", help="Verify all hashes, database and log indices")
    check.add_argument("--backup", required=True)
    recover = commands.add_parser("restore", help="Restore into a new directory without live switching")
    recover.add_argument("--backup", required=True)
    recover.add_argument("--destination", required=True)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.command == "backup":
            result = backup(args.source, args.output, args.stopped_container)
        elif args.command == "verify":
            result = verify_backup(args.backup)
        else:
            result = restore(args.backup, args.destination)
        print(f"{args.command}: verified {result}")
    except (ValueError, OSError, sqlite3.Error) as error:
        parser.exit(1, f"{args.command}: refused: {error}\n")


if __name__ == "__main__":
    main()
