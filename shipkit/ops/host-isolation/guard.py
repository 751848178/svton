#!/usr/bin/env python3
"""Apply/verify the guard; pre-daemon mode never requires Docker to be running."""
import sys
from firewall_rules import enforce
from isolation_config import load_config
from maintenance_lock import maintenance_lock
from network import ensure_network
from network_receipt import read_receipt


def main():
    if sys.argv[1:] not in (["apply"], ["apply", "--pre-daemon"], ["verify"]):
        raise ValueError("Usage: guard.py apply [--pre-daemon] | verify")
    with maintenance_lock():
        config = load_config()
        if "--pre-daemon" in sys.argv:
            read_receipt(config)
        else:
            ensure_network(config)
        enforce(config, repair=sys.argv[1] == "apply",
                require_docker_jump="--pre-daemon" not in sys.argv)
    print("Shipkit network guard ready")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Shipkit guard refused: {error}", file=sys.stderr)
        sys.exit(1)
