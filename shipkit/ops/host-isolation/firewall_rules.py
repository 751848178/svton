"""Install or verify only Shipkit-owned iptables chains and scoped jumps."""
import shlex
import subprocess

FORWARD_CHAIN = "SHIPKIT-FORWARD"
INPUT_CHAIN = "SHIPKIT-INPUT"


class Firewall:
    def run(self, *args, check=True):
        return subprocess.run(["iptables", "-w", "10", *args], check=check,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)

    def rules(self, chain):
        result = self.run("-S", chain, check=False)
        if result.returncode:
            return None
        return [shlex.split(line)[2:] for line in result.stdout.splitlines()
                if line.startswith("-A ")]

    def own_chain(self, chain, rules, repair):
        current = self.rules(chain)
        if current is None:
            if not repair:
                raise ValueError(f"Missing {chain}")
            self.run("-N", chain)
            current = []
        if current != rules:
            # Accept a prefix left by an interrupted first installation; never
            # flush/rewrite an unknown or differently configured chain.
            if not repair or current != rules[:len(current)]:
                raise ValueError(f"Unexpected rules in {chain}; administrator review required")
            for rule in rules[len(current):]:
                self.run("-A", chain, *rule)

    def jump(self, chain, rule, repair):
        rules = self.rules(chain)
        if rules is None:
            if chain != "DOCKER-USER" or not repair:
                raise ValueError(f"Missing {chain}")
            self.run("-N", chain)
            self.run("-A", chain, "-j", "RETURN")
            rules = [["-j", "RETURN"]]
        targets = [r for r in rules if r[-2:] == rule[-2:]]
        if targets and targets != [rule]:
            raise ValueError(f"Unexpected Shipkit jump in {chain}")
        if rules[:1] != [rule]:
            if not repair:
                raise ValueError(f"Shipkit guard is not first in {chain}")
            self.run("-I", chain, "1", *rule)
            if targets:
                # Install the new first jump before removing its old copy.
                self.run("-D", chain, str(rules.index(rule) + 2))


def enforce(config, repair=False, require_docker_jump=True, firewall=None):
    fw = firewall or Firewall()
    # Non-established packets include INVALID/UNTRACKED as well as NEW.
    fw.own_chain(FORWARD_CHAIN, [
        ["-i", config.bridge, "-j", "RETURN"],
        ["-m", "conntrack", "--ctstate", "RELATED,ESTABLISHED", "-j", "RETURN"],
        ["-j", "DROP"],
    ], repair)
    fw.own_chain(INPUT_CHAIN, [
        ["-i", config.bridge, "-j", "RETURN"],
        ["-i", "lo", "-j", "RETURN"],
        ["-j", "DROP"],
    ], repair)
    fw.jump("DOCKER-USER", ["-d", config.subnet, "-j", FORWARD_CHAIN], repair)
    fw.jump("INPUT", ["-d", f"{config.gateway}/32", "-p", "tcp", "-m", "tcp",
                      "--dport", str(config.agent_port), "-j", INPUT_CHAIN], repair)
    if require_docker_jump:
        rules = fw.rules("FORWARD") or []
        if rules[:1] != [["-j", "DOCKER-USER"]]:
            raise ValueError("Docker FORWARD must enter DOCKER-USER first; refuses startup")
