import copy
import unittest
from firewall import CHAIN, Firewall
from test_fixture import CONFIG, FakeCommands


class FirewallTests(unittest.TestCase):
    def test_large_unrelated_table_never_requires_full_dump(self):
        class NoGlobalDump(FakeCommands):
            def run(self, arguments, **kwargs):
                if arguments == ["iptables", "-w", "10", "-S"]:
                    raise AssertionError("Unbounded global table inspection")
                return super().run(arguments, **kwargs)
        commands = NoGlobalDump()
        original = [["-s", "192.168.1.1/32", "-j", "ACCEPT"] for _ in range(1000)]
        commands.chains["LARGE-BUSINESS"] = copy.deepcopy(original)
        firewall = Firewall(CONFIG, commands)
        firewall.install()
        firewall.assert_owned()
        firewall.rollback()
        self.assertEqual(commands.chains["LARGE-BUSINESS"], original)

    def test_dedicated_reference_header_rejects_unknown_scope_or_count(self):
        for header in ("", "Chain OTHER (1 references)", "Chain " + CHAIN + " (01 references)",
                       "Chain " + CHAIN + " (2 references)", "Chain " + CHAIN + " (ERROR obtaining refs)"):
            commands = FakeCommands()
            firewall = Firewall(CONFIG, commands)
            firewall.install()
            original = commands.run
            def run(arguments, **kwargs):
                if arguments[3:4] == ["-L"]:
                    return 0, header + "\n"
                return original(arguments, **kwargs)
            commands.run = run
            count = len(commands.mutations())
            for action in (firewall.install, firewall.assert_owned, firewall.rollback):
                with self.assertRaises(ValueError):
                    action()
                self.assertEqual(len(commands.mutations()), count)

    def test_kernel_source_before_interface_emission_stays_exact(self):
        commands = FakeCommands()
        firewall = Firewall(CONFIG, commands)
        self.assertEqual(firewall.expected[0][:4], ["-s", CONFIG.npm_address + "/32", "-i", "docker0"])
        # A rule installed in the old argv order still emits the kernel's
        # canonical order, and strict validation includes all extra selectors.
        commands.chains[CHAIN] = [["-i", "docker0", "-s", CONFIG.npm_address + "/32"] + firewall.expected[0][4:]]
        self.assertEqual(firewall.rules(CHAIN), firewall.expected[:1])
        for chain in (CHAIN, None):
            args = ["iptables", "-w", "10", "-S"] + ([chain] if chain else [])
            output = commands.run(args)[1]
            self.assertIn("-s " + CONFIG.npm_address + "/32 -i docker0", output)
            self.assertNotIn("-i docker0 -s ", output)
        commands.chains[CHAIN][0].extend(["-m", "conntrack", "--ctstate", "NEW"])
        with self.assertRaises(ValueError):
            firewall.install()
        self.assertEqual(commands.mutations(), [])

    def test_scoped_first_jump_preserves_existing_business_and_exact_rollback(self):
        commands = FakeCommands()
        original = copy.deepcopy(commands.chains["INPUT"])
        firewall = Firewall(CONFIG, commands)
        firewall.install()
        self.assertEqual(commands.chains["INPUT"], [firewall.jump] + original)
        self.assertEqual(commands.chains[CHAIN], firewall.expected)
        self.assertIn(CONFIG.npm_address + "/32", firewall.expected[0])
        self.assertIn(CONFIG.npm_gateway + "/32", firewall.jump)
        self.assertIn("docker0", firewall.expected[0])
        self.assertEqual(firewall.expected[-1][-2:], ["-j", "DROP"])
        count = len(commands.mutations())
        firewall.install()
        firewall.assert_owned()
        self.assertEqual(len(commands.mutations()), count)
        firewall.rollback()
        self.assertEqual(commands.chains, {"INPUT": original})
        self.assertTrue(all("-F" not in call and "DOCKER-USER" not in call for call in commands.calls))

    def test_interrupted_approved_prefix_repairs_but_foreign_rules_do_not(self):
        commands = FakeCommands()
        firewall = Firewall(CONFIG, commands)
        commands.chains[CHAIN] = firewall.expected[:1]
        firewall.install()
        self.assertEqual(commands.chains[CHAIN], firewall.expected)
        for rules in ([["-j", "ACCEPT"]], firewall.expected + [["-j", "RETURN"]], [firewall.expected[1]]):
            commands = FakeCommands()
            commands.chains[CHAIN] = copy.deepcopy(rules)
            with self.assertRaises(ValueError):
                Firewall(CONFIG, commands).install()
            self.assertEqual(commands.mutations(), [])

    def test_wrong_scope_duplicate_and_nonfirst_jump_refuse_without_writes(self):
        for kind in ("wrong", "duplicate", "nonfirst"):
            commands = FakeCommands()
            firewall = Firewall(CONFIG, commands)
            commands.chains[CHAIN] = copy.deepcopy(firewall.expected)
            jump = copy.deepcopy(firewall.jump)
            if kind == "wrong":
                jump[1] = "10.50.0.1/32"
                commands.chains["INPUT"].insert(0, jump)
            elif kind == "duplicate":
                commands.chains["INPUT"] = [jump, jump]
            else:
                commands.chains["INPUT"].append(jump)
            with self.assertRaises(ValueError):
                firewall.install()
            self.assertEqual(commands.mutations(), [])
            with self.assertRaises(ValueError):
                firewall.assert_owned()

    def test_rollback_never_deletes_foreign_rules(self):
        commands = FakeCommands()
        firewall = Firewall(CONFIG, commands)
        firewall.install()
        commands.chains[CHAIN].append(["-j", "RETURN"])
        count = len(commands.mutations())
        with self.assertRaises(ValueError):
            firewall.rollback()
        self.assertEqual(len(commands.mutations()), count)

    def test_inspection_failures_are_not_chain_absence(self):
        commands = FakeCommands()
        commands.fail_action = "-S"
        with self.assertRaises(ValueError):
            Firewall(CONFIG, commands).install()
        self.assertEqual(commands.mutations(), [])

    def test_foreign_chain_reference_and_goto_refuse_before_mutations(self):
        for target in ("-j", "-g"):
            commands = FakeCommands()
            firewall = Firewall(CONFIG, commands)
            firewall.install()
            commands.chains["FOREIGN"] = [[target, CHAIN]]
            count = len(commands.mutations())
            for action in (firewall.install, firewall.assert_owned, firewall.rollback):
                with self.assertRaises(ValueError):
                    action()
                self.assertEqual(len(commands.mutations()), count)


if __name__ == "__main__":
    unittest.main()
