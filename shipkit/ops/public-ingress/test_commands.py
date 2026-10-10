import subprocess
import unittest
from unittest.mock import patch
from commands import Commands

QUERY = ["iptables", "-w", "10", "-S", "SHIPKIT-INGRESS"]


class CommandTests(unittest.TestCase):
    def inspect(self, code, stdout=b"", stderr=b""):
        result = subprocess.CompletedProcess(QUERY, code, stdout, stderr)
        with patch("commands.subprocess.run", return_value=result):
            return Commands().run(QUERY, allowed=(0, 1), allow_missing_chain=True)

    def test_only_exact_missing_chain_message_and_code_confirm_absence(self):
        for message in (b"iptables: No chain/target/match by that name.\n",
                        b"iptables v1.8.5 (legacy): No chain/target/match by that name.\n"):
            self.assertEqual(self.inspect(1, stderr=message), (1, ""))
        for code, out, err in ((1, b"", b"Permission denied\n"), (1, b"", b""),
                              (1, b"", b"iptables: No chain/target/match by that name.\nPermission denied\n"),
                              (2, b"", b"iptables: No chain/target/match by that name.\n"),
                              (1, b"untrusted output", b"iptables: No chain/target/match by that name.\n")):
            with self.assertRaises(ValueError):
                self.inspect(code, out, err)

    def test_budget_is_unchanged_and_absence_flag_cannot_apply_to_other_queries(self):
        for out, err in ((b"x" * 16385, b""), (b"", b"x" * 4097)):
            with self.assertRaises(ValueError):
                self.inspect(0, out, err)
        with patch("commands.subprocess.run") as run:
            for args in (["iptables", "-w", "10", "-S"], ["iptables", "-w", "10", "-S", "INPUT"]):
                with self.assertRaises(ValueError):
                    Commands().run(args, allowed=(0, 1), allow_missing_chain=True)
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
