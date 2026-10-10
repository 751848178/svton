"""Validate the small nonsecret configuration shared by host isolation tools."""
import ipaddress
import os
import re
from typing import NamedTuple


class IsolationConfig(NamedTuple):
    network: str
    bridge: str
    subnet: str
    gateway: str
    agent_port: int


def load_config(env=None):
    env = os.environ if env is None else env
    network = env.get("SHIPKIT_CONTROL_NETWORK", "shipkit-control")
    bridge = env.get("SHIPKIT_CONTROL_BRIDGE", "br-shipkit")
    subnet = ipaddress.IPv4Network(env.get("SHIPKIT_CONTROL_SUBNET", "172.30.241.0/28"), strict=True)
    gateway = ipaddress.IPv4Address(env.get("SHIPKIT_CONTROL_GATEWAY", "172.30.241.1"))
    port = int(env.get("SHIPKIT_CONTROL_AGENT_PORT", "17412"))
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,62}", network):
        raise ValueError("Invalid private Docker network name")
    if not re.fullmatch(r"br-[a-z0-9-]{1,12}", bridge):
        raise ValueError("Bridge must start br- and be at most 15 characters")
    private_ranges = [ipaddress.IPv4Network(c) for c in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")]
    contained = any(subnet.network_address in c and subnet.broadcast_address in c for c in private_ranges)
    if not 24 <= subnet.prefixlen <= 28 or not contained:
        raise ValueError("Control subnet must be a small /24../28 RFC1918 network")
    if gateway not in subnet or gateway in (subnet.network_address, subnet.broadcast_address):
        raise ValueError("Gateway must be a usable address in control subnet")
    if not 1024 <= port <= 65535 or port in (7410, 8769, 8770, 28769):
        raise ValueError("Agent needs a separate unprivileged port")
    return IsolationConfig(network, bridge, str(subnet), str(gateway), port)
