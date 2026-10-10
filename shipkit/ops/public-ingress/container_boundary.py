"""Verify the fixed NPM identity and current healthy Shipkit-only upstream."""
import ipaddress
import json
from commands import Commands
from ingress_config import SERVER_PORT

SERVER_NAME = "ship_shipkit_server-server-1"
NPM_FORMAT = ('{"id":{{json .Id}},"running":{{json .State.Running}},"paused":{{json .State.Paused}},'
              '"restarting":{{json .State.Restarting}},"networks":{{json .NetworkSettings.Networks}}}')
SERVER_FORMAT = ('{"id":{{json .Id}},"running":{{json .State.Running}},"paused":{{json .State.Paused}},'
                 '"restarting":{{json .State.Restarting}},"health":{{json .State.Health.Status}},'
                 '"ports":{{json .HostConfig.PortBindings}},"networks":{{json .NetworkSettings.Networks}},'
                 '"project":{{json (index .Config.Labels "com.docker.compose.project")}},'
                 '"service":{{json (index .Config.Labels "com.docker.compose.service")}}}')
NETWORK_FORMAT = ('{"id":{{json .Id}},"driver":{{json .Driver}},"options":{{json .Options}},'
                  '"pools":{{json .IPAM.Config}}}')


def inspect(target, format_, commands):
    _, output = commands.run(["docker", "inspect", "--format", format_, target])
    value = json.loads(output)
    if not isinstance(value, dict):
        raise ValueError("Invalid Docker boundary metadata")
    return value


def active(value):
    return value.get("running") is True and value.get("paused") is False and value.get("restarting") is False


def verify_containers(config, commands=None):
    commands = commands or Commands()
    npm = inspect(config.npm_id, NPM_FORMAT, commands)
    if npm.get("id") != config.npm_id or not active(npm) or set(npm.get("networks", {})) != {"bridge"}:
        raise ValueError("NPM immutable identity is not active on its approved bridge")
    network = npm["networks"]["bridge"]
    if (network.get("NetworkID"), network.get("IPAddress"), network.get("Gateway")) != (
            config.network_id, config.npm_address, config.npm_gateway):
        raise ValueError("NPM network identity or address changed")
    prefix = network.get("IPPrefixLen")
    if type(prefix) is not int or not 8 <= prefix <= 30:
        raise ValueError("Invalid NPM bridge prefix")
    _, output = commands.run(["docker", "network", "inspect", "--format", NETWORK_FORMAT, "bridge"])
    bridge = json.loads(output)
    pools = bridge.get("pools")
    options = bridge.get("options")
    if bridge.get("id") != config.network_id or bridge.get("driver") != "bridge" or not isinstance(options, dict) or (
            options.get("com.docker.network.bridge.name") != "docker0"
            or options.get("com.docker.network.bridge.default_bridge") != "true"):
        raise ValueError("Unapproved NPM bridge device")
    if not isinstance(pools, list) or len(pools) != 1 or not isinstance(pools[0], dict):
        raise ValueError("Unapproved NPM bridge pools")
    pool = ipaddress.IPv4Network(pools[0]["Subnet"], strict=True)
    if pools[0].get("Gateway") != config.npm_gateway or pool.prefixlen != prefix or (
            ipaddress.IPv4Address(config.npm_address) not in pool or ipaddress.IPv4Address(config.npm_gateway) not in pool):
        raise ValueError("NPM bridge address scope changed")
    server = inspect(SERVER_NAME, SERVER_FORMAT, commands)
    expected_ports = {"8769/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(SERVER_PORT)}]}
    if not active(server) or server.get("id") == config.npm_id or server.get("health") != "healthy" or (
            server.get("ports") != expected_ports or set(server.get("networks", {})) != {"shipkit-control"}
            or server.get("project") != "ship_shipkit_server" or server.get("service") != "server"):
        raise ValueError("Shipkit upstream is not healthy with the approved loopback publication")
    return {"npmId": config.npm_id, "serverId": server["id"]}
