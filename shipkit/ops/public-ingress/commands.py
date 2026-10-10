"""Execute fixed administrative commands with bounded time and controlled errors."""
import subprocess
import re

MISSING_CHAIN = re.compile(rb"iptables(?: v[0-9]+\.[0-9]+(?:\.[0-9]+)?(?: \((?:legacy|nf_tables)\))?)?: No chain/target/match by that name\.\n?")


class Commands:
    def run(self, arguments, allowed=(0,), allow_missing_chain=False):
        if allow_missing_chain and (arguments != ["iptables", "-w", "10", "-S", "SHIPKIT-INGRESS"] or allowed != (0, 1)):
            raise ValueError("Missing-chain classification requires the fixed dedicated query")
        try:
            result = subprocess.run(arguments, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
        except (OSError, subprocess.TimeoutExpired):
            raise ValueError("Ingress administrative command unavailable")
        if result.returncode not in allowed or len(result.stdout) > 16384 or len(result.stderr) > 4096:
            raise ValueError("Ingress administrative command failed")
        if allow_missing_chain and result.returncode == 1 and (result.stdout or not MISSING_CHAIN.fullmatch(result.stderr)):
            raise ValueError("Ingress chain inspection did not confirm absence")
        try:
            output = result.stdout.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("Invalid ingress command output")
        return result.returncode, output
