"""Pure checks for QA graph boundaries; no systemd, Docker or firewall commands."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "synthetic_qa", str(Path(__file__).parent / "acceptance/systemd-synthetic-qa.py"))
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)


class SyntheticQaTests(unittest.TestCase):
    def test_all_real_dependencies_become_random_private_dependencies(self):
        names = {kind: "shipkit-isolation-qa-test-" + kind + ".service"
                 for kind in (*qa.BASE, "control")}
        for kind in qa.BASE:
            text = qa.synthetic_unit(kind, names, Path("/run/test-gate"), Path("/run/test-marker"))
            self.assertNotIn("docker.service", text)
            self.assertNotIn("/usr/bin/python3", text)
            for line in text.splitlines():
                if line.startswith(("Requires=", "After=", "Wants=", "PartOf=", "Before=")):
                    self.assertTrue(set(line.split("=", 1)[1].split()) <= set(names.values()))

    def test_foreign_dependency_is_rejected_before_any_command(self):
        names = {kind: kind + ".service" for kind in (*qa.BASE, "control")}
        with patch.object(Path, "read_text", return_value="Requires=foreign.service\n"), \
                patch.object(qa, "command") as command:
            with self.assertRaisesRegex(ValueError, "Unreviewed dependency"):
                qa.synthetic_unit("server", names, Path("/run/gate"), Path("/run/marker"))
            command.assert_not_called()

    def test_colliding_file_is_never_a_cleanup_target(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(qa, "UNITS", Path(directory)), \
                patch.object(qa, "command") as command:
            file = Path(directory) / "existing.service"
            file.write_text("foreign unit")
            owned = qa.OwnedUnits()
            with self.assertRaises(FileExistsError):
                owned.create(file.name, "owned unit")
            owned.cleanup()
            command.assert_not_called()
            self.assertEqual("foreign unit", file.read_text())

    def test_replaced_file_is_never_stopped_reset_or_unlinked(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(qa, "UNITS", Path(directory)), \
                patch.object(qa, "command") as command:
            file = Path(directory) / "owned.service"
            owned = qa.OwnedUnits()
            owned.create(file.name, "owned unit")
            replacement = Path(directory) / "replacement"
            replacement.write_text("foreign replacement")
            os.replace(str(replacement), str(file))
            with self.assertRaisesRegex(ValueError, "replaced/missing"):
                owned.cleanup()
            command.assert_not_called()
            self.assertEqual("foreign replacement", file.read_text())

    def test_cleanup_targets_only_files_created_by_this_run(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(qa, "UNITS", Path(directory)), \
                patch.object(qa, "command", return_value=SimpleNamespace(returncode=0)) as command:
            foreign = Path(directory) / "foreign.service"
            foreign.write_text("foreign unit")
            owned = qa.OwnedUnits()
            owned.create("private.service", "owned unit")
            owned.cleanup()
            self.assertEqual([("systemctl", "stop", "private.service"),
                              ("systemctl", "reset-failed", "private.service"),
                              ("systemctl", "daemon-reload")],
                             [call[0] for call in command.call_args_list])
            self.assertTrue(foreign.exists())
            self.assertFalse((Path(directory) / "private.service").exists())

    def test_loaded_file_but_garbage_collected_unit_does_not_break_reset_or_cleanup(self):
        name = "shipkit-isolation-qa-test-agent.service"
        def unloaded(*args, **kwargs):
            if args[1] in ("stop", "reset-failed") and args[2] == name:
                prefix = "Failed to reset failed state of unit " if args[1] == "reset-failed" else "Failed to stop "
                return SimpleNamespace(returncode=1, stdout="", stderr=prefix + name + ": Unit " + name + " not loaded.\n")
            return SimpleNamespace(returncode=0, stdout="LoadState=loaded\n", stderr="")
        with tempfile.TemporaryDirectory() as directory, patch.object(qa, "UNITS", Path(directory)), \
                patch.object(qa, "command", side_effect=unloaded) as command:
            owned = qa.OwnedUnits()
            owned.create(name, "owned Agent unit")
            owned.create("shipkit-isolation-qa-test-guard.service", "owned guard unit")
            owned.reset_failed()
            owned.cleanup()
            self.assertFalse((Path(directory) / name).exists())
            self.assertEqual(1, sum(call[0] == ("systemctl", "daemon-reload") for call in command.call_args_list))
            self.assertFalse(any(call[0][1] == "show" for call in command.call_args_list))

    def test_only_confirmed_not_found_is_ignored_for_another_action_failure(self):
        result = SimpleNamespace(returncode=1, stderr="Unit no longer exists", stdout="")
        state = SimpleNamespace(returncode=0, stderr="", stdout="LoadState=not-found\n")
        with patch.object(qa, "command", side_effect=[result, state]):
            qa.inactive_unit_action("reset-failed", "shipkit-isolation-qa-test-agent.service")

    def test_unexpected_reset_failure_still_unlinks_owned_files_and_reload_then_reports(self):
        def denied(*args, **kwargs):
            if args[1] == "reset-failed":
                return SimpleNamespace(returncode=1, stdout="", stderr="Access denied")
            return SimpleNamespace(returncode=0, stdout="LoadState=loaded\n", stderr="")
        with tempfile.TemporaryDirectory() as directory, patch.object(qa, "UNITS", Path(directory)), \
                patch.object(qa, "command", side_effect=denied) as command:
            file = Path(directory) / "shipkit-isolation-qa-test-server.service"
            foreign = Path(directory) / "foreign.service"
            foreign.write_text("foreign unit")
            owned = qa.OwnedUnits()
            owned.create(file.name, "owned Server unit")
            with self.assertRaisesRegex(ValueError, "Access denied"):
                owned.cleanup()
            self.assertFalse(file.exists())
            self.assertTrue(foreign.exists())
            self.assertEqual(("systemctl", "daemon-reload"), command.call_args_list[-1][0])

    def test_not_loaded_error_for_a_different_unit_is_not_ignored(self):
        result = SimpleNamespace(returncode=1, stdout="", stderr="Failed to reset failed state of unit foreign.service: Unit foreign.service not loaded.")
        state = SimpleNamespace(returncode=0, stderr="", stdout="LoadState=loaded\n")
        with patch.object(qa, "command", side_effect=[result, state]), self.assertRaises(RuntimeError):
            qa.inactive_unit_action("reset-failed", "shipkit-isolation-qa-test-agent.service")

    def test_opt_in_and_root_are_required_before_any_system_command(self):
        for argv, uid in ((["qa.py"], 0), (["qa.py", "--run"], 1000)):
            with patch.object(qa.sys, "argv", argv), patch.object(qa.os, "geteuid", return_value=uid), \
                    patch.object(qa, "command") as command:
                with self.assertRaises(ValueError):
                    qa.main()
                command.assert_not_called()


if __name__ == "__main__":
    unittest.main()
