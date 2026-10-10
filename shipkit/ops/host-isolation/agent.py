#!/usr/bin/env python3
"""Launch the independently installed Agent with the frozen private listener."""
import os
import sys
from firewall_rules import enforce
from isolation_config import load_config
from maintenance_lock import maintenance_lock
from network import ensure_network
from agent_installation import trusted_installation, trusted_work_root


def main():
    config = load_config()
    node = os.environ.get("SHIPKIT_AGENT_NODE", "")
    entry = os.environ.get("SHIPKIT_AGENT_ENTRY", "")
    trusted_installation(node, entry)
    if not os.environ.get("SHIP_AGENT_TOKEN") or os.environ.get("SHIP_AGENT_ROLE") != "runtime":
        raise ValueError("Dedicated Agent requires its own runtime credential")
    trusted_work_root(os.environ.get("SHIP_WORK_ROOT"))
    with maintenance_lock():
        ensure_network(config)
        enforce(config, repair=True)
    env = {**os.environ, "HOME": "/srv/shipkit-agent", "SHIP_AGENT_HOST": config.gateway,
           "SHIP_AGENT_PORT": str(config.agent_port)}
    os.execve(node, [node, entry], env)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Shipkit Agent startup refused: {error}", file=sys.stderr)
        sys.exit(1)
