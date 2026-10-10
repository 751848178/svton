"""Controller last-build records are preserved without relaxing offline safety."""
import json
import os
import unittest
from unittest.mock import patch
import test_platform_ops as baseline
import platform_ops
from backup_integrity import digest, verify_backup
from platform_ops import backup, restore


class ControllerStateBackup(unittest.TestCase):
    setUp = baseline.OfflineOperations.setUp
    tearDown = baseline.OfflineOperations.tearDown
    change = baseline.OfflineOperations.change

    def state(self):
        directory = self.data / "controller-state"
        directory.mkdir()
        first = directory / "last-build-server.123456789abcdef0.json"
        first.write_text(json.dumps({"app": "server", "project": "isolated-project", "service": "platform",
            "imageRef": "registry.example/shipkit@sha256:" + "a" * 64, "tag": "0.0.1", "at": "fixed"}))
        nested = directory / "nested" / "previous.json"
        nested.parent.mkdir()
        nested.write_text("辅助持久化记录\n")
        return directory, first, nested

    def test_controller_records_are_hashed_restored_and_private(self):
        directory, first, nested = self.state()
        backup(self.data, self.output)
        checksums = (self.output / "SHA256SUMS").read_text()
        for file in (first, nested):
            relative = file.relative_to(self.data)
            self.assertIn(f"{digest(file)}  {relative.as_posix()}\n", checksums)
            self.assertEqual((self.output / relative).read_bytes(), file.read_bytes())
            self.assertEqual((self.output / relative).stat().st_mode & 0o777, 0o600)
        self.assertEqual(verify_backup(self.output), self.output)
        destination = self.root / "restored"
        restore(self.output, destination)
        for file in (first, nested):
            restored = destination / file.relative_to(self.data)
            self.assertEqual(restored.read_bytes(), file.read_bytes())
            self.assertEqual(restored.stat().st_mode & 0o777, 0o600)
        self.assertEqual((destination / directory.relative_to(self.data)).stat().st_mode & 0o777, 0o700)

    def test_legacy_absence_and_empty_controller_directory_remain_compatible(self):
        for present in (False, True):
            with self.subTest(present=present):
                state = self.data / "controller-state"
                if present:
                    state.mkdir()
                output = self.root / f"backup-{present}"
                backup(self.data, output)
                self.assertEqual((output / "controller-state").exists(), present)
                destination = self.root / f"restored-{present}"
                restore(output, destination)
                self.assertEqual((destination / "controller-state").exists(), present)
                self.assertEqual(verify_backup(destination), destination)

    def test_tampered_missing_or_extra_controller_bytes_refuse_verify_and_restore(self):
        _, first, _ = self.state()
        for change in ("tampered", "missing", "extra"):
            with self.subTest(change=change):
                output = self.root / f"backup-{change}"
                backup(self.data, output)
                item = output / first.relative_to(self.data)
                if change == "tampered":
                    item.write_text("changed image identity")
                elif change == "missing":
                    item.unlink()
                else:
                    item.with_name("untracked.json").write_text("extra")
                with self.assertRaises(ValueError):
                    verify_backup(output)
                destination = self.root / f"restored-{change}"
                with self.assertRaises(ValueError):
                    restore(output, destination)
                self.assertFalse(destination.exists())

    def test_controller_directory_file_nested_and_dangling_symlinks_are_refused(self):
        state = self.data / "controller-state"
        outside = self.root / "outside"
        outside.mkdir()
        (outside / "keep.json").write_text("never copy")
        state.symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Symlinks"):
            backup(self.data, self.output)
        state.unlink()
        directory, first, _ = self.state()
        for file in (first, directory / "nested", directory / "dangling"):
            with self.subTest(file=file):
                if file.is_dir():
                    file.rename(directory / "original-nested")
                elif file.exists():
                    file.unlink()
                file.symlink_to(outside if file.name != "dangling" else self.root / "missing")
                with self.assertRaisesRegex(ValueError, "Symlinks"):
                    backup(self.data, self.output)
                file.unlink()
        self.assertFalse(self.output.exists())
        self.assertEqual((outside / "keep.json").read_text(), "never copy")

    def test_unlocked_writer_adding_controller_record_during_copy_refuses_partial_backup(self):
        directory, _, _ = self.state()
        original = platform_ops.private_copy
        def changed(source, target):
            original(source, target)
            if source.parent == directory:
                (directory / "late.json").write_text("changed after tree enumeration")
        with patch("platform_ops.private_copy", side_effect=changed):
            with self.assertRaisesRegex(ValueError, "persisted data changed"):
                backup(self.data, self.output)
        self.assertFalse(self.output.exists())
        self.assertFalse((self.data / ".ops.lock").exists())

    def test_controller_state_keeps_live_pid_lock_and_active_task_protection(self):
        self.state()
        (self.data / "runtime.json").write_text(json.dumps({"apiPid": os.getpid()}))
        with self.assertRaisesRegex(ValueError, "PID is running"):
            backup(self.data, self.output)
        (self.data / "runtime.json").unlink()
        lock = self.data / ".ops.lock"
        lock.write_text("unknown owner")
        with self.assertRaisesRegex(ValueError, "lock exists"):
            backup(self.data, self.output)
        self.assertEqual(lock.read_text(), "unknown owner")
        lock.unlink()
        self.change("UPDATE Task SET status='interrupted',finishedAt=NULL")
        with self.assertRaisesRegex(ValueError, "Active or unresolved"):
            backup(self.data, self.output)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
