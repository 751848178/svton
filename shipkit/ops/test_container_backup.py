"""Explicit stopped-container ownership checks; Docker inspect is read-only."""
import copy
import json
import os
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch
import test_platform_ops as baseline
from container_safety import inspect_container
from platform_ops import backup, restore
from process_state import stopped


class ContainerBackup(unittest.TestCase):
    setUp = baseline.OfflineOperations.setUp
    tearDown = baseline.OfflineOperations.tearDown
    change = baseline.OfflineOperations.change

    def record(self, **changes):
        value = {"supervisorPid": 1, "apiPid": 18, "webPid": 19,
            "pidNamespace": "pid:[9999999999]", "containerId": "a" * 12,
            "containerDataRoot": "/var/lib/shipkit"}
        value.update(changes)
        (self.data / "runtime.json").write_text(json.dumps(value))
        return value

    def inspected(self):
        return {"Id": "a" * 64, "State": {"Running": False, "Pid": 0, "Restarting": False, "Paused": False},
            "Mounts": [{"Type": "bind", "Source": str(self.data), "Destination": "/var/lib/shipkit"}]}

    def test_stopped_container_bypasses_host_pid_collision_and_preserves_backup(self):
        self.record(apiPid=os.getpid())
        with patch("container_safety.inspect_container", return_value=self.inspected()) as inspect:
            with patch("process_state.os.kill") as kill:
                backup(self.data, self.output, "shipkit-test")
                kill.assert_not_called()
            self.assertEqual(inspect.call_count, 4)
        destination = self.root / "restored"
        restore(self.output, destination)
        self.assertEqual((destination / self.log.relative_to(self.data)).read_bytes(), self.log.read_bytes())
        self.assertFalse((self.data / ".ops.lock").exists())

    def test_foreign_namespace_requires_explicit_container(self):
        self.record()
        with self.assertRaisesRegex(ValueError, "explicit --stopped-container"):
            backup(self.data, self.output)
        self.assertFalse(self.output.exists())

    def test_full_identity_and_same_namespace_explicit_proof_are_supported(self):
        self.record(containerId="a" * 64, pidNamespace="pid:[7]")
        with patch("process_state.pid_namespace", return_value="pid:[7]"):
            with patch("container_safety.inspect_container", return_value=self.inspected()):
                with patch("process_state.os.kill") as kill:
                    backup(self.data, self.output, "a" * 64)
                    kill.assert_not_called()

    def test_running_or_unknown_container_state_and_wrong_identity_are_refused(self):
        self.record()
        states = [{"Running": True, "Pid": 1}, {"Pid": 0}, {"Running": False, "Pid": False},
            {"Running": False, "Pid": 0, "Restarting": True, "Paused": False},
            {"Running": False, "Pid": 0, "Restarting": False, "Paused": True}]
        values = [{**self.inspected(), "State": state} for state in states]
        values += [{**self.inspected(), "Id": "b" * 64}, {**self.inspected(), "Id": "a" * 12}]
        for value in values:
            with self.subTest(value=value), patch("container_safety.inspect_container", return_value=value):
                with self.assertRaises(ValueError):
                    backup(self.data, self.output, "shipkit-test")
                self.assertFalse(self.output.exists())

    def test_wrong_missing_duplicate_or_volume_mount_is_refused(self):
        self.record()
        good = self.inspected()["Mounts"][0]
        mounts = [[], [good, good], [{**good, "Type": "volume"}], [{**good, "Source": str(self.root)}],
            [{**good, "Destination": "/different"}], [{**good, "Source": "relative"}], "invalid"]
        for value in mounts:
            with self.subTest(mounts=value), patch("container_safety.inspect_container", return_value={**self.inspected(), "Mounts": value}):
                with self.assertRaises(ValueError):
                    backup(self.data, self.output, "shipkit-test")
                self.assertFalse(self.output.exists())

    def test_inspect_failure_and_container_restart_during_backup_remove_partial_output(self):
        self.record()
        with patch("container_safety.inspect_container", side_effect=ValueError("Cannot verify stopped container")):
            with self.assertRaises(ValueError):
                backup(self.data, self.output, "shipkit-test")
        for restart_check in (1, 2, 3):
            running = copy.deepcopy(self.inspected())
            running["State"].update(Running=True, Pid=123)
            schedule = [self.inspected()] * restart_check + [running]
            with self.subTest(restart_check=restart_check), patch("container_safety.inspect_container", side_effect=schedule):
                with self.assertRaisesRegex(ValueError, "running"):
                    backup(self.data, self.output, "shipkit-test")
                self.assertFalse(self.output.exists())
                self.assertFalse((self.data / ".ops.lock").exists())

    def test_container_proof_does_not_relax_active_tasks_or_existing_lock(self):
        self.record()
        with patch("container_safety.inspect_container", return_value=self.inspected()):
            self.change("UPDATE Task SET status='running'")
            with self.assertRaisesRegex(ValueError, "Active or unresolved"):
                backup(self.data, self.output, "shipkit-test")
            self.change("UPDATE Task SET status='succeeded'")
            lock = self.data / ".ops.lock"
            content = json.dumps({"pid": 1, "purpose": "platform", **self.record()})
            lock.write_text(content)
            with self.assertRaisesRegex(ValueError, "lock exists"):
                backup(self.data, self.output, "shipkit-test")
            self.assertEqual(lock.read_text(), content)
        self.assertFalse(self.output.exists())

    def test_legacy_and_same_namespace_records_keep_host_pid_checks(self):
        for value in ({"apiPid": os.getpid()}, {"apiPid": os.getpid(), "pidNamespace": "pid:[7]"}):
            (self.data / "runtime.json").write_text(json.dumps(value))
            with self.subTest(value=value), patch("process_state.pid_namespace", return_value="pid:[7]"):
                with self.assertRaisesRegex(ValueError, "PID is running"):
                    backup(self.data, self.output)
        with self.assertRaisesRegex(ValueError, "Invalid container runtime identity"):
            backup(self.data, self.output, "shipkit-test")

    def test_missing_malformed_symlink_and_incomplete_runtime_are_refused(self):
        with self.assertRaisesRegex(ValueError, "requires a container runtime record"):
            stopped(self.data, "shipkit-test")
        changes = [{"containerId": "not-id"}, {"containerDataRoot": "/a/../b"}, {"containerDataRoot": "/"},
            {"containerDataRoot": "relative"}, {"pidNamespace": "host"}, {"pidNamespace": False}, {"apiPid": True}]
        for change in changes:
            self.record(**change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                stopped(self.data, "shipkit-test")
        self.record()
        runtime = self.data / "runtime.json"
        outside = self.root / "outside.json"
        runtime.rename(outside)
        runtime.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "symlink"):
            stopped(self.data, "shipkit-test")

    def test_inspect_uses_only_identity_state_mounts_and_failures_are_generic(self):
        result = subprocess.CompletedProcess([], 0, json.dumps(self.inspected()).encode())
        with patch("container_safety.subprocess.run", return_value=result) as run:
            self.assertEqual(inspect_container("shipkit-test"), self.inspected())
            args, options = run.call_args
            self.assertEqual(args[0][-1], "shipkit-test")
            self.assertNotIn("Config", args[0][-2])
            self.assertEqual(options["timeout"], 10)
        for result in (b"invalid", b"[]", b"x" * (1024 * 1024 + 1)):
            with self.subTest(result_length=len(result)), patch("container_safety.subprocess.run", return_value=subprocess.CompletedProcess([], 0, result)):
                with self.assertRaises(ValueError):
                    inspect_container("shipkit-test")
        for failure in (FileNotFoundError("secret"), subprocess.TimeoutExpired("docker", 10), subprocess.CalledProcessError(1, "docker")):
            with patch("container_safety.subprocess.run", side_effect=failure), self.assertRaisesRegex(ValueError, "Cannot verify"):
                inspect_container("shipkit-test")
        with self.assertRaisesRegex(ValueError, "Invalid stopped container selector"):
            inspect_container("--unsafe")


if __name__ == "__main__":
    unittest.main()
