"""Fail before firewall changes when network ownership or filesystem trust is absent."""
import stat
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import agent
import guard
import network
import server
from agent_installation import trusted_file, trusted_work_root
from isolation_config import load_config


@contextmanager
def no_lock():
    yield


class PreconditionTests(unittest.TestCase):
    def setUp(self):
        self.config = load_config({})

    def test_network_failure_leaves_firewall_untouched_at_every_entry(self):
        for module, args in ((server, ["server.py", "start"]), (guard, ["guard.py", "apply"]),
                             (agent, ["agent.py"])):
            for error in ("missing", "overlaps TWGG", "ID differs", "config differs"):
                with self.subTest(module=module.__name__, error=error), \
                        patch.object(sys, "argv", args), patch.object(module, "maintenance_lock", no_lock), \
                        patch.object(module, "load_config", return_value=self.config), \
                        patch.object(module, "ensure_network", side_effect=ValueError(error)), \
                        patch.object(module, "enforce") as enforce:
                    with patch.dict("os.environ", {"SHIP_AGENT_TOKEN": "synthetic", "SHIP_AGENT_ROLE": "runtime"}), \
                            patch("agent.trusted_installation"), patch("agent.trusted_work_root"):
                        with self.assertRaises(ValueError):
                            module.main()
                    enforce.assert_not_called()

    def test_pre_daemon_missing_or_changed_receipt_is_not_applied(self):
        for error in ("missing receipt", "configuration differs"):
            with self.subTest(error=error), patch.object(sys, "argv", ["guard.py", "apply", "--pre-daemon"]), \
                    patch("guard.maintenance_lock", no_lock), patch("guard.read_receipt", side_effect=ValueError(error)), \
                    patch("guard.enforce") as enforce:
                with self.assertRaises(ValueError):
                    guard.main()
                enforce.assert_not_called()

    def test_missing_receipt_does_not_even_query_or_create_network(self):
        with patch("network.read_receipt", side_effect=ValueError("missing receipt")), patch("network.run") as run:
            with self.assertRaises(ValueError):
                network.ensure_network(self.config)
            run.assert_not_called()

    def test_network_id_change_cannot_rewrite_receipt(self):
        with patch("network.read_receipt", return_value={"networkId": "old"}), \
                patch("network.run", return_value=self.config.network + "\n"), \
                patch("network.inspect_network", return_value={"Id": "new"}), patch("network.freeze_receipt") as freeze:
            with self.assertRaisesRegex(ValueError, "ID differs"):
                network.ensure_network(self.config)
            freeze.assert_not_called()

    def test_namespace_rejects_other_agents_and_parent_traversal(self):
        for path in ("/opt/shipkit/dist/server.js", "/root/.nvm/node", "/opt/shipkit-agent/releases/old/../new/node"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                trusted_file(path)

    def test_parent_symlink_nonroot_or_writable_path_is_rejected(self):
        candidate = Path("/opt/shipkit-agent/releases/abc/dist/server.js")
        for bad in (stat.S_IFLNK | 0o777, stat.S_IFDIR | 0o775, stat.S_IFDIR | 0o755):
            def fake_stat(path):
                mode = stat.S_IFREG | 0o644 if path == candidate else stat.S_IFDIR | 0o755
                uid = 0
                if str(path) == "/opt/shipkit-agent":
                    mode, uid = bad, 1 if bad == stat.S_IFDIR | 0o755 else 0
                return SimpleNamespace(st_uid=uid, st_mode=mode)
            with self.subTest(mode=bad), patch.object(Path, "lstat", fake_stat), self.assertRaises(ValueError):
                trusted_file(str(candidate))

    def test_work_root_symlink_is_rejected(self):
        def fake_stat(path):
            mode = stat.S_IFLNK | 0o777 if str(path) == "/srv/shipkit-agent" else stat.S_IFDIR | 0o755
            return SimpleNamespace(st_uid=0, st_mode=mode)
        with patch.object(Path, "lstat", fake_stat), self.assertRaises(ValueError):
            trusted_work_root("/srv/shipkit-agent")


if __name__ == "__main__":
    unittest.main()
