"""Validate root-owned configuration within the fixed public-ingress namespace."""
import hashlib
import ipaddress
import json
import os
import re
import stat
from collections import namedtuple

DIRECTORY = "/etc/shipkit-public-ingress"
CONFIG_PATH = DIRECTORY + "/config.json"
OWNER_PATH = DIRECTORY + "/ownership.json"
LISTEN_PORT = 28770
SERVER_PORT = 28769
Config = namedtuple("Config", "npm_id network_id npm_address npm_gateway")
FIELDS = {"version", "npmContainerId", "npmNetworkId", "npmAddress", "npmGateway"}


def parse_config(value):
    if not isinstance(value, dict) or set(value) != FIELDS or type(value["version"]) is not int or value["version"] != 1:
        raise ValueError("Invalid ingress configuration fields")
    for key in ("npmContainerId", "npmNetworkId"):
        if not isinstance(value[key], str) or not re.fullmatch(r"[a-f0-9]{64}", value[key]):
            raise ValueError("Full immutable Docker identities required")
    ranges = [ipaddress.IPv4Network(c) for c in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")]
    addresses = []
    for key in ("npmAddress", "npmGateway"):
        if not isinstance(value[key], str):
            raise ValueError("IPv4 strings required")
        address = ipaddress.IPv4Address(value[key])
        if str(address) != value[key] or not any(address in network for network in ranges):
            raise ValueError("Canonical RFC1918 IPv4 addresses required")
        addresses.append(str(address))
    if addresses[0] == addresses[1]:
        raise ValueError("Container and gateway must differ")
    return Config(value["npmContainerId"], value["npmNetworkId"], *addresses)


def config_dict(config):
    return dict(zip(("version", "npmContainerId", "npmNetworkId", "npmAddress", "npmGateway"),
                    (1, config.npm_id, config.network_id, config.npm_address, config.npm_gateway)))


def config_hash(config):
    encoded = json.dumps(config_dict(config), sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def private_json(file, owner_uid=0):
    parent = os.path.dirname(file)
    directory = os.lstat(parent)
    if not stat.S_ISDIR(directory.st_mode) or stat.S_IMODE(directory.st_mode) != 0o700 or directory.st_uid != owner_uid:
        raise ValueError("Private ingress directory ownership required")
    if os.path.realpath(parent) != parent:
        raise ValueError("Symlinked ingress paths refused")
    fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_uid != owner_uid or info.st_nlink != 1:
            raise ValueError("Private regular ingress file required")
        raw = os.read(fd, 4097)
        after = os.fstat(fd)
        if len(raw) > 4096 or len(raw) != info.st_size or after.st_size != info.st_size or after.st_mtime_ns != info.st_mtime_ns:
            raise ValueError("Ingress file changed or exceeded budget")
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError("Duplicate ingress fields refused")
                result[key] = value
            return result
        return json.loads(raw.decode("utf-8"), object_pairs_hook=unique)
    finally:
        os.close(fd)


def load_config():
    return parse_config(private_json(CONFIG_PATH))


def owner_value(config):
    return {"version": 1, "configHash": config_hash(config)}


def check_owner(config):
    try:
        value = private_json(OWNER_PATH)
    except FileNotFoundError:
        return False
    if value != owner_value(config):
        raise ValueError("Ingress ownership differs; administrator review required")
    return True


def create_owner(config):
    raw = (json.dumps(owner_value(config), sort_keys=True) + "\n").encode()
    fd = os.open(OWNER_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    try:
        os.write(fd, raw)
        os.fsync(fd)
    finally:
        os.close(fd)
