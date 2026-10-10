#!/usr/bin/env python3
"""Start the existing Shipkit container only after guard and policy verification."""
import json
import subprocess
import sys
from firewall_rules import enforce
from isolation_config import load_config
from maintenance_lock import maintenance_lock
from network import ensure_network

CONTAINER = "ship_shipkit_server-server-1"
INSPECT = '{"restart":{{json .HostConfig.RestartPolicy}},"ports":{{json .HostConfig.PortBindings}},"networks":{{json .NetworkSettings.Networks}}}'


def inspect_policy(config):
    result = subprocess.run(["docker", "inspect", "--format", INSPECT, CONTAINER], check=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    value = json.loads(result.stdout)
    if value["restart"] != {"Name": "on-failure", "MaximumRetryCount": 3}:
        raise ValueError("Server must use on-failure:3; daemon autostart is forbidden")
    if value["ports"] != {"8769/tcp": [{"HostIp": "127.0.0.1", "HostPort": "28769"}]}:
        raise ValueError("Server must publish only 127.0.0.1:28769 → 8769/tcp")
    if set(value["networks"]) != {config.network}:
        raise ValueError("Server must join only the dedicated control network")


def main():
    if sys.argv[1:] not in (["start"], ["verify"]):
        raise ValueError("Usage: server.py start | verify")
    config = load_config()
    with maintenance_lock():
        ensure_network(config)
        enforce(config, repair=True)
        inspect_policy(config)
        if sys.argv[1] == "start":
            subprocess.run(["docker", "start", CONTAINER], check=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Shipkit Server startup refused: {error}", file=sys.stderr)
        sys.exit(1)
