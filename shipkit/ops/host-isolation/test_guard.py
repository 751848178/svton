"""Control-plane failure schedules; kernel/network proof is a separate Docker test."""
import copy
import unittest
from firewall_rules import Firewall, enforce, FORWARD_CHAIN, INPUT_CHAIN
from isolation_config import load_config


class MemoryFirewall(Firewall):
    def __init__(self):
        self.chains = {"FORWARD": [["-j", "DOCKER-USER"]], "INPUT": [["-j", "ACCEPT"]],
                       "DOCKER-USER": [["-j", "RETURN"]]}
        self.commands = []
        self.fail_after = None

    def rules(self, chain):
        value = self.chains.get(chain)
        return copy.deepcopy(value) if value is not None else None

    def run(self, *args, check=True):
        if self.fail_after is not None and len(self.commands) == self.fail_after:
            raise RuntimeError("injected iptables failure")
        self.commands.append(list(args))
        action, chain, *rule = args
        if action == "-N":
            self.chains[chain] = []
        elif action == "-A":
            self.chains[chain].append(rule)
        elif action == "-I":
            self.chains[chain].insert(int(rule[0]) - 1, rule[1:])
        elif action == "-D":
            self.chains[chain].pop(int(rule[0]) - 1)
        else:
            raise AssertionError(f"Unexpected mutation: {args}")


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.config = load_config({})
        self.fw = MemoryFirewall()

    def test_install_idempotence_and_other_rules_preserved(self):
        self.fw.chains["DOCKER-USER"].insert(0, ["-s", "192.0.2.1", "-j", "RETURN"])
        original = copy.deepcopy(self.fw.chains)
        enforce(self.config, repair=True, firewall=self.fw)
        enforce(self.config, firewall=self.fw)
        count = len(self.fw.commands)
        enforce(self.config, repair=True, firewall=self.fw)
        self.assertEqual(count, len(self.fw.commands))
        self.assertEqual(original["FORWARD"], self.fw.chains["FORWARD"])
        self.assertEqual(original["INPUT"], self.fw.chains["INPUT"][1:])
        self.assertEqual(original["DOCKER-USER"], self.fw.chains["DOCKER-USER"][1:])

    def test_rejects_earlier_forward_accept_without_reordering_it(self):
        self.fw.chains["FORWARD"].insert(0, ["-j", "ACCEPT"])
        original = copy.deepcopy(self.fw.chains["FORWARD"])
        with self.assertRaisesRegex(ValueError, "enter DOCKER-USER first"):
            enforce(self.config, repair=True, firewall=self.fw)
        self.assertEqual(original, self.fw.chains["FORWARD"])

    def test_partial_initial_install_retries_without_flushing(self):
        self.fw.fail_after = 3
        with self.assertRaisesRegex(RuntimeError, "injected"):
            enforce(self.config, repair=True, firewall=self.fw)
        self.fw.fail_after = None
        enforce(self.config, repair=True, firewall=self.fw)
        enforce(self.config, firewall=self.fw)
        self.assertFalse(any(c[0] in ("-F", "-X", "-P") for c in self.fw.commands))

    def test_foreign_chain_rules_are_rejected(self):
        self.fw.chains[FORWARD_CHAIN] = [["-j", "ACCEPT"]]
        with self.assertRaisesRegex(ValueError, "administrator review"):
            enforce(self.config, repair=True, firewall=self.fw)
        self.assertEqual([], self.fw.commands)

    def test_jump_repair_installs_before_removing_old_copy(self):
        enforce(self.config, repair=True, firewall=self.fw)
        self.fw.chains["DOCKER-USER"].insert(0, ["-j", "RETURN"])
        self.fw.commands.clear()
        enforce(self.config, repair=True, firewall=self.fw)
        self.assertEqual("-I", self.fw.commands[0][0])
        self.assertEqual("-D", self.fw.commands[1][0])
        self.assertEqual(1, sum(r[-1] == FORWARD_CHAIN for r in self.fw.chains["DOCKER-USER"]))

    def test_pre_daemon_mode_needs_no_docker_forward_jump(self):
        self.fw.chains["FORWARD"] = []
        enforce(self.config, repair=True, require_docker_jump=False, firewall=self.fw)
        with self.assertRaisesRegex(ValueError, "enter DOCKER-USER first"):
            enforce(self.config, firewall=self.fw)

    def test_changed_network_configuration_does_not_retarget_live_guard(self):
        enforce(self.config, repair=True, firewall=self.fw)
        before = copy.deepcopy(self.fw.chains)
        changed = load_config({"SHIPKIT_CONTROL_SUBNET": "172.30.242.0/28", "SHIPKIT_CONTROL_GATEWAY": "172.30.242.1"})
        with self.assertRaisesRegex(ValueError, "Unexpected Shipkit jump"):
            enforce(changed, repair=True, firewall=self.fw)
        self.assertEqual(before, self.fw.chains)

    def test_configuration_rejects_broad_or_unsafe_ranges(self):
        for env in ({"SHIPKIT_CONTROL_SUBNET": "10.0.0.0/8"},
                    {"SHIPKIT_CONTROL_SUBNET": "203.0.113.0/28", "SHIPKIT_CONTROL_GATEWAY": "203.0.113.1"},
                    {"SHIPKIT_CONTROL_GATEWAY": "172.30.241.15"},
                    {"SHIPKIT_CONTROL_AGENT_PORT": "7410"},
                    {"SHIPKIT_CONTROL_BRIDGE": "eth0"}):
            with self.subTest(env=env), self.assertRaises(ValueError):
                load_config(env)


if __name__ == "__main__":
    unittest.main()
