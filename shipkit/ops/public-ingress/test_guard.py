import unittest
from unittest.mock import patch
from firewall import CHAIN, Firewall
from guard import perform
from test_fixture import CONFIG, FakeCommands


class GuardTests(unittest.TestCase):
    def test_owned_empty_chain_resumes_without_replacing_the_receipt(self):
        commands = FakeCommands()
        commands.chains[CHAIN] = []
        with patch("guard.check_owner", return_value=True), patch("guard.create_owner") as create:
            perform("enforce", CONFIG, commands)
            create.assert_not_called()
        Firewall(CONFIG, commands).assert_owned()

    def test_preflight_identity_failure_has_zero_mutations_or_receipt(self):
        commands = FakeCommands()
        commands.npm["id"] = "d" * 64
        with patch("guard.check_owner", return_value=False), patch("guard.create_owner") as create:
            with self.assertRaises(ValueError):
                perform("enforce", CONFIG, commands)
            create.assert_not_called()
        self.assertEqual(commands.mutations(), [])

    def test_first_install_requires_absent_namespace_then_exact_receipt(self):
        commands = FakeCommands()
        with patch("guard.check_owner", return_value=False), patch("guard.create_owner") as create:
            perform("enforce", CONFIG, commands)
            create.assert_called_once_with(CONFIG)
        with patch("guard.check_owner", return_value=True):
            perform("verify", CONFIG, commands)
        commands = FakeCommands()
        commands.chains[CHAIN] = []
        with patch("guard.check_owner", return_value=False), patch("guard.create_owner") as create:
            with self.assertRaises(ValueError):
                perform("enforce", CONFIG, commands)
            create.assert_not_called()
        self.assertEqual(commands.mutations(), [])

    def test_missing_or_changed_owner_blocks_verify(self):
        commands = FakeCommands()
        with patch("guard.check_owner", return_value=False):
            with self.assertRaises(ValueError):
                perform("verify", CONFIG, commands)
        with patch("guard.check_owner", side_effect=ValueError("Owner changed")):
            with self.assertRaises(ValueError):
                perform("enforce", CONFIG, commands)
        self.assertEqual(commands.mutations(), [])

    def test_rollback_requires_listener_stopped_and_removes_only_own_rules(self):
        commands = FakeCommands()
        firewall = Firewall(CONFIG, commands)
        firewall.install()
        count = len(commands.mutations())
        commands.listen = "LISTEN 0 128 10.40.0.1:28770 0.0.0.0:*"
        with patch("guard.check_owner", return_value=True), patch("guard.os.unlink") as unlink:
            with self.assertRaises(ValueError):
                perform("rollback", CONFIG, commands)
            unlink.assert_not_called()
        self.assertEqual(len(commands.mutations()), count)
        commands.listen = ""
        with patch("guard.check_owner", return_value=True), patch("guard.os.unlink") as unlink:
            perform("rollback", CONFIG, commands)
            unlink.assert_called_once()
        self.assertEqual(commands.chains, {"INPUT": [["-j", "EXISTING-BUSINESS"]]})

    def test_unowned_rollback_and_unknown_action_refuse_without_mutation(self):
        commands = FakeCommands()
        commands.chains[CHAIN] = []
        with patch("guard.check_owner", return_value=False):
            with self.assertRaises(ValueError):
                perform("rollback", CONFIG, commands)
        self.assertEqual(commands.mutations(), [])


if __name__ == "__main__":
    unittest.main()
