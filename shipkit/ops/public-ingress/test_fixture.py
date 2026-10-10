"""In-memory command schedules: no Docker, iptables, sockets or host services."""
import copy
import json
import shlex
from ingress_config import Config
from container_boundary import NPM_FORMAT, SERVER_FORMAT
from firewall import CHAIN

CONFIG = Config("a" * 64, "b" * 64, "10.40.0.2", "10.40.0.1")


def emitted_rule(rule):
    # iptables -S writes the IPv4 source selector before the input interface,
    # regardless of the order supplied to -A. Preserve every other selector.
    value = list(rule)
    if "-s" in value and "-i" in value:
        source, interface = value.index("-s"), value.index("-i")
        if source > interface:
            selector = value[source:source + 2]
            del value[source:source + 2]
            value[interface:interface] = selector
    return " ".join(shlex.quote(part) for part in value)


class FakeCommands:
    def __init__(self):
        self.calls = []
        self.chains = {"INPUT": [["-j", "EXISTING-BUSINESS"]]}
        self.listen = ""
        self.fail_action = None
        self.npm = {"id": CONFIG.npm_id, "running": True, "paused": False, "restarting": False,
                    "networks": {"bridge": {"NetworkID": CONFIG.network_id, "IPAddress": CONFIG.npm_address,
                                            "Gateway": CONFIG.npm_gateway, "IPPrefixLen": 16}}}
        self.bridge = {"id": CONFIG.network_id, "driver": "bridge", "pools": [{"Subnet": "10.40.0.0/16", "Gateway": CONFIG.npm_gateway}],
                       "options": {"com.docker.network.bridge.name": "docker0", "com.docker.network.bridge.default_bridge": "true"}}
        self.server = {"id": "c" * 64, "running": True, "paused": False, "restarting": False, "health": "healthy",
                       "networks": {"shipkit-control": {}}, "ports": {"8769/tcp": [{"HostIp": "127.0.0.1", "HostPort": "28769"}]},
                       "project": "ship_shipkit_server", "service": "server"}

    def mutations(self):
        return [c for c in self.calls if c[0] == "iptables" and c[3] in ("-N", "-A", "-I", "-D", "-X")]

    def run(self, arguments, allowed=(0,), allow_missing_chain=False):
        self.calls.append(copy.deepcopy(arguments))
        if arguments[0] == "docker":
            value = self.bridge if arguments[1] == "network" else self.npm if NPM_FORMAT in arguments else self.server
            return 0, json.dumps(value)
        if arguments[0] == "ss":
            return 0, self.listen
        assert arguments[:3] == ["iptables", "-w", "10"]
        operation = arguments[3:]
        action = operation[0]
        if action == self.fail_action:
            raise ValueError("Mock administrative failure")
        if action == "-L":
            assert operation == ["-L", CHAIN, "-n"] and CHAIN in self.chains
            count = sum(1 for rules in self.chains.values() for rule in rules
                        for a, b in zip(rule, rule[1:]) if a in ("-j", "-g") and b == CHAIN)
            return 0, "Chain " + CHAIN + " (" + str(count) + " references)\ntarget prot opt source destination\n"
        if action == "-S":
            if len(operation) == 1:
                rows = ["-P INPUT ACCEPT"] + ["-N " + n for n in self.chains if n != "INPUT"]
                rows.extend("-A " + n + " " + emitted_rule(rule)
                            for n, rules in self.chains.items() for rule in rules)
                return 0, "\n".join(rows)
            chain = operation[1]
            if chain not in self.chains:
                assert 1 in allowed and allow_missing_chain and chain == CHAIN
                return 1, ""
            prefix = "-P INPUT ACCEPT" if chain == "INPUT" else "-N " + chain
            rows = ["-A " + chain + " " + emitted_rule(r) for r in self.chains[chain]]
            return 0, prefix + "\n" + "\n".join(rows)
        chain = operation[1]
        if action == "-N":
            assert chain not in self.chains
            self.chains[chain] = []
        elif action == "-A":
            self.chains[chain].append(operation[2:])
        elif action == "-I":
            self.chains[chain].insert(int(operation[2]) - 1, operation[3:])
        elif action == "-D":
            self.chains[chain].remove(operation[2:])
        elif action == "-X":
            assert not self.chains[chain]
            del self.chains[chain]
        else:
            raise AssertionError("Unexpected command")
        return 0, ""
