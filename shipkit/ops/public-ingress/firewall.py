"""Manage only the marked INPUT admission chain for this relay endpoint."""
import shlex
import re
from commands import Commands
from ingress_config import LISTEN_PORT

CHAIN = "SHIPKIT-INGRESS"
MARK = "shipkit-public-ingress:v1"
COMMENT = ["-m", "comment", "--comment", MARK]


class Firewall:
    def __init__(self, config, commands=None):
        self.config = config
        self.commands = commands or Commands()
        self.expected = [["-s", config.npm_address + "/32", "-i", "docker0"] + COMMENT + ["-j", "ACCEPT"],
                         COMMENT + ["-j", "DROP"]]
        self.jump = ["-d", config.npm_gateway + "/32", "-p", "tcp", "-m", "tcp", "--dport", str(LISTEN_PORT)] + COMMENT + ["-j", CHAIN]

    def run(self, *arguments, **kwargs):
        return self.commands.run(["iptables", "-w", "10"] + list(arguments), **kwargs)

    def rules(self, chain):
        code, output = self.run("-S", chain, allowed=(0, 1), allow_missing_chain=chain == CHAIN)
        if code:
            if chain == CHAIN:
                # Commands accepts only the bounded, exact missing-chain stderr.
                return None
            raise ValueError("Ingress firewall inspection failed")
        result = []
        for line in output.splitlines():
            parsed = shlex.split(line)
            if parsed[:2] == ["-A", chain]:
                result.append(parsed[2:])
            elif parsed[:2] not in (["-N", chain], ["-P", chain]):
                raise ValueError("Unexpected firewall inspection output")
        return result

    def scoped_jumps(self, rules):
        return [rule for rule in rules if any(a in ("-j", "-g") and b == CHAIN for a, b in zip(rule, rule[1:]))]

    def assert_references(self, present):
        # The kernel's dedicated-chain header counts references from every
        # chain (including goto); INPUT is separately checked for the sole jump.
        _, output = self.run("-L", CHAIN, "-n")
        lines = output.splitlines()
        match = re.fullmatch(r"Chain " + re.escape(CHAIN) + r" \((0|[1-9][0-9]{0,9}) references\)", lines[0]) if lines else None
        if not match or int(match.group(1)) != int(present):
            raise ValueError("Unexpected references to the dedicated ingress chain")

    def assert_owned(self, partial=False):
        rules = self.rules(CHAIN)
        valid = rules is not None and (rules == self.expected or (partial and rules == self.expected[:len(rules)]))
        if not valid:
            raise ValueError("Unexpected ingress chain; refuses to rewrite it")
        input_rules = self.rules("INPUT")
        jumps = self.scoped_jumps(input_rules)
        if jumps != [self.jump] or input_rules[:1] != [self.jump]:
            raise ValueError("Ingress INPUT admission must be the sole first scoped jump")
        self.assert_references(True)

    def install(self):
        rules = self.rules(CHAIN)
        if rules is None:
            self.run("-N", CHAIN)
            rules = []
        if rules != self.expected[:len(rules)]:
            raise ValueError("Unexpected ingress chain; refuses to flush it")
        input_rules = self.rules("INPUT")
        jumps = self.scoped_jumps(input_rules)
        if jumps and (jumps != [self.jump] or input_rules[:1] != [self.jump]):
            raise ValueError("Unexpected ingress jump; administrator review required")
        self.assert_references(bool(jumps))
        for rule in self.expected[len(rules):]:
            self.run("-A", CHAIN, *rule)
        if not jumps:
            self.run("-I", "INPUT", "1", *self.jump)
        self.assert_owned()

    def rollback(self):
        rules = self.rules(CHAIN)
        input_rules = self.rules("INPUT")
        jumps = self.scoped_jumps(input_rules)
        if rules is None and not jumps:
            return
        if rules is None or rules != self.expected[:len(rules)] or (jumps and jumps != [self.jump]):
            raise ValueError("Foreign ingress artifacts; rollback refused")
        self.assert_references(bool(jumps))
        if jumps:
            self.run("-D", "INPUT", *self.jump)
        for rule in reversed(rules):
            self.run("-D", CHAIN, *rule)
        self.run("-X", CHAIN)
        if self.rules(CHAIN) is not None or self.scoped_jumps(self.rules("INPUT")):
            raise ValueError("Ingress firewall rollback incomplete")
