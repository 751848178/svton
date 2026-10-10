"""Pure checks for QA graph boundaries; no systemd, Docker or firewall commands."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
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
                patch.object(qa, "command") as command:
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

    def test_opt_in_and_root_are_required_before_any_system_command(self):
        for argv, uid in ((["qa.py"], 0), (["qa.py", "--run"], 1000)):
            with patch.object(qa.sys, "argv", argv), patch.object(qa.os, "geteuid", return_value=uid), \
                    patch.object(qa, "command") as command:
                with self.assertRaises(ValueError):
                    qa.main()
                command.assert_not_called()


if __name__ == "__main__":
    unittest.main()
