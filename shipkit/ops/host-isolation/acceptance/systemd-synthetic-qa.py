#!/usr/bin/env python3
"""Opt-in dependency checks with random private units and a synthetic Docker role."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent
UNITS = Path("/run/systemd/system")
BASE = {"guard": "shipkit-network-guard.service", "server": "shipkit-server.service",
        "agent": "shipkit-runtime-agent.service"}


def command(*args, check=True):
    return subprocess.run(args, check=check, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, universal_newlines=True, timeout=30)


def synthetic_unit(kind, names, gate, marker):
    replacements = {name: names[key] for key, name in BASE.items()}
    replacements["docker.service"] = names["control"]
    wanted = ("Requires=", "After=", "Wants=", "PartOf=", "Before=")
    deps = []
    for line in (SOURCE / BASE[kind]).read_text().splitlines():
        if line.startswith(wanted):
            key, value = line.split("=", 1)
            units = value.split()
            if any(unit not in replacements for unit in units):
                raise ValueError("Unreviewed dependency in " + BASE[kind])
            deps.append(key + "=" + " ".join(replacements[unit] for unit in units))
    body = ["[Unit]", "Description=Private Shipkit dependency acceptance", *deps,
            "[Service]", "Type=oneshot", "RemainAfterExit=yes"]
    if kind == "guard":
        body.append("ExecStart=/usr/bin/test -f " + str(gate))
    else:
        body.extend(["ExecStartPre=/usr/bin/test -f " + str(gate),
                     "ExecStart=/usr/bin/touch " + str(marker)])
    text = "\n".join(body) + "\n"
    if "docker.service" in text:
        raise ValueError("Synthetic graph must not depend on real Docker")
    return text


class OwnedUnits:
    def __init__(self):
        self.created = []

    def create(self, name, text):
        file = UNITS / name
        with file.open("x") as stream:
            self.created.append((name, file, os.fstat(stream.fileno()).st_ino))
            stream.write(text)

    def cleanup(self):
        if not self.created:
            return
        # A collision or replacement never becomes an owned cleanup target.
        same = [(name, file) for name, file, inode in self.created
                if file.exists() and file.lstat().st_ino == inode and not file.is_symlink()]
        names = [name for name, _ in same]
        if names:
            command("systemctl", "stop", *names)
            command("systemctl", "reset-failed", *names)
            for _, file in same:
                file.unlink()
            command("systemctl", "daemon-reload")
        if len(same) != len(self.created):
            raise ValueError("Owned QA unit was replaced/missing; manual review required")


def docker_state():
    return command("systemctl", "show", "docker.service", "-p", "ActiveState",
                   "-p", "ExecMainStartTimestampMonotonic").stdout


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def wait_for_markers(markers):
    deadline = time.monotonic() + 5
    while not all(marker.exists() for marker in markers) and time.monotonic() < deadline:
        time.sleep(0.1)
    check(all(marker.exists() for marker in markers), "Healthy schedule must start both synthetic markers")


def main():
    if sys.argv[1:] != ["--run"] or os.geteuid() != 0:
        raise ValueError("Run explicitly as root with --run on a reviewed systemd host")
    before = docker_state()
    check("ActiveState=active" in before, "Existing Docker must already be active; test never starts it")
    prefix = "shipkit-isolation-qa-" + uuid.uuid4().hex[:12]
    names = {kind: prefix + "-" + kind + ".service" for kind in (*BASE, "control")}
    scratch = Path(tempfile.mkdtemp(prefix=prefix + "-", dir="/run"))
    gate = scratch / "guard-ready"
    markers = {kind: scratch / (kind + "-started") for kind in ("server", "agent", "control")}
    owned, completed = OwnedUnits(), []
    try:
        for name in names.values():
            state = command("systemctl", "show", name, "-p", "LoadState").stdout.strip()
            check(state == "LoadState=not-found", "Random QA unit name already exists")
        for kind in BASE:
            owned.create(names[kind], synthetic_unit(kind, names, gate, markers.get(kind)))
        owned.create(names["control"], "[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=/usr/bin/touch " + str(markers["control"]) + "\n")
        command("systemd-analyze", "verify", *[str(file) for _, file, _ in owned.created])
        command("systemctl", "daemon-reload")
        command("systemctl", "start", names["control"])
        result = command("systemctl", "start", names["server"], check=False)
        check(result.returncode != 0, "Missing guard gate must reject Server start")
        check(not markers["server"].exists() and not markers["agent"].exists(), "Guard failure must run no app commands")
        check(markers["control"].exists() and docker_state() == before, "Guard failure must leave Docker/control unchanged")
        completed.append("guard failure blocks Server/Agent; Docker/control unchanged")
        command("systemctl", "reset-failed", *names.values())
        gate.touch()
        command("systemctl", "start", names["server"])
        wait_for_markers([markers["server"], markers["agent"]])
        completed.append("healthy dependency schedule starts synthetic Server/Agent")
        command("systemctl", "stop", names["server"], names["agent"])
        for kind in ("server", "agent"):
            markers[kind].unlink()
        gate.unlink()
        result = command("systemctl", "start", names["server"], check=False)
        check(result.returncode != 0, "Cached active guard still requires startup preflight")
        check(not markers["server"].exists() and not markers["agent"].exists(), "Preflight failure must run no app commands")
        check(docker_state() == before, "Tests must never restart existing Docker")
        completed.append("startup preflight blocks apps when cached guard readiness is lost")
    finally:
        owned.cleanup()
        shutil.rmtree(str(scratch))
    check(docker_state() == before, "Docker changed during QA cleanup")
    print(json.dumps({"checks": completed, "dockerUnchanged": True,
                      "scope": "synthetic systemd graph; real Docker is read-only"}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Synthetic systemd acceptance failed: " + str(error), file=sys.stderr)
        sys.exit(1)
