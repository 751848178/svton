"""Read-only Docker proof for an explicitly selected stopped data owner."""
import json
import re
import subprocess
from pathlib import Path, PurePosixPath


def container_record(record):
    identity = record.get("containerId")
    namespace = record.get("pidNamespace")
    root = record.get("containerDataRoot")
    if (not isinstance(identity, str) or not re.fullmatch(r"[a-f0-9]{12}|[a-f0-9]{64}", identity)
            or not isinstance(namespace, str) or not re.fullmatch(r"pid:\[\d+\]", namespace)
            or not isinstance(root, str) or len(root) > 4096 or root == "/"
            or "\x00" in root or not PurePosixPath(root).is_absolute()
            or ".." in PurePosixPath(root).parts or PurePosixPath(root).as_posix() != root):
        raise ValueError("Invalid container runtime identity")
    return identity, root


def inspect_container(selector):
    if not isinstance(selector, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", selector):
        raise ValueError("Invalid stopped container selector")
    # Do not inspect Config/Env: unrelated runtime secrets never enter this tool.
    fields = '{"Id":{{json .Id}},"State":{{json .State}},"Mounts":{{json .Mounts}}}'
    try:
        result = subprocess.run(["docker", "inspect", "--type", "container", "--format", fields, selector],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
        if len(result.stdout) > 1024 * 1024:
            raise ValueError("Oversized container inspection")
        value = json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, UnicodeError, json.JSONDecodeError):
        raise ValueError("Cannot verify stopped container with Docker inspect") from None
    if not isinstance(value, dict):
        raise ValueError("Invalid container inspection")
    return value


def verify_stopped_container(source, record, selector):
    identity, destination = container_record(record)
    if not selector:
        raise ValueError("Container PID namespace requires explicit --stopped-container")
    value = inspect_container(selector)
    full_id = value.get("Id")
    if not isinstance(full_id, str) or not re.fullmatch(r"[a-f0-9]{64}", full_id) or not full_id.startswith(identity):
        raise ValueError("Selected container does not match runtime identity")
    state = value.get("State")
    if (not isinstance(state, dict) or state.get("Running") is not False
            or type(state.get("Pid")) is not int or state["Pid"] != 0
            or state.get("Restarting") is not False or state.get("Paused") is not False):
        raise ValueError("Selected container is running or its stopped state is unverified")
    mounts = value.get("Mounts")
    if not isinstance(mounts, list):
        raise ValueError("Container data bind mount is unverified")
    matches = [mount for mount in mounts if isinstance(mount, dict) and mount.get("Destination") == destination]
    if len(matches) != 1 or matches[0].get("Type") != "bind":
        raise ValueError("Container data bind mount is unverified")
    origin = matches[0].get("Source")
    if not isinstance(origin, str) or not Path(origin).is_absolute() or Path(origin).resolve() != source:
        raise ValueError("Container data bind mount does not match backup source")
