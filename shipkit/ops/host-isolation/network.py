#!/usr/bin/env python3
"""Create or verify the dedicated external bridge without changing other networks."""
import ipaddress
import json
import subprocess
import sys
from isolation_config import load_config
from maintenance_lock import maintenance_lock
from network_receipt import read_receipt, freeze_receipt


def run(*args):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, universal_newlines=True).stdout


def inspect_network(config):
    raw = run("docker", "network", "inspect", config.network)
    network = json.loads(raw)[0]
    pools = network.get("IPAM", {}).get("Config", [])
    if (network.get("Driver") != "bridge" or network.get("EnableIPv6") or network.get("Internal")
            or network.get("Labels", {}).get("io.shipkit.host-isolation") != "control"
            or network.get("Options", {}).get("com.docker.network.bridge.name") != config.bridge
            or pools != [{"Subnet": config.subnet, "Gateway": config.gateway}]):
        raise ValueError("Existing control network differs from frozen configuration")
    return network


def reject_conflicts(config):
    desired = ipaddress.IPv4Network(config.subnet)
    names = run("docker", "network", "ls", "--format", "{{.Name}}").splitlines()
    if names:
        for network in json.loads(run("docker", "network", "inspect", *names)):
            for pool in network.get("IPAM", {}).get("Config", []):
                subnet = pool.get("Subnet")
                if subnet and ":" not in subnet and desired.overlaps(ipaddress.IPv4Network(subnet)):
                    raise ValueError("Control subnet overlaps an existing Docker network")
    for route in json.loads(run("ip", "-j", "-4", "route", "show")):
        destination = route.get("dst", "default")
        if destination != "default" and desired.overlaps(ipaddress.IPv4Network(destination)):
            raise ValueError("Control subnet overlaps an existing host route")
    if run("ip", "-o", "link", "show").find(f" {config.bridge}:") >= 0:
        raise ValueError("Control bridge interface name already exists")


def ensure_network(config, create=False):
    receipt = read_receipt(config, required=not create)
    exists = config.network in run("docker", "network", "ls", "--format", "{{.Name}}").splitlines()
    if exists:
        network = inspect_network(config)
        if receipt and receipt["networkId"] != network.get("Id"):
            raise ValueError("Docker control network ID differs from frozen installation")
        if not receipt:
            freeze_receipt(config, network["Id"])
        return network
    if receipt:
        raise ValueError("Frozen control network is missing; administrator repair required")
    if not create:
        raise ValueError("Dedicated external control network is missing")
    reject_conflicts(config)
    run("docker", "network", "create", "--driver", "bridge", "--subnet", config.subnet,
        "--gateway", config.gateway, "--opt", f"com.docker.network.bridge.name={config.bridge}",
        "--label", "io.shipkit.host-isolation=control", config.network)
    network = inspect_network(config)
    freeze_receipt(config, network["Id"])
    return network


if __name__ == "__main__":
    try:
        if sys.argv[1:] not in (["ensure"], ["verify"]):
            raise ValueError("Usage: network.py ensure | verify")
        with maintenance_lock():
            ensure_network(load_config(), create=sys.argv[1] == "ensure")
        print("Shipkit external control network ready")
    except Exception as error:
        print(f"Shipkit network refused: {error}", file=sys.stderr)
        sys.exit(1)
