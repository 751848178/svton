#!/usr/bin/env python3
"""Guard socket activation; never start or restart Docker, NPM or business services."""
import fcntl
import os
import stat
import sys
from commands import Commands
from container_boundary import verify_containers
from firewall import CHAIN, Firewall
from ingress_config import LISTEN_PORT, OWNER_PATH, check_owner, create_owner, load_config

LOCK_PATH = "/run/shipkit-public-ingress.lock"


def socket_stopped(commands):
    _, output = commands.run(["ss", "-H", "-lnt", "sport = :" + str(LISTEN_PORT)])
    if output.strip():
        raise ValueError("Stop the relay socket and service before rollback")


def perform(action, config, commands=None):
    commands = commands or Commands()
    firewall = Firewall(config, commands)
    owned = check_owner(config)
    if action == "rollback":
        socket_stopped(commands)
        if not owned:
            if firewall.rules(CHAIN) is not None or firewall.scoped_jumps(firewall.rules("INPUT")):
                raise ValueError("Unowned ingress artifacts; rollback refused")
            return
        firewall.rollback()
        os.unlink(OWNER_PATH)
        return
    verify_containers(config, commands)
    if not owned:
        if action != "enforce" or firewall.rules(CHAIN) is not None:
            raise ValueError("Existing ingress chain has no ownership receipt")
        if firewall.scoped_jumps(firewall.rules("INPUT")):
            raise ValueError("Existing ingress jump has no ownership receipt")
        create_owner(config)
    if action == "enforce":
        firewall.install()
    else:
        firewall.assert_owned()


def main():
    if os.geteuid() != 0 or sys.argv[1:] not in (["enforce"], ["verify"], ["rollback"]):
        raise ValueError("Root ingress guard action required")
    config = load_config()
    fd = os.open(LOCK_PATH, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1:
            raise ValueError("Invalid ingress maintenance lock")
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        perform(sys.argv[1], config)
    finally:
        os.close(fd)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Shipkit public ingress refused; inspect the bounded configuration and owned rules", file=sys.stderr)
        sys.exit(1)
